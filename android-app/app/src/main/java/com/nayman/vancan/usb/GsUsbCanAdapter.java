package com.nayman.vancan.usb;

import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.os.SystemClock;

import com.nayman.vancan.protocol.CanFrame;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Minimal Android USB Host implementation of the mainline GS_USB protocol.
 *
 * The adapter is placed in normal CAN mode so it supplies the ACK required by
 * a two-node bus. This class never submits a CAN transmit frame.
 */
public final class GsUsbCanAdapter {
    public static final int BITRATE = 500_000;

    private static final int GS_USB_VENDOR = 0x1d50;
    private static final int GS_USB_PRODUCT = 0x606f;
    private static final int CANDLELIGHT_VENDOR = 0x1209;
    private static final int CANDLELIGHT_PRODUCT = 0x2323;

    private static final int REQUEST_TYPE_OUT = 0x41;
    private static final int REQUEST_TYPE_IN = 0xc1;
    private static final int BREQ_HOST_FORMAT = 0;
    private static final int BREQ_BITTIMING = 1;
    private static final int BREQ_MODE = 2;
    private static final int BREQ_BT_CONST = 4;
    private static final int BREQ_DEVICE_CONFIG = 5;
    private static final int MODE_RESET = 0;
    private static final int MODE_START = 1;
    private static final int CONTROL_TIMEOUT_MS = 1_000;
    private static final int RX_TIMEOUT_MS = 250;
    private static final int CLASSIC_FRAME_SIZE = 20;

    private static final long CAN_EFF_FLAG = 0x80000000L;
    private static final long CAN_RTR_FLAG = 0x40000000L;
    private static final long CAN_ERR_FLAG = 0x20000000L;
    private static final long CAN_EFF_MASK = 0x1fffffffL;
    private static final long CAN_SFF_MASK = 0x000007ffL;

    public interface Listener {
        void onStatus(String message);
        void onFrame(CanFrame frame);
        void onStopped(String reason, boolean error);
    }

    private final UsbManager usbManager;
    private final Listener listener;
    private final AtomicBoolean running = new AtomicBoolean(false);
    private Thread worker;
    private UsbDeviceConnection connection;
    private UsbInterface usbInterface;

    public GsUsbCanAdapter(UsbManager usbManager, Listener listener) {
        this.usbManager = usbManager;
        this.listener = listener;
    }

    public static boolean isSupported(UsbDevice device) {
        int vid = device.getVendorId();
        int pid = device.getProductId();
        return (vid == GS_USB_VENDOR && pid == GS_USB_PRODUCT)
                || (vid == CANDLELIGHT_VENDOR && pid == CANDLELIGHT_PRODUCT);
    }

    public static String identity(UsbDevice device) {
        return String.format(Locale.US, "%04X:%04X", device.getVendorId(), device.getProductId());
    }

    public synchronized void start(UsbDevice device) {
        stop();
        running.set(true);
        worker = new Thread(() -> runAdapter(device), "gs-usb-reader");
        worker.start();
    }

    public synchronized void stop() {
        running.set(false);
        UsbDeviceConnection active = connection;
        if (active != null) {
            try {
                sendMode(active, MODE_RESET, 0);
            } catch (RuntimeException ignored) {
                // Device removal commonly makes the reset transfer fail.
            }
            active.close();
        }
        connection = null;
        usbInterface = null;
        Thread activeWorker = worker;
        worker = null;
        if (activeWorker != null && activeWorker != Thread.currentThread()) {
            activeWorker.interrupt();
        }
    }

    public boolean isRunning() {
        return running.get();
    }

    private void runAdapter(UsbDevice device) {
        String failure = "USB connection closed";
        boolean error = false;
        try {
            InterfaceEndpoints endpoints = findInterface(device);
            if (endpoints == null) {
                throw new IllegalStateException("No GS_USB bulk interface found");
            }

            UsbDeviceConnection opened = usbManager.openDevice(device);
            if (opened == null) throw new IllegalStateException("Unable to open U2C");
            connection = opened;
            usbInterface = endpoints.usbInterface;
            if (!opened.claimInterface(endpoints.usbInterface, true)) {
                throw new IllegalStateException("Unable to claim U2C USB interface");
            }

            listener.onStatus("Configuring " + identity(device));
            configure(opened);
            listener.onStatus("CAN online · 500 kbit/s");
            readFrames(opened, endpoints.bulkIn);
        } catch (Throwable problem) {
            if (running.get()) {
                failure = problem.getMessage() == null
                        ? problem.getClass().getSimpleName() : problem.getMessage();
                error = true;
            }
        } finally {
            running.set(false);
            UsbDeviceConnection active = connection;
            if (active != null) {
                try {
                    if (usbInterface != null) active.releaseInterface(usbInterface);
                } catch (RuntimeException ignored) {
                }
                active.close();
            }
            connection = null;
            usbInterface = null;
            listener.onStopped(failure, error);
        }
    }

    private void configure(UsbDeviceConnection active) {
        requireOut(active, BREQ_HOST_FORMAT, ints(0x0000beef), "host format");

        // This also confirms the adapter answers the expected GS_USB requests.
        byte[] config = controlIn(active, BREQ_DEVICE_CONFIG, 12);
        if (config.length < 12) throw new IllegalStateException("Short GS_USB device config");

        byte[] constants = controlIn(active, BREQ_BT_CONST, 40);
        BitTiming timing = chooseBitTiming(constants, BITRATE);

        requireOut(active, BREQ_MODE, ints(MODE_RESET, 0), "CAN reset");
        requireOut(active, BREQ_BITTIMING,
                ints(timing.propSeg, timing.phaseSeg1, timing.phaseSeg2, timing.sjw, timing.brp),
                "CAN bit timing");

        // Flags deliberately remain zero. Listen-only would not ACK the Nucleo.
        requireOut(active, BREQ_MODE, ints(MODE_START, 0), "CAN start");
    }

    private void readFrames(UsbDeviceConnection active, UsbEndpoint bulkIn) {
        int transferSize = Math.max(CLASSIC_FRAME_SIZE, bulkIn.getMaxPacketSize());
        byte[] transfer = new byte[transferSize];
        while (running.get()) {
            int count = active.bulkTransfer(bulkIn, transfer, transfer.length, RX_TIMEOUT_MS);
            if (count < 0) continue; // Android reports timeout as -1.
            if (count == 0) continue;
            if (count % CLASSIC_FRAME_SIZE != 0) {
                throw new IllegalStateException("Unexpected GS_USB frame size: " + count);
            }
            for (int offset = 0; offset < count; offset += CLASSIC_FRAME_SIZE) {
                CanFrame frame = decodeFrame(transfer, offset);
                if (frame != null) listener.onFrame(frame);
            }
        }
    }

    private static CanFrame decodeFrame(byte[] bytes, int offset) {
        ByteBuffer frame = ByteBuffer.wrap(bytes, offset, CLASSIC_FRAME_SIZE)
                .order(ByteOrder.LITTLE_ENDIAN);
        long echoId = Integer.toUnsignedLong(frame.getInt());
        long rawId = Integer.toUnsignedLong(frame.getInt());
        int dlc = frame.get() & 0xff;
        frame.get(); // channel
        frame.get(); // GS_USB frame flags
        frame.get(); // reserved

        byte[] payload = new byte[8];
        frame.get(payload);
        if (echoId != 0xffffffffL) return null; // Ignore transmit echoes defensively.

        boolean extended = (rawId & CAN_EFF_FLAG) != 0;
        boolean remote = (rawId & CAN_RTR_FLAG) != 0;
        boolean error = (rawId & CAN_ERR_FLAG) != 0;
        int id = (int) (rawId & (extended ? CAN_EFF_MASK : CAN_SFF_MASK));
        int payloadLength = Math.min(dlc, 8);
        byte[] data = new byte[payloadLength];
        System.arraycopy(payload, 0, data, 0, payloadLength);
        return new CanFrame(SystemClock.elapsedRealtime(), id, extended, remote, error, data);
    }

    private static BitTiming chooseBitTiming(byte[] response, int targetBitrate) {
        if (response.length < 40) throw new IllegalStateException("Short GS_USB timing response");
        ByteBuffer values = ByteBuffer.wrap(response).order(ByteOrder.LITTLE_ENDIAN);
        values.getInt(); // feature flags
        long clock = Integer.toUnsignedLong(values.getInt());
        int tseg1Min = positive(values.getInt(), 1);
        int tseg1Max = positive(values.getInt(), 16);
        int tseg2Min = positive(values.getInt(), 1);
        int tseg2Max = positive(values.getInt(), 8);
        int sjwMax = positive(values.getInt(), 4);
        int brpMin = positive(values.getInt(), 1);
        int brpMax = positive(values.getInt(), 1024);
        int brpInc = positive(values.getInt(), 1);

        BitTiming best = null;
        double bestScore = Double.MAX_VALUE;
        for (int brp = brpMin; brp <= brpMax; brp += brpInc) {
            for (int tseg1 = tseg1Min; tseg1 <= tseg1Max; tseg1++) {
                for (int tseg2 = tseg2Min; tseg2 <= tseg2Max; tseg2++) {
                    int totalTq = 1 + tseg1 + tseg2;
                    double actualBitrate = clock / (double) (brp * totalTq);
                    double bitrateError = Math.abs(actualBitrate - targetBitrate) / targetBitrate;
                    double samplePoint = (1.0 + tseg1) / totalTq;
                    double sampleError = Math.abs(samplePoint - 0.875);
                    double score = bitrateError * 100.0 + sampleError;
                    if (score < bestScore) {
                        int prop = tseg1 > 1 ? 1 : 0;
                        best = new BitTiming(prop, tseg1 - prop, tseg2,
                                Math.min(1, sjwMax), brp, bitrateError);
                        bestScore = score;
                    }
                }
            }
        }
        if (best == null || best.bitrateError > 0.005) {
            throw new IllegalStateException("U2C cannot produce 500 kbit/s timing");
        }
        return best;
    }

    private static int positive(int value, int fallback) {
        return value > 0 ? value : fallback;
    }

    private static void sendMode(UsbDeviceConnection active, int mode, int flags) {
        requireOut(active, BREQ_MODE, ints(mode, flags), "CAN mode");
    }

    private static void requireOut(UsbDeviceConnection active, int request,
                                   byte[] value, String operation) {
        int transferred = active.controlTransfer(REQUEST_TYPE_OUT, request, 0, 0,
                value, value.length, CONTROL_TIMEOUT_MS);
        if (transferred != value.length) {
            throw new IllegalStateException(operation + " failed (USB " + transferred + ")");
        }
    }

    private static byte[] controlIn(UsbDeviceConnection active, int request, int length) {
        byte[] value = new byte[length];
        int transferred = active.controlTransfer(REQUEST_TYPE_IN, request, 0, 0,
                value, value.length, CONTROL_TIMEOUT_MS);
        if (transferred < 0) {
            throw new IllegalStateException("GS_USB request " + request + " failed");
        }
        if (transferred == value.length) return value;
        byte[] shortened = new byte[transferred];
        System.arraycopy(value, 0, shortened, 0, transferred);
        return shortened;
    }

    private static byte[] ints(int... values) {
        ByteBuffer bytes = ByteBuffer.allocate(values.length * 4).order(ByteOrder.LITTLE_ENDIAN);
        for (int value : values) bytes.putInt(value);
        return bytes.array();
    }

    private static InterfaceEndpoints findInterface(UsbDevice device) {
        for (int i = 0; i < device.getInterfaceCount(); i++) {
            UsbInterface candidate = device.getInterface(i);
            UsbEndpoint in = null;
            UsbEndpoint out = null;
            for (int e = 0; e < candidate.getEndpointCount(); e++) {
                UsbEndpoint endpoint = candidate.getEndpoint(e);
                if (endpoint.getType() != UsbConstants.USB_ENDPOINT_XFER_BULK) continue;
                if (endpoint.getDirection() == UsbConstants.USB_DIR_IN) in = endpoint;
                if (endpoint.getDirection() == UsbConstants.USB_DIR_OUT) out = endpoint;
            }
            if (in != null && out != null) return new InterfaceEndpoints(candidate, in, out);
        }
        return null;
    }

    private static final class InterfaceEndpoints {
        final UsbInterface usbInterface;
        final UsbEndpoint bulkIn;
        @SuppressWarnings("unused") final UsbEndpoint bulkOut;

        InterfaceEndpoints(UsbInterface usbInterface, UsbEndpoint bulkIn, UsbEndpoint bulkOut) {
            this.usbInterface = usbInterface;
            this.bulkIn = bulkIn;
            this.bulkOut = bulkOut;
        }
    }

    private static final class BitTiming {
        final int propSeg;
        final int phaseSeg1;
        final int phaseSeg2;
        final int sjw;
        final int brp;
        final double bitrateError;

        BitTiming(int propSeg, int phaseSeg1, int phaseSeg2, int sjw,
                  int brp, double bitrateError) {
            this.propSeg = propSeg;
            this.phaseSeg1 = phaseSeg1;
            this.phaseSeg2 = phaseSeg2;
            this.sjw = sjw;
            this.brp = brp;
            this.bitrateError = bitrateError;
        }
    }
}
