package com.nayman.vancan.logging;

import android.content.Context;

import com.nayman.vancan.protocol.CanFrame;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/** Writes raw received frames to app-specific storage without storage permissions. */
public final class CsvCanLogger {
    private BufferedWriter writer;
    private File currentFile;
    private int framesSinceFlush;

    public synchronized File start(Context context) throws IOException {
        stop();
        File directory = context.getExternalFilesDir("logs");
        if (directory == null) directory = new File(context.getFilesDir(), "logs");
        if (!directory.exists() && !directory.mkdirs()) {
            throw new IOException("Cannot create log directory");
        }
        String stamp = new SimpleDateFormat("yyyyMMdd-HHmmss", Locale.US).format(new Date());
        currentFile = new File(directory, "van-can-" + stamp + ".csv");
        writer = new BufferedWriter(new FileWriter(currentFile));
        writer.write("utc_time,elapsed_ms,can_id,extended,remote,error,dlc,data_hex\n");
        writer.flush();
        return currentFile;
    }

    public synchronized void append(CanFrame frame) {
        if (writer == null) return;
        try {
            SimpleDateFormat iso = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
            iso.setTimeZone(TimeZone.getTimeZone("UTC"));
            writer.write(iso.format(new Date()));
            writer.write(',');
            writer.write(Long.toString(frame.receivedAtMillis));
            writer.write(",0x");
            writer.write(frame.idText());
            writer.write(',');
            writer.write(frame.extended ? "1" : "0");
            writer.write(',');
            writer.write(frame.remote ? "1" : "0");
            writer.write(',');
            writer.write(frame.error ? "1" : "0");
            writer.write(',');
            writer.write(Integer.toString(frame.data.length));
            writer.write(',');
            writer.write(frame.dataHex().replace(' ', '-'));
            writer.write('\n');
            if (++framesSinceFlush >= 20) {
                writer.flush();
                framesSinceFlush = 0;
            }
        } catch (IOException ignored) {
            // The Activity reports the next explicit start/stop error to the user.
        }
    }

    public synchronized File stop() throws IOException {
        if (writer != null) {
            writer.flush();
            writer.close();
            writer = null;
        }
        framesSinceFlush = 0;
        return currentFile;
    }

    public synchronized boolean isLogging() {
        return writer != null;
    }

    public synchronized File latestFile() {
        return currentFile;
    }
}
