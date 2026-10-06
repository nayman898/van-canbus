package com.nayman.vancan;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.WindowInsets;
import android.widget.FrameLayout;
import android.widget.ScrollView;
import android.widget.Toast;

import com.nayman.vancan.logging.CsvCanLogger;
import com.nayman.vancan.protocol.CanFrame;
import com.nayman.vancan.protocol.VanCanDecoder;
import com.nayman.vancan.usb.GsUsbCanAdapter;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.ArrayDeque;
import java.util.Deque;

public final class MainActivity extends Activity implements DashboardView.Actions {
    private static final String ACTION_USB_PERMISSION = "com.nayman.vancan.USB_PERMISSION";
    private static final int EXPORT_LOG_REQUEST = 2001;

    private final DashboardState state = new DashboardState();
    private final CsvCanLogger logger = new CsvCanLogger();
    private final Deque<Long> frameTimes = new ArrayDeque<>();
    private final android.os.Handler ticker = new android.os.Handler(android.os.Looper.getMainLooper());
    private DashboardView dashboard;
    private UsbManager usbManager;
    private GsUsbCanAdapter adapter;
    private boolean receiverRegistered;
    private File pendingExport;

    private final Runnable freshnessTicker = new Runnable() {
        @Override public void run() {
            long now = SystemClock.elapsedRealtime();
            state.trafficRecent = state.usbConnected && now - state.lastFrameAt < 1_500;
            while (!frameTimes.isEmpty() && now - frameTimes.peekFirst() > 1_000) {
                frameTimes.removeFirst();
            }
            state.framesPerSecond = frameTimes.size();
            dashboard.setState(state);
            ticker.postDelayed(this, 250);
        }
    };

    private final BroadcastReceiver usbReceiver = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            UsbDevice device = usbExtra(intent);
            if (ACTION_USB_PERMISSION.equals(action)) {
                state.permissionPending = false;
                if (device != null && intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)) {
                    connect(device);
                } else {
                    state.connectionText = "USB permission denied";
                    refresh();
                }
            } else if (UsbManager.ACTION_USB_DEVICE_DETACHED.equals(action)
                    && device != null && GsUsbCanAdapter.isSupported(device)) {
                adapter.stop();
                state.usbConnected = false;
                state.connectionText = "U2C disconnected";
                refresh();
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(android.graphics.Color.rgb(6, 15, 23));
        getWindow().setNavigationBarColor(android.graphics.Color.rgb(6, 15, 23));

        dashboard = new DashboardView(this);
        dashboard.setActions(this);
        dashboard.setState(state);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(android.graphics.Color.rgb(6, 15, 23));
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setVerticalScrollBarEnabled(false);
        scroll.addView(dashboard, new ScrollView.LayoutParams(
                ScrollView.LayoutParams.MATCH_PARENT, ScrollView.LayoutParams.WRAP_CONTENT));
        root.addView(scroll, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        // Android 15+ draws behind the system bars. Pad the container, not the
        // Canvas view: its drawing and touch coordinates then share the safe area.
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets safe = insets.getInsets(
                        WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
                return WindowInsets.CONSUMED;
            }
            int left = insets.getSystemWindowInsetLeft();
            int top = insets.getSystemWindowInsetTop();
            int right = insets.getSystemWindowInsetRight();
            int bottom = insets.getSystemWindowInsetBottom();
            if (Build.VERSION.SDK_INT >= 28 && insets.getDisplayCutout() != null) {
                android.view.DisplayCutout cutout = insets.getDisplayCutout();
                left = Math.max(left, cutout.getSafeInsetLeft());
                top = Math.max(top, cutout.getSafeInsetTop());
                right = Math.max(right, cutout.getSafeInsetRight());
                bottom = Math.max(bottom, cutout.getSafeInsetBottom());
            }
            view.setPadding(left, top, right, bottom);
            return insets.consumeSystemWindowInsets();
        });
        setContentView(root);
        root.requestApplyInsets();

        usbManager = (UsbManager) getSystemService(Context.USB_SERVICE);
        adapter = new GsUsbCanAdapter(usbManager, new GsUsbCanAdapter.Listener() {
            @Override public void onStatus(String message) {
                runOnUiThread(() -> {
                    state.usbConnected = true;
                    state.connectionText = message;
                    refresh();
                });
            }

            @Override public void onFrame(CanFrame frame) {
                logger.append(frame);
                runOnUiThread(() -> acceptFrame(frame));
            }

            @Override public void onStopped(String reason, boolean error) {
                runOnUiThread(() -> {
                    state.usbConnected = false;
                    state.trafficRecent = false;
                    state.connectionText = error ? "CAN error · " + reason : "U2C disconnected";
                    refresh();
                });
            }
        });

        registerUsbReceiver();
        ticker.post(freshnessTicker);
        dashboard.postDelayed(() -> discoverAndConnect(false), 350);
    }

    @Override
    protected void onDestroy() {
        ticker.removeCallbacksAndMessages(null);
        adapter.stop();
        try {
            state.latestLog = logger.stop();
        } catch (IOException ignored) {
        }
        if (receiverRegistered) unregisterReceiver(usbReceiver);
        super.onDestroy();
    }

    @Override
    public void onConnectPressed() {
        if (adapter.isRunning()) {
            adapter.stop();
            state.connectionText = "U2C disconnected";
            state.usbConnected = false;
            refresh();
        } else {
            discoverAndConnect(true);
        }
    }

    @Override
    public void onLogPressed() {
        try {
            if (logger.isLogging()) {
                state.latestLog = logger.stop();
                state.logging = false;
                toast("Log saved: " + state.latestLog.getName());
            } else {
                state.latestLog = logger.start(this);
                state.logging = true;
                toast("CAN logging started");
            }
        } catch (IOException problem) {
            state.logging = logger.isLogging();
            toast("Log error: " + problem.getMessage());
        }
        refresh();
    }

    @Override
    public void onExportPressed() {
        try {
            if (logger.isLogging()) {
                state.latestLog = logger.stop();
                state.logging = false;
            }
        } catch (IOException problem) {
            toast("Could not close log: " + problem.getMessage());
            return;
        }
        if (state.latestLog == null || !state.latestLog.exists()) {
            toast("Record a log before exporting");
            return;
        }
        pendingExport = state.latestLog;
        Intent create = new Intent(Intent.ACTION_CREATE_DOCUMENT)
                .addCategory(Intent.CATEGORY_OPENABLE)
                .setType("text/csv")
                .putExtra(Intent.EXTRA_TITLE, pendingExport.getName());
        startActivityForResult(create, EXPORT_LOG_REQUEST);
        refresh();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != EXPORT_LOG_REQUEST || resultCode != RESULT_OK
                || data == null || data.getData() == null || pendingExport == null) return;
        Uri destination = data.getData();
        try (FileInputStream input = new FileInputStream(pendingExport);
             OutputStream output = getContentResolver().openOutputStream(destination)) {
            if (output == null) throw new IOException("Cannot open export destination");
            byte[] buffer = new byte[16 * 1024];
            int count;
            while ((count = input.read(buffer)) >= 0) output.write(buffer, 0, count);
            toast("Log exported");
        } catch (IOException problem) {
            toast("Export failed: " + problem.getMessage());
        }
        pendingExport = null;
    }

    private void acceptFrame(CanFrame frame) {
        long now = SystemClock.elapsedRealtime();
        state.lastFrameAt = now;
        state.trafficRecent = true;
        state.totalFrames++;
        frameTimes.addLast(now);
        while (!frameTimes.isEmpty() && now - frameTimes.peekFirst() > 1_000) frameTimes.removeFirst();
        state.framesPerSecond = frameTimes.size();

        state.recentFrames.addFirst(frame);
        while (state.recentFrames.size() > 12) state.recentFrames.removeLast();

        VanCanDecoder.Heartbeat heartbeat = VanCanDecoder.decodeHeartbeat(frame);
        if (heartbeat != null) state.heartbeat = heartbeat;
        VanCanDecoder.CoolantReading coolant = VanCanDecoder.decodeCoolant(frame);
        if (coolant != null) {
            if (frame.canId == VanCanDecoder.COOLANT_OUTLET_ID) state.coolant = coolant;
            else state.coolantPost = coolant;
        }
        refresh();
    }

    private void discoverAndConnect(boolean userRequested) {
        UsbDevice found = null;
        for (UsbDevice device : usbManager.getDeviceList().values()) {
            if (GsUsbCanAdapter.isSupported(device)) {
                found = device;
                break;
            }
        }
        if (found == null) {
            state.connectionText = "U2C not detected";
            refresh();
            if (userRequested) toast("Connect the U2C through a USB-C host/OTG adapter");
            return;
        }
        if (usbManager.hasPermission(found)) {
            connect(found);
            return;
        }
        if (state.permissionPending) return;
        state.permissionPending = true;
        state.connectionText = "USB permission required";
        PendingIntent permission = PendingIntent.getBroadcast(this, 0,
                new Intent(ACTION_USB_PERMISSION).setPackage(getPackageName()),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        usbManager.requestPermission(found, permission);
        refresh();
    }

    private void connect(UsbDevice device) {
        state.connectionText = "Opening U2C " + GsUsbCanAdapter.identity(device);
        state.usbConnected = true;
        state.trafficRecent = false;
        state.totalFrames = 0;
        state.recentFrames.clear();
        state.coolant = null;
        state.coolantPost = null;
        state.heartbeat = null;
        frameTimes.clear();
        adapter.start(device);
        refresh();
    }

    private void registerUsbReceiver() {
        IntentFilter filter = new IntentFilter(ACTION_USB_PERMISSION);
        filter.addAction(UsbManager.ACTION_USB_DEVICE_DETACHED);
        // This flagged overload exists on our minimum API (26); the constant is
        // compile-time inlined and protects the private permission callback.
        registerReceiver(usbReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        receiverRegistered = true;
    }

    @SuppressWarnings("deprecation")
    private static UsbDevice usbExtra(Intent intent) {
        if (Build.VERSION.SDK_INT >= 33) {
            return intent.getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice.class);
        }
        return intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
    }

    private void refresh() {
        dashboard.setState(state);
    }

    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show();
    }
}
