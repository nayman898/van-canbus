package com.nayman.vancan.protocol;

/** Fuel-only freshness and slosh damping; voltage/resistance diagnostics stay unsmoothed. */
public final class FuelLevelDisplay {
    public static final long STALE_AFTER_MS = 1500;
    private static final double SMOOTHING_TIME_MS = 5000.0;
    private VanCanDecoder.FuelReading reading;
    private double percent = Double.NaN;

    public void clear() {
        reading = null;
        percent = Double.NaN;
    }

    public void accept(VanCanDecoder.FuelReading next) {
        if (next == null) return;
        long dt = reading == null ? STALE_AFTER_MS : next.receivedAtMillis - reading.receivedAtMillis;
        if (!next.valid) {
            percent = Double.NaN;
        } else if (reading == null || !reading.valid || dt < 0 || dt >= STALE_AFTER_MS) {
            percent = next.estimatedPercent;
        } else {
            percent += (1.0 - Math.exp(-dt / SMOOTHING_TIME_MS)) * (next.estimatedPercent - percent);
        }
        reading = next;
    }

    public VanCanDecoder.FuelReading reading() {
        return reading;
    }

    public boolean fresh(boolean connected, long nowMillis) {
        return connected && reading != null && nowMillis >= reading.receivedAtMillis
                && nowMillis - reading.receivedAtMillis < STALE_AFTER_MS;
    }

    public double estimatedPercent(boolean connected, long nowMillis) {
        return fresh(connected, nowMillis) && reading.valid ? percent : Double.NaN;
    }
}
