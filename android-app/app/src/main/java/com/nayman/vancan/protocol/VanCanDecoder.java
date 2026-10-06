package com.nayman.vancan.protocol;

/** Decoder for the project-owned CAN messages documented in docs/can-protocol.md. */
public final class VanCanDecoder {
    public static final int PROTOCOL_VERSION = 1;
    public static final int HEARTBEAT_ID = 0x100;
    public static final int COOLANT_OUTLET_ID = 0x110;

    private VanCanDecoder() {}

    public static Heartbeat decodeHeartbeat(CanFrame frame) {
        if (frame.canId != HEARTBEAT_ID || frame.extended || frame.data.length != 8) {
            return null;
        }
        byte[] d = frame.data;
        long uptime = ((long) d[4] & 0xff)
                | (((long) d[5] & 0xff) << 8)
                | (((long) d[6] & 0xff) << 16)
                | (((long) d[7] & 0xff) << 24);
        return new Heartbeat(d[0] & 0xff, d[1] & 0xff, d[2] & 0xff,
                d[3] & 0xff, uptime, frame.receivedAtMillis);
    }

    public static CoolantReading decodeCoolant(CanFrame frame) {
        if (frame.canId != COOLANT_OUTLET_ID || frame.extended || frame.data.length != 8) {
            return null;
        }
        byte[] d = frame.data;
        int adc = (d[4] & 0xff) | ((d[5] & 0xff) << 8);
        short deciC = (short) ((d[6] & 0xff) | ((d[7] & 0xff) << 8));
        int status = d[2] & 0xff;
        boolean valid = (d[0] & 0xff) == PROTOCOL_VERSION
                && (d[1] & 0xff) == 1
                && status == 0
                && deciC != Short.MIN_VALUE;
        double celsius = deciC / 10.0;
        return new CoolantReading(d[0] & 0xff, d[1] & 0xff, status,
                d[3] & 0xff, adc, adc * 3.3 / 4095.0,
                valid, celsius, celsius * 9.0 / 5.0 + 32.0,
                frame.receivedAtMillis);
    }

    public static String sensorStatusText(int status) {
        if (status == 0) return "VALID";
        StringBuilder text = new StringBuilder();
        appendFlag(text, status, 0x01, "OPEN");
        appendFlag(text, status, 0x02, "SHORT");
        appendFlag(text, status, 0x04, "ADC ERROR");
        appendFlag(text, status, 0x08, "CALC ERROR");
        int unknown = status & ~0x0f;
        if (unknown != 0 || text.length() == 0) {
            if (text.length() > 0) text.append(" + ");
            text.append(String.format("UNKNOWN 0x%02X", status));
        }
        return text.toString();
    }

    private static void appendFlag(StringBuilder value, int status, int flag, String label) {
        if ((status & flag) == 0) return;
        if (value.length() > 0) value.append(" + ");
        value.append(label);
    }

    public static final class Heartbeat {
        public final int version;
        public final int nodeType;
        public final int nodeStatus;
        public final int sequence;
        public final long uptimeMillis;
        public final long receivedAtMillis;

        Heartbeat(int version, int nodeType, int nodeStatus, int sequence,
                  long uptimeMillis, long receivedAtMillis) {
            this.version = version;
            this.nodeType = nodeType;
            this.nodeStatus = nodeStatus;
            this.sequence = sequence;
            this.uptimeMillis = uptimeMillis;
            this.receivedAtMillis = receivedAtMillis;
        }
    }

    public static final class CoolantReading {
        public final int version;
        public final int sensorId;
        public final int status;
        public final int sequence;
        public final int adcRaw;
        public final double voltage;
        public final boolean valid;
        public final double celsius;
        public final double fahrenheit;
        public final long receivedAtMillis;

        CoolantReading(int version, int sensorId, int status, int sequence,
                       int adcRaw, double voltage, boolean valid,
                       double celsius, double fahrenheit, long receivedAtMillis) {
            this.version = version;
            this.sensorId = sensorId;
            this.status = status;
            this.sequence = sequence;
            this.adcRaw = adcRaw;
            this.voltage = voltage;
            this.valid = valid;
            this.celsius = celsius;
            this.fahrenheit = fahrenheit;
            this.receivedAtMillis = receivedAtMillis;
        }
    }
}
