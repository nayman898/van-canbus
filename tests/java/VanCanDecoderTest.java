import com.nayman.vancan.protocol.CanFrame;
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
        System.out.println("Android CAN decoder checks passed");
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
