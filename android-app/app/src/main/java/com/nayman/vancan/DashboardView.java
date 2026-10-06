package com.nayman.vancan;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.os.SystemClock;
import android.view.MotionEvent;
import android.view.View;

import com.nayman.vancan.protocol.CanFrame;
import com.nayman.vancan.protocol.VanCanDecoder;

import java.util.Locale;

/** A responsive, distraction-minimized dashboard for phone and wide head-unit screens. */
public final class DashboardView extends View {
    private static final int BACKGROUND = Color.rgb(6, 15, 23);
    private static final int CARD = Color.rgb(13, 29, 39);
    private static final int CARD_EDGE = Color.rgb(28, 52, 64);
    private static final int PRIMARY = Color.rgb(234, 247, 243);
    private static final int MUTED = Color.rgb(132, 158, 168);
    private static final int ACCENT = Color.rgb(66, 232, 180);
    private static final int AMBER = Color.rgb(255, 184, 77);
    private static final int DANGER = Color.rgb(255, 99, 113);

    public interface Actions {
        void onConnectPressed();
        void onLogPressed();
        void onExportPressed();
    }

    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint stroke = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final RectF connectButton = new RectF();
    private final RectF logButton = new RectF();
    private final RectF exportButton = new RectF();
    private final float density;
    private final Typeface sans = Typeface.create("sans", Typeface.NORMAL);
    private final Typeface sansMedium = Typeface.create("sans", Typeface.BOLD);
    private final Typeface mono = Typeface.create("monospace", Typeface.NORMAL);
    private DashboardState state = new DashboardState();
    private Actions actions;
    private RectF pressedButton;
    private boolean wideLayout;

    public DashboardView(Context context) {
        super(context);
        density = getResources().getDisplayMetrics().density;
        stroke.setStyle(Paint.Style.STROKE);
        stroke.setStrokeCap(Paint.Cap.ROUND);
        setBackgroundColor(BACKGROUND);
        setKeepScreenOn(true);
    }

    public void setActions(Actions actions) {
        this.actions = actions;
    }

    public void setState(DashboardState state) {
        this.state = state;
        invalidate();
    }

    @Override
    protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
        int width = MeasureSpec.getSize(widthMeasureSpec);
        boolean landscape = getResources().getConfiguration().orientation
                == android.content.res.Configuration.ORIENTATION_LANDSCAPE;
        wideLayout = landscape && width >= dp(600);
        // Scroll on small windows rather than compressing text into other rows.
        int minimumHeight = Math.round(dp(wideLayout ? 390 : 780));
        setMeasuredDimension(width, resolveSize(minimumHeight, heightMeasureSpec));
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        if (wideLayout) drawWide(canvas); else drawPortrait(canvas);
    }

    private void drawWide(Canvas canvas) {
        float w = getWidth();
        float h = getHeight();
        float p = dp(18);
        float header = dp(90);
        float gap = dp(12);

        drawHeader(canvas, p, w, header, true);
        float bodyTop = header + gap;
        float leftWidth = w * 0.53f;
        RectF coolant = new RectF(p, bodyTop, leftWidth, h - p);
        RectF system = new RectF(leftWidth + gap, bodyTop, w - p, bodyTop + (h - bodyTop - p) * 0.45f);
        RectF raw = new RectF(leftWidth + gap, system.bottom + gap, w - p, h - p);
        drawCoolant(canvas, coolant, true);
        drawSystem(canvas, system);
        drawRawFrames(canvas, raw);
    }

    private void drawPortrait(Canvas canvas) {
        float w = getWidth();
        float h = getHeight();
        float p = dp(16);
        float header = dp(104);
        float footer = dp(80);
        float gap = dp(14);

        drawHeader(canvas, p, w, header, false);
        float bodyTop = header + gap;
        float coolantHeight = Math.max(dp(296), Math.min(dp(360), h * 0.34f));
        RectF coolant = new RectF(p, bodyTop, w - p, bodyTop + coolantHeight);
        RectF system = new RectF(p, coolant.bottom + gap, w - p,
                coolant.bottom + gap + dp(128));
        RectF raw = new RectF(p, system.bottom + gap, w - p, h - footer - gap);
        drawCoolant(canvas, coolant, false);
        drawSystem(canvas, system);
        drawRawFrames(canvas, raw);
        drawBottomButtons(canvas, p, w, h, footer);
    }

    private void drawHeader(Canvas canvas, float p, float w, float header, boolean withButtons) {
        text(canvas, "VAN", p, dp(34), dp(26), PRIMARY, sansMedium);
        text(canvas, "CAN", p + dp(57), dp(34), dp(26), ACCENT, sansMedium);
        text(canvas, "ENGINE TELEMETRY", p, dp(56), dp(12), MUTED, sansMedium);

        int stateColor = state.usbConnected ? (state.trafficRecent ? ACCENT : AMBER) : DANGER;
        float statusX = p + dp(5);
        float statusY = dp(86);
        paint.setColor(stateColor);
        canvas.drawCircle(statusX, statusY - dp(3), dp(4), paint);
        textClipped(canvas, statusLabel(), statusX + dp(13), statusY,
                w - p, dp(13), PRIMARY, sansMedium);

        if (withButtons) {
            float buttonH = dp(48);
            float buttonW = Math.min(dp(108), (w - p * 2 - dp(180)) / 3f);
            float gap = dp(8);
            float y = dp(12);
            exportButton.set(w - p - buttonW, y, w - p, y + buttonH);
            logButton.set(exportButton.left - gap - buttonW, y, exportButton.left - gap, y + buttonH);
            connectButton.set(logButton.left - gap - buttonW, y, logButton.left - gap, y + buttonH);
            drawButton(canvas, connectButton, state.usbConnected ? "DISCONNECT" : "CONNECT", false);
            drawButton(canvas, logButton, state.logging ? "STOP LOG" : "START LOG", state.logging);
            drawButton(canvas, exportButton, "EXPORT", false);
        }
    }

    private String statusLabel() {
        if (!state.usbConnected) return state.connectionText.toUpperCase(Locale.US);
        if (!state.trafficRecent) return "U2C ONLINE · WAITING FOR CAN";
        return "CAN ONLINE · 500 KBIT/S";
    }

    private void drawBottomButtons(Canvas canvas, float p, float w, float h, float footer) {
        float gap = dp(8);
        float top = h - footer + dp(10);
        float bottom = h - dp(14);
        float width = (w - p * 2 - gap * 2) / 3f;
        connectButton.set(p, top, p + width, bottom);
        logButton.set(connectButton.right + gap, top, connectButton.right + gap + width, bottom);
        exportButton.set(logButton.right + gap, top, w - p, bottom);
        drawButton(canvas, connectButton, state.usbConnected ? "DISCONNECT" : "CONNECT", false);
        drawButton(canvas, logButton, state.logging ? "STOP LOG" : "START LOG", state.logging);
        drawButton(canvas, exportButton, "EXPORT", false);
    }

    private void drawButton(Canvas canvas, RectF bounds, String label, boolean active) {
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(active ? ACCENT : Color.rgb(20, 41, 51));
        canvas.drawRoundRect(bounds, dp(9), dp(9), paint);
        stroke.setColor(active ? ACCENT : CARD_EDGE);
        stroke.setStrokeWidth(dp(1));
        canvas.drawRoundRect(bounds, dp(9), dp(9), stroke);
        float size = Math.min(dp(12), dp(12) * (bounds.width() - dp(12))
                / Math.max(1, measure(label, dp(12), sansMedium)));
        float width = measure(label, size, sansMedium);
        text(canvas, label, bounds.centerX() - width / 2, bounds.centerY() + dp(4),
                size, active ? BACKGROUND : PRIMARY, sansMedium);
    }

    private void drawCoolant(Canvas canvas, RectF bounds, boolean wide) {
        if (!wide) {
            drawPhoneCoolant(canvas, bounds);
            return;
        }
        card(canvas, bounds);
        float p = dp(wide ? 22 : 16);
        text(canvas, "COOLANT OUTLET", bounds.left + p, bounds.top + p + dp(3), dp(12), MUTED, sansMedium);
        String id = "CAN 0x110";
        text(canvas, id, bounds.right - p - measure(id, dp(10), mono), bounds.top + p + dp(2),
                dp(10), MUTED, mono);

        VanCanDecoder.CoolantReading reading = state.coolant;
        boolean fresh = reading != null && SystemClock.elapsedRealtime() - reading.receivedAtMillis < 1_500;
        boolean valid = fresh && reading.valid;
        String main = valid ? String.format(Locale.US, "%.1f°", reading.fahrenheit) : "--.-°";
        float mainSize = wide ? dp(58) : Math.min(dp(54), bounds.height() * 0.25f);
        float baseline = bounds.top + bounds.height() * (wide ? 0.47f : 0.42f);
        text(canvas, main, bounds.left + p, baseline, mainSize, valid ? PRIMARY : MUTED, sansMedium);
        text(canvas, "F", bounds.left + p + measure(main, mainSize, sansMedium) + dp(5),
                baseline - dp(4), dp(20), MUTED, sansMedium);

        String secondary = valid ? String.format(Locale.US, "%.1f °C", reading.celsius) : "NO VALID READING";
        text(canvas, secondary, bounds.left + p + dp(3), baseline + dp(27), dp(15), MUTED, sans);

        float gaugeLeft = wide ? bounds.left + bounds.width() * 0.62f : bounds.left + p;
        float gaugeRight = bounds.right - p;
        float gaugeY = wide ? bounds.centerY() + dp(14) : bounds.bottom - dp(66);
        drawGauge(canvas, gaugeLeft, gaugeRight, gaugeY, valid ? reading.fahrenheit : Double.NaN);

        String sensor = !fresh ? "STALE / NO DATA"
                : VanCanDecoder.sensorStatusText(reading.status);
        int sensorColor = !fresh ? AMBER : (reading.valid ? ACCENT : DANGER);
        textClipped(canvas, sensor, bounds.left + p, bounds.bottom - dp(46),
                bounds.right - p, dp(11), sensorColor, sansMedium);

        if (reading != null) {
            String details = String.format(Locale.US, "ADC %d  ·  %.3f V  ·  SEQ %d",
                    reading.adcRaw, reading.voltage, reading.sequence);
            textClipped(canvas, details, bounds.left + p, bounds.bottom - dp(22),
                    bounds.right - p, dp(10), MUTED, mono);
        }
    }

    private void drawPhoneCoolant(Canvas canvas, RectF bounds) {
        card(canvas, bounds);
        float left = bounds.left + dp(20);
        float right = bounds.right - dp(20);
        text(canvas, "COOLANT OUTLET", left, bounds.top + dp(30), dp(14), MUTED, sansMedium);

        VanCanDecoder.CoolantReading reading = state.coolant;
        boolean fresh = reading != null && SystemClock.elapsedRealtime() - reading.receivedAtMillis < 1_500;
        boolean valid = fresh && reading.valid;
        String main = valid ? String.format(Locale.US, "%.1f°", reading.fahrenheit) : "--.-°";
        float size = Math.min(dp(88), dp(88) * (right - left - dp(30))
                / measure(main, dp(88), sansMedium));
        float valueWidth = measure(main, size, sansMedium);
        float valueLeft = bounds.centerX() - (valueWidth + dp(27)) / 2;
        float baseline = bounds.top + dp(132);
        text(canvas, main, valueLeft, baseline, size, valid ? PRIMARY : MUTED, sansMedium);
        text(canvas, "F", valueLeft + valueWidth + dp(5), baseline - dp(4), dp(23), MUTED, sansMedium);
        String secondary = valid ? String.format(Locale.US, "%.1f °C", reading.celsius) : "NO VALID READING";
        text(canvas, secondary, bounds.centerX() - measure(secondary, dp(18), sans) / 2,
                baseline + dp(30), dp(18), MUTED, sans);

        drawGauge(canvas, left, right, bounds.bottom - dp(102), valid ? reading.fahrenheit : Double.NaN);
        String status = !fresh ? "STALE / NO DATA" : !reading.valid && reading.status == 0
                ? "INVALID READING" : VanCanDecoder.sensorStatusText(reading.status);
        textClipped(canvas, status, left, bounds.bottom - dp(48), right,
                dp(13), !fresh ? AMBER : valid ? ACCENT : DANGER, sansMedium);
        String details = reading == null ? "Waiting for coolant sensor · 0x110"
                : String.format(Locale.US, "ADC %d  ·  %.3f V  ·  SEQ %d",
                reading.adcRaw, reading.voltage, reading.sequence);
        textClipped(canvas, details, left, bounds.bottom - dp(21), right, dp(12), MUTED, mono);
    }

    private void drawGauge(Canvas canvas, float left, float right, float y, double temperatureF) {
        stroke.setStrokeWidth(dp(8));
        stroke.setColor(Color.rgb(28, 49, 58));
        canvas.drawLine(left, y, right, y, stroke);
        if (!Double.isNaN(temperatureF)) {
            float ratio = (float) Math.max(0, Math.min(1, (temperatureF - 32.0) / 218.0));
            stroke.setColor(temperatureF >= 220 ? DANGER : temperatureF >= 205 ? AMBER : ACCENT);
            canvas.drawLine(left, y, left + (right - left) * ratio, y, stroke);
        }
        text(canvas, "32", left, y + dp(23), dp(9), MUTED, mono);
        String hot = "250 °F";
        text(canvas, hot, right - measure(hot, dp(9), mono), y + dp(23), dp(9), MUTED, mono);
    }

    private void drawSystem(Canvas canvas, RectF bounds) {
        card(canvas, bounds);
        float p = dp(14);
        text(canvas, "ENGINE NODE", bounds.left + p, bounds.top + dp(27), dp(13), MUTED, sansMedium);
        boolean heartbeatFresh = state.heartbeat != null
                && SystemClock.elapsedRealtime() - state.heartbeat.receivedAtMillis < 2_000;
        String online = heartbeatFresh ? "ONLINE" : "OFFLINE";
        text(canvas, online, bounds.right - p - measure(online, dp(12), sansMedium),
                bounds.top + dp(27), dp(12), heartbeatFresh ? ACCENT : AMBER, sansMedium);

        String uptime = state.heartbeat == null ? "--:--:--" : formatUptime(state.heartbeat.uptimeMillis);
        String seq = state.heartbeat == null ? "--" : Integer.toString(state.heartbeat.sequence);
        float line = bounds.top + Math.min(dp(72), bounds.height() * 0.62f);
        text(canvas, "UPTIME", bounds.left + p, line, dp(12), MUTED, sansMedium);
        text(canvas, uptime, bounds.left + dp(86), line, dp(22), PRIMARY, mono);
        String frames = String.format(Locale.US, "%d FRAMES  ·  %d FPS  ·  HB %s",
                state.totalFrames, state.framesPerSecond, seq);
        textClipped(canvas, frames, bounds.left + p, bounds.bottom - dp(17),
                bounds.right - p, dp(11), MUTED, mono);
    }

    private void drawRawFrames(Canvas canvas, RectF bounds) {
        card(canvas, bounds);
        float p = dp(14);
        text(canvas, "RAW CAN", bounds.left + p, bounds.top + dp(26), dp(13), MUTED, sansMedium);
        String mode = state.logging ? "● RECORDING" : "MONITOR";
        text(canvas, mode, bounds.right - p - measure(mode, dp(11), sansMedium),
                bounds.top + dp(26), dp(11), state.logging ? DANGER : MUTED, sansMedium);

        float y = bounds.top + dp(53);
        float row = dp(25);
        int capacity = Math.max(0, 1 + (int) Math.floor((bounds.bottom - y - dp(12)) / row));
        int shown = 0;
        for (CanFrame frame : state.recentFrames) {
            if (shown >= capacity) break;
            shown++;
            String flags = frame.error ? " ERR" : frame.remote ? " RTR" : "";
            String line = String.format(Locale.US, "%s  [%d]  %s%s",
                    frame.idText(), frame.data.length, frame.dataHex(), flags);
            textClipped(canvas, line, bounds.left + p, y, bounds.right - p, dp(12),
                    frame.error ? DANGER : PRIMARY, mono);
            y += row;
        }
        if (shown == 0 && capacity > 0) text(canvas, "Waiting for frames…", bounds.left + p, y, dp(12), MUTED, mono);
    }

    private static String formatUptime(long millis) {
        long totalSeconds = millis / 1_000;
        long hours = totalSeconds / 3_600;
        long minutes = (totalSeconds % 3_600) / 60;
        long seconds = totalSeconds % 60;
        return String.format(Locale.US, "%02d:%02d:%02d", hours, minutes, seconds);
    }

    private void card(Canvas canvas, RectF bounds) {
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(CARD);
        canvas.drawRoundRect(bounds, dp(14), dp(14), paint);
        stroke.setColor(CARD_EDGE);
        stroke.setStrokeWidth(dp(1));
        canvas.drawRoundRect(bounds, dp(14), dp(14), stroke);
    }

    private void text(Canvas canvas, String value, float x, float baseline,
                      float size, int color, Typeface typeface) {
        paint.setStyle(Paint.Style.FILL);
        paint.setTypeface(typeface);
        paint.setTextSize(size);
        paint.setColor(color);
        canvas.drawText(value, x, baseline, paint);
    }

    private void textClipped(Canvas canvas, String value, float x, float baseline, float right,
                             float size, int color, Typeface typeface) {
        String clipped = value;
        if (measure(value, size, typeface) > right - x) {
            while (!clipped.isEmpty() && measure(clipped + "…", size, typeface) > right - x) {
                clipped = clipped.substring(0, clipped.length() - 1);
            }
            clipped += "…";
        }
        canvas.save();
        canvas.clipRect(x, baseline - size * 1.5f, right, baseline + size);
        text(canvas, clipped, x, baseline, size, color, typeface);
        canvas.restore();
    }

    private float measure(String value, float size, Typeface typeface) {
        paint.setTypeface(typeface);
        paint.setTextSize(size);
        return paint.measureText(value);
    }

    private float dp(float value) {
        return value * density;
    }

    @Override
    public boolean onTouchEvent(MotionEvent event) {
        if (event.getAction() == MotionEvent.ACTION_DOWN) {
            float x = event.getX();
            float y = event.getY();
            pressedButton = connectButton.contains(x, y) ? connectButton
                    : logButton.contains(x, y) ? logButton
                    : exportButton.contains(x, y) ? exportButton : null;
            return true;
        }
        if (event.getAction() == MotionEvent.ACTION_CANCEL) {
            pressedButton = null;
            return true;
        }
        if (event.getAction() != MotionEvent.ACTION_UP) return true;
        RectF selected = pressedButton;
        pressedButton = null;
        if (selected == null || !selected.contains(event.getX(), event.getY())) return true;
        performClick();
        if (actions == null) return true;
        if (selected == connectButton) actions.onConnectPressed();
        else if (selected == logButton) actions.onLogPressed();
        else if (selected == exportButton) actions.onExportPressed();
        return true;
    }

    @Override
    public boolean performClick() {
        super.performClick();
        return true;
    }
}
