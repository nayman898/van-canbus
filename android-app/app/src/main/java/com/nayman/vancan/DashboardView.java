package com.nayman.vancan;

import android.app.AlertDialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.os.SystemClock;
import android.view.View;
import android.view.accessibility.AccessibilityEvent;
import android.widget.Button;
import android.widget.GridLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.nayman.vancan.protocol.CanFrame;
import com.nayman.vancan.protocol.VanCanDecoder;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Native layout controls around independently rendered, reorderable telemetry cards. */
public final class DashboardView extends LinearLayout {
    private static final int BACKGROUND = Color.rgb(6, 15, 23);
    private static final int CARD = Color.rgb(13, 29, 39);
    private static final int CARD_EDGE = Color.rgb(28, 52, 64);
    private static final int PRIMARY = Color.rgb(234, 247, 243);
    private static final int MUTED = Color.rgb(132, 158, 168);
    private static final int ACCENT = Color.rgb(66, 232, 180);
    private static final int AMBER = Color.rgb(255, 184, 77);
    private static final int DANGER = Color.rgb(255, 99, 113);
    private static final String LAYOUT_KEY = "visible_cards_v1";

    public interface Actions {
        void onConnectPressed();
        void onLogPressed();
        void onExportPressed();
    }

    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint stroke = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final float density;
    private final Typeface sans = Typeface.create("sans", Typeface.NORMAL);
    private final Typeface sansMedium = Typeface.create("sans", Typeface.BOLD);
    private final Typeface mono = Typeface.create("monospace", Typeface.NORMAL);
    private final SharedPreferences preferences;
    private final DashboardLayout layout;
    private final GridLayout cards;
    private final LinearLayout layoutControls;
    private final TextView connection;
    private final Button connect;
    private final Button log;
    private final List<View> cardViews = new ArrayList<>();
    private DashboardState state = new DashboardState();
    private Actions actions;
    private boolean editing;
    private int columns = 1;
    private AlertDialog addDialog;

    public DashboardView(Context context) {
        super(context);
        density = getResources().getDisplayMetrics().density;
        preferences = context.getSharedPreferences("dashboard", Context.MODE_PRIVATE);
        layout = new DashboardLayout(preferences.getString(LAYOUT_KEY, null));
        stroke.setStyle(Paint.Style.STROKE);
        stroke.setStrokeCap(Paint.Cap.ROUND);
        setOrientation(VERTICAL);
        setPadding(px(12), px(12), px(12), px(16));
        setBackgroundColor(BACKGROUND);
        setKeepScreenOn(true);

        TextView title = label("VAN CAN", 26, ACCENT);
        title.setTypeface(sansMedium);
        addView(title);
        addView(label("ENGINE TELEMETRY", 12, MUTED));
        connection = label("U2C NOT CONNECTED", 13, PRIMARY);
        connection.setPadding(0, px(12), 0, px(12));
        addView(connection);

        LinearLayout commands = row();
        connect = button("Connect", () -> { if (actions != null) actions.onConnectPressed(); });
        log = button("Start log", () -> { if (actions != null) actions.onLogPressed(); });
        Button export = button("Export", () -> { if (actions != null) actions.onExportPressed(); });
        addWeighted(commands, connect);
        addWeighted(commands, log);
        addWeighted(commands, export);
        addView(commands);

        layoutControls = row();
        layoutControls.setPadding(0, px(10), 0, px(10));
        addView(layoutControls);
        cards = new GridLayout(context);
        cards.setColumnCount(columns);
        cards.setAlignmentMode(GridLayout.ALIGN_BOUNDS);
        addView(cards, new LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT));
        rebuildCards();
    }

    public void setActions(Actions actions) { this.actions = actions; }

    public void setState(DashboardState state) {
        this.state = state;
        String status = !state.usbConnected ? state.connectionText.toUpperCase(Locale.US)
                : state.trafficRecent ? "CAN ONLINE · 500 KBIT/S" : "U2C ONLINE · WAITING FOR CAN";
        connection.setText(status);
        connection.setTextColor(!state.usbConnected ? DANGER : state.trafficRecent ? ACCENT : AMBER);
        connect.setText(state.usbConnected ? "Disconnect" : "Connect");
        log.setText(state.logging ? "Stop log" : "Start log");
        log.setTextColor(state.logging ? ACCENT : PRIMARY);
        for (View card : cardViews) card.invalidate();
    }

    @Override
    protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
        boolean landscape = getResources().getConfiguration().orientation
                == android.content.res.Configuration.ORIENTATION_LANDSCAPE;
        int nextColumns = landscape && MeasureSpec.getSize(widthMeasureSpec) >= px(600) ? 2 : 1;
        if (columns != nextColumns) {
            columns = nextColumns;
            rebuildCards();
        }
        super.onMeasure(widthMeasureSpec, heightMeasureSpec);
    }

    private void rebuildCards() {
        cards.removeAllViews();
        cardViews.clear();
        cards.setColumnCount(columns);
        layoutControls.removeAllViews();
        if (editing) {
            Button add = button("Add card", this::showAddCard);
            add.setEnabled(!layout.hiddenCards().isEmpty());
            add.setAlpha(add.isEnabled() ? 1f : .35f);
            addWeighted(layoutControls, add);
            addWeighted(layoutControls, button("Reset layout", () -> {
                layout.reset();
                saveLayout();
            }));
            addWeighted(layoutControls, button("Done", () -> {
                editing = false;
                rebuildCards();
            }));
        } else {
            addWeighted(layoutControls, button("Edit layout", () -> {
                editing = true;
                rebuildCards();
            }));
        }
        List<DashboardLayout.Card> visible = layout.visibleCards();
        if (visible.isEmpty()) {
            LinearLayout empty = new LinearLayout(getContext());
            empty.setOrientation(VERTICAL);
            empty.setPadding(px(16), px(20), px(16), px(20));
            empty.addView(label("Your dashboard is empty", 20, PRIMARY));
            TextView help = label("Add the sensors you want to monitor.", 14, MUTED);
            help.setPadding(0, px(8), 0, px(12));
            empty.addView(help);
            empty.addView(button("Add card", this::showAddCard));
            GridLayout.LayoutParams params = new GridLayout.LayoutParams(
                    GridLayout.spec(0), GridLayout.spec(0, columns, 1f));
            params.width = 0;
            cards.addView(empty, params);
            return;
        }
        for (int i = 0; i < visible.size(); i++) {
            DashboardLayout.Card card = visible.get(i);
            LinearLayout container = new LinearLayout(getContext());
            container.setOrientation(VERTICAL);
            container.setBackground(background(CARD, CARD_EDGE, 14));
            if (editing) {
                LinearLayout controls = row();
                controls.setPadding(px(6), px(6), px(6), 0);
                Button up = button("↑", () -> {
                    if (layout.move(card, -1)) saveLayout();
                });
                up.setContentDescription("Move " + card.title + " up");
                up.setEnabled(i > 0);
                up.setAlpha(up.isEnabled() ? 1f : .35f);
                Button down = button("↓", () -> {
                    if (layout.move(card, 1)) saveLayout();
                });
                down.setContentDescription("Move " + card.title + " down");
                down.setEnabled(i + 1 < visible.size());
                down.setAlpha(down.isEnabled() ? 1f : .35f);
                Button remove = button("Remove", () -> {
                    if (layout.remove(card)) saveLayout();
                });
                remove.setContentDescription("Remove " + card.title + " from dashboard");
                addWeighted(controls, up);
                addWeighted(controls, down);
                addWeighted(controls, remove);
                container.addView(controls);
            }
            View content = new View(getContext()) {
                private final RectF bounds = new RectF();

                @Override protected void onSizeChanged(int w, int h, int oldw, int oldh) {
                    super.onSizeChanged(w, h, oldw, oldh);
                    bounds.set(0, 0, w, h);
                }

                @Override protected void onDraw(Canvas canvas) {
                    super.onDraw(canvas);
                    switch (card) {
                        case COOLANT_PRE:
                            drawPhoneCoolant(canvas, bounds, state.coolant, "PRE-RADIATOR", "0x110");
                            break;
                        case COOLANT_POST:
                            drawPhoneCoolant(canvas, bounds, state.coolantPost, "POST-RADIATOR", "0x111");
                            break;
                        case FUEL: drawFuel(canvas, bounds); break;
                        case ENGINE: drawSystem(canvas, bounds); break;
                        case RAW: drawRawFrames(canvas, bounds); break;
                    }
                }
            };
            content.setContentDescription(card.title);
            content.setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_YES);
            cardViews.add(content);
            container.addView(content, new LayoutParams(LayoutParams.MATCH_PARENT, px(card.heightDp)));
            GridLayout.LayoutParams params = new GridLayout.LayoutParams(
                    GridLayout.spec(i / columns, GridLayout.TOP), GridLayout.spec(i % columns, 1f));
            params.width = 0;
            params.height = LayoutParams.WRAP_CONTENT;
            params.setMargins(px(4), px(4), px(4), px(8));
            cards.addView(container, params);
        }
    }

    private void saveLayout() {
        preferences.edit().putString(LAYOUT_KEY, layout.serialize()).apply();
        rebuildCards();
        sendAccessibilityEvent(AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED);
    }

    private void showAddCard() {
        List<DashboardLayout.Card> hidden = layout.hiddenCards();
        if (hidden.isEmpty()) return;
        String[] titles = new String[hidden.size()];
        for (int i = 0; i < hidden.size(); i++) titles[i] = hidden.get(i).title;
        addDialog = new AlertDialog.Builder(getContext())
                .setTitle("Add a card")
                .setItems(titles, (dialog, which) -> {
                    if (layout.add(hidden.get(which))) saveLayout();
                })
                .setNegativeButton("Cancel", null)
                .create();
        addDialog.setOnDismissListener(dialog -> addDialog = null);
        addDialog.show();
    }

    @Override protected void onDetachedFromWindow() {
        if (addDialog != null) addDialog.dismiss();
        super.onDetachedFromWindow();
    }

    private LinearLayout row() {
        LinearLayout row = new LinearLayout(getContext());
        row.setOrientation(HORIZONTAL);
        return row;
    }

    private void addWeighted(LinearLayout row, View view) {
        LayoutParams params = new LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f);
        params.setMargins(px(3), 0, px(3), 0);
        row.addView(view, params);
    }

    private Button button(String title, Runnable action) {
        Button button = new Button(getContext());
        button.setText(title);
        button.setTextSize(12);
        button.setTextColor(PRIMARY);
        button.setAllCaps(false);
        button.setMinWidth(0);
        button.setMinimumWidth(0);
        button.setMinHeight(px(48));
        button.setMinimumHeight(px(48));
        button.setPadding(px(5), px(8), px(5), px(8));
        button.setBackground(new RippleDrawable(
                ColorStateList.valueOf(Color.argb(60, 66, 232, 180)),
                background(Color.rgb(20, 41, 51), CARD_EDGE, 9), null));
        button.setOnClickListener(view -> action.run());
        return button;
    }

    private TextView label(String title, int size, int color) {
        TextView label = new TextView(getContext());
        label.setText(title);
        label.setTextSize(size);
        label.setTextColor(color);
        return label;
    }

    private GradientDrawable background(int fill, int edge, int radius) {
        GradientDrawable background = new GradientDrawable();
        background.setColor(fill);
        background.setCornerRadius(dp(radius));
        background.setStroke(px(1), edge);
        return background;
    }

    private int px(float value) { return Math.round(dp(value)); }

    private void drawPhoneCoolant(Canvas canvas, RectF bounds,
                                  VanCanDecoder.CoolantReading reading, String label, String canId) {
        float left = bounds.left + dp(20);
        float right = bounds.right - dp(20);
        textClipped(canvas, label, left, bounds.top + dp(25), right, dp(14), MUTED, sansMedium);
        text(canvas, "COOLANT · CAN " + canId, left, bounds.top + dp(43), dp(10), MUTED, mono);

        boolean fresh = state.usbConnected && reading != null
                && SystemClock.elapsedRealtime() - reading.receivedAtMillis < 1_500;
        boolean valid = fresh && reading.valid;
        String main = valid ? String.format(Locale.US, "%.1f°", reading.fahrenheit) : "--.-°";
        float size = Math.min(dp(64), dp(64) * (right - left - dp(30))
                / measure(main, dp(64), sansMedium));
        float valueWidth = measure(main, size, sansMedium);
        float valueLeft = bounds.centerX() - (valueWidth + dp(27)) / 2;
        float baseline = bounds.top + dp(111);
        text(canvas, main, valueLeft, baseline, size, valid ? PRIMARY : MUTED, sansMedium);
        text(canvas, "F", valueLeft + valueWidth + dp(5), baseline - dp(4), dp(23), MUTED, sansMedium);
        String secondary = valid ? String.format(Locale.US, "%.1f °C", reading.celsius) : "NO VALID READING";
        text(canvas, secondary, bounds.centerX() - measure(secondary, dp(18), sans) / 2,
                baseline + dp(24), dp(18), MUTED, sans);

        drawGauge(canvas, left, right, bounds.bottom - dp(86), valid ? reading.fahrenheit : Double.NaN);
        String status = !fresh ? "STALE / NO DATA" : !reading.valid && reading.status == 0
                ? "INVALID READING" : VanCanDecoder.sensorStatusText(reading.status);
        textClipped(canvas, status, left, bounds.bottom - dp(40), right,
                dp(13), !fresh ? AMBER : valid ? ACCENT : DANGER, sansMedium);
        String details = reading == null ? "Waiting for coolant sensor · " + canId
                : String.format(Locale.US, "ADC %d  ·  %.3f V  ·  SEQ %d",
                reading.adcRaw, reading.voltage, reading.sequence);
        textClipped(canvas, details, left, bounds.bottom - dp(21), right, dp(12), MUTED, mono);
    }

    private void drawFuel(Canvas canvas, RectF bounds) {
        float left = bounds.left + dp(20);
        float right = bounds.right - dp(20);
        long now = SystemClock.elapsedRealtime();
        VanCanDecoder.FuelReading reading = state.fuel.reading();
        boolean fresh = state.fuel.fresh(state.usbConnected, now);
        double percent = state.fuel.estimatedPercent(state.usbConnected, now);
        boolean valid = !Double.isNaN(percent);
        text(canvas, "FUEL LEVEL", left, bounds.top + dp(26), dp(14), MUTED, sansMedium);
        textClipped(canvas, "UNCALIBRATED · 10–75 Ω ESTIMATE", left, bounds.top + dp(45), right,
                dp(11), AMBER, sansMedium);
        text(canvas, valid ? String.format(Locale.US, "%.0f%% EST.", percent) : "--%", left,
                bounds.top + dp(95), dp(40), valid ? PRIMARY : MUTED, sansMedium);
        float y = bounds.top + dp(118);
        stroke.setStrokeWidth(dp(8));
        stroke.setColor(CARD_EDGE);
        canvas.drawLine(left, y, right, y, stroke);
        if (valid) {
            stroke.setColor(percent <= 15 ? AMBER : ACCENT);
            canvas.drawLine(left, y, left + (right - left) * (float)percent / 100, y, stroke);
        }
        String status = !fresh ? "STALE / NO DATA" : !reading.valid && reading.status == 0
                ? "INVALID READING" : reading.valid ? "ESTIMATE · NOT TANK CALIBRATED"
                : VanCanDecoder.fuelStatusText(reading.status);
        textClipped(canvas, status, left, bounds.top + dp(145), right, dp(12),
                !fresh || valid ? AMBER : DANGER, sansMedium);
        String resistance = fresh && reading.valid ? String.format(Locale.US, "%.1f Ω", reading.resistanceOhms) : "-- Ω";
        String details = reading == null ? "Waiting for fuel sender · CAN 0x120"
                : String.format(Locale.US, "%s  ·  %.4f V  ·  ADC %d", resistance, reading.voltage, reading.adcRaw);
        textClipped(canvas, details, left, bounds.top + dp(174), right, dp(12), MUTED, mono);
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
        float p = dp(14);
        text(canvas, "ENGINE NODE", bounds.left + p, bounds.top + dp(27), dp(13), MUTED, sansMedium);
        boolean heartbeatFresh = state.usbConnected && state.heartbeat != null
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

}
