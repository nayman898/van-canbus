package com.nayman.vancan.protocol;

import java.util.Arrays;
import java.util.Locale;

/** An immutable Classical CAN frame received from the USB adapter. */
public final class CanFrame {
    public final long receivedAtMillis;
    public final int canId;
    public final boolean extended;
    public final boolean remote;
    public final boolean error;
    public final byte[] data;

    public CanFrame(long receivedAtMillis, int canId, boolean extended,
                    boolean remote, boolean error, byte[] data) {
        this.receivedAtMillis = receivedAtMillis;
        this.canId = canId;
        this.extended = extended;
        this.remote = remote;
        this.error = error;
        this.data = Arrays.copyOf(data, data.length);
    }

    public String idText() {
        return extended
                ? String.format(Locale.US, "%08X", canId)
                : String.format(Locale.US, "%03X", canId);
    }

    public String dataHex() {
        StringBuilder value = new StringBuilder(data.length * 3);
        for (int i = 0; i < data.length; i++) {
            if (i > 0) value.append(' ');
            value.append(String.format(Locale.US, "%02X", data[i] & 0xff));
        }
        return value.toString();
    }
}
