import com.nayman.vancan.protocol.CanFrame;
import com.nayman.vancan.protocol.FuelLevelDisplay;
import com.nayman.vancan.protocol.VanCanDecoder;

/** Runs on a plain JDK so the telemetry contract is checked without an emulator. */
public final class VanCanDecoderTest {
    public static void main(String[] args) {
        CanFrame hb = frame(0x100, 1, 1, 1, 42, 0x78, 0x56, 0x34, 0x12);
        VanCanDecoder.Heartbeat heartbeat = VanCanDecoder.decodeHeartbeat(hb);
        check(heartbeat != null && heartbeat.sequence == 42, "heartbeat sequence");
        check(heartbeat.uptimeMillis == 0x12345678L, "little-endian uptime");
        heartbeat = VanCanDecoder.decodeHeartbeat(frame(0x100, 1, 1, 1, 0, 255, 255, 255, 255));
        check(heartbeat.uptimeMillis == 4294967295L, "unsigned uptime");

        VanCanDecoder.CoolantReading reading = VanCanDecoder.decodeCoolant(
                frame(0x110, 1, 1, 0, 7, 0x32, 0x08, 0x0a, 0x01));
        check(reading != null && reading.valid && reading.adcRaw == 2098, "valid coolant ADC");
        check(Math.abs(reading.celsius - 26.6) < 0.001, "Celsius scale");
        check(Math.abs(reading.fahrenheit - 79.88) < 0.001, "Fahrenheit conversion");
        reading = VanCanDecoder.decodeCoolant(frame(0x110, 1, 1, 0, 255, 0, 8, 0x85, 0xff));
        check(reading.valid && Math.abs(reading.celsius + 12.3) < 0.001, "signed temperature");

        for (int status : new int[] {1, 2, 4, 8, 3, 16, 255}) {
            reading = VanCanDecoder.decodeCoolant(frame(0x110, 1, 1, status, 0, 0xff, 15, 0, 0x80));
            check(!reading.valid, "fault hides temperature: " + status);
        }
        check(!VanCanDecoder.decodeCoolant(frame(0x110, 1, 1, 0, 0, 0, 8, 0, 0x80)).valid,
                "sentinel without fault still invalid");
        check(!VanCanDecoder.decodeCoolant(frame(0x110, 2, 1, 0, 0, 0, 8, 0, 1)).valid,
                "unknown protocol version");
        check(!VanCanDecoder.decodeCoolant(frame(0x110, 1, 2, 0, 0, 0, 8, 0, 1)).valid,
                "wrong sensor identity");
        check(VanCanDecoder.decodeCoolant(frame(0x110, 1, 1, 0)) == null, "truncated coolant");
        check(VanCanDecoder.decodeHeartbeat(frame(0x100, 1, 1)) == null, "truncated heartbeat");
        check(VanCanDecoder.decodeCoolant(frame(0x112, 1, 1, 0, 0, 0, 8, 0, 1)) == null,
                "unallocated CAN ID");
        reading = VanCanDecoder.decodeCoolant(frame(0x111, 1, 2, 0, 7, 0x32, 8, 0x0a, 1));
        check(reading.valid && reading.sensorId == 2 && reading.celsius == 26.6, "post-radiator coolant");
        check(!VanCanDecoder.decodeCoolant(frame(0x111, 1, 1, 0, 7, 0, 8, 0, 1)).valid,
                "post-radiator wrong sensor identity");
        check(!VanCanDecoder.decodeCoolant(frame(0x111, 1, 2, 1, 7, 255, 15, 0, 128)).valid,
                "post-radiator open circuit");
        for (int flag = 0; flag < 3; flag++) {
            CanFrame special = new CanFrame(1000, 0x111, flag == 0, flag == 1, flag == 2,
                    new byte[] {1, 2, 0, 0, 0, 8, 0, 1});
            check(VanCanDecoder.decodeCoolant(special) == null, "reject extended/RTR/error");
        }
        checkFuel();
        System.out.println("Android CAN decoder and fuel display checks passed");
    }

    private static void checkFuel() {
        VanCanDecoder.FuelReading empty = VanCanDecoder.decodeFuel(
                frame(0x120, 1, 1, 0, 7, 0x1e, 1, 0xef, 2));
        check(empty != null && empty.valid && empty.adcRaw == 286, "fuel raw ADC");
        check(empty.resistanceOhms == 75.1 && empty.estimatedPercent == 0, "empty endpoint clamped");
        check(Math.abs(empty.voltage - 0.23048) < 0.0001, "fuel voltage");
        VanCanDecoder.FuelReading full = VanCanDecoder.decodeFuel(
                frame(0x120, 1, 1, 0, 255, 41, 0, 101, 0));
        check(full.valid && Math.abs(full.estimatedPercent - 99.846) < .001, "full estimate");
        for (int status : new int[] {1, 2, 4, 8, 3, 16, 255}) {
            VanCanDecoder.FuelReading fault = VanCanDecoder.decodeFuel(
                    frame(0x120, 1, 1, status, 0, 255, 15, 255, 255));
            check(!fault.valid && Double.isNaN(fault.resistanceOhms)
                    && Double.isNaN(fault.estimatedPercent), "fuel fault suppresses values");
        }
        check(!VanCanDecoder.decodeFuel(frame(0x120, 1, 1, 0, 0, 41, 0, 255, 255)).valid, "fuel sentinel");
        check(!VanCanDecoder.decodeFuel(frame(0x120, 2, 1, 0, 0, 41, 0, 101, 0)).valid, "fuel version");
        check(!VanCanDecoder.decodeFuel(frame(0x120, 1, 2, 0, 0, 41, 0, 101, 0)).valid, "fuel identity");
        check(!VanCanDecoder.decodeFuel(frame(0x120, 1, 1, 0, 0, 0, 16, 101, 0)).valid, "fuel ADC range");
        check(!VanCanDecoder.decodeFuel(frame(0x120, 1, 1, 0, 0, 0, 0, 101, 0)).valid, "fuel short without status");
        check(!VanCanDecoder.decodeFuel(frame(0x120, 1, 1, 0, 0, 255, 15, 101, 0)).valid, "fuel open without status");
        check(!VanCanDecoder.decodeFuel(frame(0x120, 1, 1, 0, 0, 41, 0, 49, 0)).valid, "fuel low resistance");
        check(!VanCanDecoder.decodeFuel(frame(0x120, 1, 1, 0, 0, 41, 0, 0xe9, 3)).valid, "fuel high resistance");
        check(VanCanDecoder.decodeFuel(frame(0x120, 1, 1, 0)) == null, "fuel truncated");
        check(VanCanDecoder.decodeFuel(frame(0x121, 1, 1, 0, 0, 41, 0, 101, 0)) == null, "fuel wrong CAN ID");
        for (int flag = 0; flag < 3; flag++) {
            check(VanCanDecoder.decodeFuel(new CanFrame(1000, 0x120, flag == 0, flag == 1, flag == 2,
                    new byte[] {1, 1, 0, 0, 41, 0, 101, 0})) == null, "fuel special frame");
        }
        check(VanCanDecoder.fuelStatusText(8).equals("OUT OF RANGE"), "fuel status label");

        FuelLevelDisplay display = new FuelLevelDisplay();
        check(!display.fresh(true, 1000), "absent fuel is stale");
        display.accept(empty);
        check(display.estimatedPercent(true, 1000) == 0, "first fuel sample immediate");
        VanCanDecoder.FuelReading later = VanCanDecoder.decodeFuel(new CanFrame(1500, 0x120,
                false, false, false, fullFrame()));
        display.accept(later);
        double smooth = display.estimatedPercent(true, 1500);
        check(smooth > 9 && smooth < 10, "five-second slosh damping");
        check(display.reading().resistanceOhms == full.resistanceOhms, "diagnostics stay unsmoothed");
        check(display.fresh(true, 2999) && !display.fresh(true, 3000), "independent fuel freshness");
        check(Double.isNaN(display.estimatedPercent(false, 1500)), "disconnect hides fuel");
        check(!display.fresh(true, 1499), "negative age not fresh");
        display.accept(VanCanDecoder.decodeFuel(frame(0x120, 1, 1, 1, 0, 255, 15, 255, 255)));
        check(Double.isNaN(display.estimatedPercent(true, 1000)), "fault clears smoothed value");
        display.accept(later);
        check(display.estimatedPercent(true, 1500) > 99, "fault recovery resets filter");
        display.accept(VanCanDecoder.decodeFuel(new CanFrame(4000, 0x120, false, false, false,
                new byte[] {1, 1, 0, 0, 0x1e, 1, (byte)0xef, 2})));
        check(display.estimatedPercent(true, 4000) == 0, "stale gap resets filter");
        display.clear();
        check(display.reading() == null && !display.fresh(true, 4000), "reconnect clears fuel");
    }

    private static byte[] fullFrame() {
        return new byte[] {1, 1, 0, 0, 41, 0, 101, 0};
    }

    private static CanFrame frame(int id, int... bytes) {
        byte[] data = new byte[bytes.length];
        for (int i = 0; i < bytes.length; i++) data[i] = (byte) bytes[i];
        return new CanFrame(1000, id, false, false, false, data);
    }

    private static void check(boolean success, String message) {
        if (!success) throw new AssertionError(message);
    }
}
