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
import android.text.InputType;
import android.view.View;
import android.view.accessibility.AccessibilityEvent;
import android.widget.Button;
import android.widget.EditText;
import android.widget.GridLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import com.nayman.vancan.protocol.CanFrame;
import com.nayman.vancan.protocol.VanCanDecoder;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Rebuilt native telemetry view supporting:
 * 1. Clean split comparison of Reported Values vs. Voltages, Resistance (Ohms), Pulse Hz/Period Ticks, & Raw ADC
 * 2. Modifiable Min/Max bounds, warning/critical thresholds, and pull-up/endpoint/RPM calibration parameters
 * 3. Full CAN 0x130 CoilX + Adafruit 757 (D5/PB4 TIM3_CH1) Engine RPM card
 */
public final class DashboardView extends LinearLayout {
    private static final int BACKGROUND = Color.rgb(7, 10, 15);
    private static final int CARD = Color.rgb(13, 19, 26);
    private static final int CARD_INNER = Color.rgb(18, 26, 36);
    private static final int CARD_EDGE = Color.rgb(30, 44, 58);
    private static final int PRIMARY = Color.rgb(241, 245, 249);
    private static final int MUTED = Color.rgb(148, 163, 184);
    private static final int ACCENT = Color.rgb(6, 182, 212);
    private static final int EMERALD = Color.rgb(16, 185, 129);
    private static final int AMBER = Color.rgb(245, 158, 11);
    private static final int DANGER = Color.rgb(244, 63, 94);
    private static final String LAYOUT_KEY = "visible_cards_v1";

    public enum DisplayMode {
        SPLIT("SPLIT"),
        REPORTED("REPORTED"),
        VOLTAGE("VOLTAGE"),
        RESISTANCE("OHMS / MS"),
        RAW_ADC("ADC / HZ");

        public final String label;
        DisplayMode(String label) { this.label = label; }
    }

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
    private final LinearLayout modeControls;
    private final TextView connection;
    private final Button connect;
    private final Button log;
    private final List<View> cardViews = new ArrayList<>();
    private final List<Button> modeButtons = new ArrayList<>();
    private DashboardState state = new DashboardState();
    private Actions actions;
    private boolean editing;
    private int columns = 1;
    private DisplayMode displayMode = DisplayMode.SPLIT;
    private AlertDialog addDialog;
    private AlertDialog paramDialog;

    // Modifiable sensor bounds & calibration parameters (persisted in SharedPreferences)
    private float coolantMinF = 32f;
    private float coolantMaxF = 250f;
    private float coolantWarnF = 205f;
    private float coolantCritF = 220f;
    private float coolantPullupOhms = 2470f;

    private float fuelMinPct = 0f;
    private float fuelMaxPct = 100f;
    private float fuelWarnLowPct = 15f;
    private float fuelEmptyOhms = 75f;
    private float fuelFullOhms = 10f;
    private float fuelPullupOhms = 1000f;

    private float rpmMin = 0f;
    private float rpmMax = 6000f;
    private float rpmWarnHigh = 4200f;
    private float rpmRedline = 5000f;

    public DashboardView(Context context) {
        super(context);
        density = getResources().getDisplayMetrics().density;
        preferences = context.getSharedPreferences("dashboard", Context.MODE_PRIVATE);
        layout = new DashboardLayout(preferences.getString(LAYOUT_KEY, null));
        loadSavedParameters();

        stroke.setStyle(Paint.Style.STROKE);
        stroke.setStrokeCap(Paint.Cap.ROUND);
        setOrientation(VERTICAL);
        setPadding(px(12), px(12), px(12), px(16));
        setBackgroundColor(BACKGROUND);
        setKeepScreenOn(true);

        // Header bar
        LinearLayout headerRow = row();
        LinearLayout titleCol = new LinearLayout(context);
        titleCol.setOrientation(VERTICAL);
        TextView title = label("VAN / CAN", 22, PRIMARY);
        title.setTypeface(sansMedium);
        titleCol.addView(title);
        titleCol.addView(label("1982 FORD E-350 · TELEMETRY & CALIBRATION v0.4.0", 10, MUTED));
        LayoutParams titleParams = new LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f);
        headerRow.addView(titleCol, titleParams);

        Button paramsBtn = button("Params", this::showParametersDialog);
        LayoutParams pBtnLp = new LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT);
        pBtnLp.setMargins(px(4), 0, 0, 0);
        headerRow.addView(paramsBtn, pBtnLp);
        addView(headerRow);

        connection = label("U2C NOT CONNECTED", 12, PRIMARY);
        connection.setTypeface(mono);
        connection.setPadding(0, px(8), 0, px(8));
        addView(connection);

        // Primary action row
        LinearLayout commands = row();
        connect = button("Connect", () -> { if (actions != null) actions.onConnectPressed(); });
        log = button("Start log", () -> { if (actions != null) actions.onLogPressed(); });
        Button export = button("Export CSV", () -> { if (actions != null) actions.onExportPressed(); });
        addWeighted(commands, connect);
        addWeighted(commands, log);
        addWeighted(commands, export);
        addView(commands);

        // Display Mode Switcher: Reported vs. Voltages / Resistance / Period / Raw ADC
        TextView modeHeader = label("PRIMARY VIEW: REPORTED VALUE VS. RAW VOLTAGE / OHMS / HZ", 10, MUTED);
        modeHeader.setTypeface(mono);
        modeHeader.setPadding(px(3), px(10), 0, px(4));
        addView(modeHeader);

        modeControls = row();
        for (DisplayMode mode : DisplayMode.values()) {
            Button b = button(mode.label, () -> {
                displayMode = mode;
                updateModeButtonStyles();
                for (View card : cardViews) card.invalidate();
            });
            b.setTextSize(10);
            b.setMinHeight(px(36));
            b.setMinimumHeight(px(36));
            modeButtons.add(b);
            addWeighted(modeControls, b);
        }
        addView(modeControls);
        updateModeButtonStyles();

        layoutControls = row();
        layoutControls.setPadding(0, px(8), 0, px(8));
        addView(layoutControls);
        cards = new GridLayout(context);
        cards.setColumnCount(columns);
        cards.setAlignmentMode(GridLayout.ALIGN_BOUNDS);
        addView(cards, new LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT));
        rebuildCards();
    }

    private void loadSavedParameters() {
        coolantMinF = preferences.getFloat("coolant_min_f", 32f);
        coolantMaxF = preferences.getFloat("coolant_max_f", 250f);
        coolantWarnF = preferences.getFloat("coolant_warn_f", 205f);
        coolantCritF = preferences.getFloat("coolant_crit_f", 220f);
        coolantPullupOhms = preferences.getFloat("coolant_pullup_ohms", 2470f);

        fuelMinPct = preferences.getFloat("fuel_min_pct", 0f);
        fuelMaxPct = preferences.getFloat("fuel_max_pct", 100f);
        fuelWarnLowPct = preferences.getFloat("fuel_warn_low_pct", 15f);
        fuelEmptyOhms = preferences.getFloat("fuel_empty_ohms", 75f);
        fuelFullOhms = preferences.getFloat("fuel_full_ohms", 10f);
        fuelPullupOhms = preferences.getFloat("fuel_pullup_ohms", 1000f);

        rpmMin = preferences.getFloat("rpm_min", 0f);
        rpmMax = preferences.getFloat("rpm_max", 6000f);
        rpmWarnHigh = preferences.getFloat("rpm_warn_high", 4200f);
        rpmRedline = preferences.getFloat("rpm_redline", 5000f);
    }

    private void saveParameters() {
        preferences.edit()
                .putFloat("coolant_min_f", coolantMinF)
                .putFloat("coolant_max_f", coolantMaxF)
                .putFloat("coolant_warn_f", coolantWarnF)
                .putFloat("coolant_crit_f", coolantCritF)
                .putFloat("coolant_pullup_ohms", coolantPullupOhms)
                .putFloat("fuel_min_pct", fuelMinPct)
                .putFloat("fuel_max_pct", fuelMaxPct)
                .putFloat("fuel_warn_low_pct", fuelWarnLowPct)
                .putFloat("fuel_empty_ohms", fuelEmptyOhms)
                .putFloat("fuel_full_ohms", fuelFullOhms)
                .putFloat("fuel_pullup_ohms", fuelPullupOhms)
                .putFloat("rpm_min", rpmMin)
                .putFloat("rpm_max", rpmMax)
                .putFloat("rpm_warn_high", rpmWarnHigh)
                .putFloat("rpm_redline", rpmRedline)
                .apply();
        for (View card : cardViews) card.invalidate();
    }

    private void resetDefaultParameters() {
        coolantMinF = 32f;
        coolantMaxF = 250f;
        coolantWarnF = 205f;
        coolantCritF = 220f;
        coolantPullupOhms = 2470f;
        fuelMinPct = 0f;
        fuelMaxPct = 100f;
        fuelWarnLowPct = 15f;
        fuelEmptyOhms = 75f;
        fuelFullOhms = 10f;
        fuelPullupOhms = 1000f;
        rpmMin = 0f;
        rpmMax = 6000f;
        rpmWarnHigh = 4200f;
        rpmRedline = 5000f;
        saveParameters();
    }

    private void updateModeButtonStyles() {
        DisplayMode[] modes = DisplayMode.values();
        for (int i = 0; i < modeButtons.size() && i < modes.length; i++) {
            Button b = modeButtons.get(i);
            boolean active = modes[i] == displayMode;
            b.setTextColor(active ? BACKGROUND : PRIMARY);
            b.setBackground(new RippleDrawable(
                    ColorStateList.valueOf(Color.argb(60, 6, 182, 212)),
                    background(active ? ACCENT : CARD_INNER, active ? ACCENT : CARD_EDGE, 7), null));
        }
    }

    public void setActions(Actions actions) { this.actions = actions; }

    public void setState(DashboardState state) {
        this.state = state;
        String status = !state.usbConnected ? state.connectionText.toUpperCase(Locale.US)
                : state.trafficRecent ? "CAN ONLINE · 500 KBIT/S · MODE: " + displayMode.label
                : "U2C ONLINE · WAITING FOR CAN";
        connection.setText(status);
        connection.setTextColor(!state.usbConnected ? DANGER : state.trafficRecent ? EMERALD : AMBER);
        connect.setText(state.usbConnected ? "Disconnect" : "Connect");
        log.setText(state.logging ? "Stop log" : "Start log");
        log.setTextColor(state.logging ? EMERALD : PRIMARY);
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
            addWeighted(layoutControls, button("Edit cards & order", () -> {
                editing = true;
                rebuildCards();
            }));
            addWeighted(layoutControls, button("Modify Min/Max & Params", this::showParametersDialog));
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
            container.setBackground(background(CARD, CARD_EDGE, 10));
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
            int renderHeightDp = card == DashboardLayout.Card.COOLANT_PRE
                    || card == DashboardLayout.Card.COOLANT_POST ? 260
                    : card == DashboardLayout.Card.FUEL ? 235
                    : card == DashboardLayout.Card.RPM ? 245
                    : card.heightDp;

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
                            drawPhoneCoolant(canvas, bounds, state.coolant, "PRE-RADIATOR COOLANT", "0x110");
                            break;
                        case COOLANT_POST:
                            drawPhoneCoolant(canvas, bounds, state.coolantPost, "POST-RADIATOR COOLANT", "0x111");
                            break;
                        case FUEL: drawFuel(canvas, bounds); break;
                        case RPM: drawRpm(canvas, bounds); break;
                        case ENGINE: drawSystem(canvas, bounds); break;
                        case RAW: drawRawFrames(canvas, bounds); break;
                    }
                }
            };
            content.setContentDescription(card.title);
            content.setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_YES);
            cardViews.add(content);
            container.addView(content, new LayoutParams(LayoutParams.MATCH_PARENT, px(renderHeightDp)));
            GridLayout.LayoutParams params = new GridLayout.LayoutParams(
                    GridLayout.spec(i / columns, GridLayout.TOP), GridLayout.spec(i % columns, 1f));
            params.width = 0;
            params.height = LayoutParams.WRAP_CONTENT;
            params.setMargins(px(4), px(4), px(4), px(8));
            cards.addView(container, params);
        }
    }

    private void showParametersDialog() {
        Context ctx = getContext();
        ScrollView scroll = new ScrollView(ctx);
        LinearLayout form = new LinearLayout(ctx);
        form.setOrientation(VERTICAL);
        form.setPadding(px(16), px(12), px(16), px(12));

        EditText cMin = addNumberField(form, "Coolant Gauge Min (°F)", coolantMinF);
        EditText cMax = addNumberField(form, "Coolant Gauge Max (°F)", coolantMaxF);
        EditText cWarn = addNumberField(form, "Coolant Warning High (°F)", coolantWarnF);
        EditText cCrit = addNumberField(form, "Coolant Critical High (°F)", coolantCritF);
        EditText cPullup = addNumberField(form, "Coolant Pull-up Resistor (Ω)", coolantPullupOhms);

        EditText fMin = addNumberField(form, "Fuel Gauge Min (%)", fuelMinPct);
        EditText fMax = addNumberField(form, "Fuel Gauge Max (%)", fuelMaxPct);
        EditText fWarn = addNumberField(form, "Fuel Low Warning (%)", fuelWarnLowPct);
        EditText fEmpty = addNumberField(form, "Fuel Empty Resistance (Ω)", fuelEmptyOhms);
        EditText fFull = addNumberField(form, "Fuel Full Resistance (Ω)", fuelFullOhms);
        EditText fPullup = addNumberField(form, "Fuel Pull-up Resistor (Ω)", fuelPullupOhms);

        EditText rMin = addNumberField(form, "Engine RPM Gauge Min (RPM)", rpmMin);
        EditText rMax = addNumberField(form, "Engine RPM Gauge Max (RPM)", rpmMax);
        EditText rWarn = addNumberField(form, "Engine RPM Warning High (RPM)", rpmWarnHigh);
        EditText rRed = addNumberField(form, "Engine RPM Redline Critical (RPM)", rpmRedline);

        scroll.addView(form);
        paramDialog = new AlertDialog.Builder(ctx)
                .setTitle("Modify Min/Max Bounds & Sensor Parameters")
                .setView(scroll)
                .setPositiveButton("Save", (d, w) -> {
                    coolantMinF = parseField(cMin, coolantMinF);
                    coolantMaxF = Math.max(coolantMinF + 10f, parseField(cMax, coolantMaxF));
                    coolantWarnF = parseField(cWarn, coolantWarnF);
                    coolantCritF = parseField(cCrit, coolantCritF);
                    coolantPullupOhms = Math.max(100f, parseField(cPullup, coolantPullupOhms));

                    fuelMinPct = parseField(fMin, fuelMinPct);
                    fuelMaxPct = Math.max(fuelMinPct + 5f, parseField(fMax, fuelMaxPct));
                    fuelWarnLowPct = parseField(fWarn, fuelWarnLowPct);
                    fuelEmptyOhms = Math.max(5f, parseField(fEmpty, fuelEmptyOhms));
                    fuelFullOhms = Math.max(1f, parseField(fFull, fuelFullOhms));
                    fuelPullupOhms = Math.max(100f, parseField(fPullup, fuelPullupOhms));

                    rpmMin = Math.max(0f, parseField(rMin, rpmMin));
                    rpmMax = Math.max(rpmMin + 500f, parseField(rMax, rpmMax));
                    rpmWarnHigh = parseField(rWarn, rpmWarnHigh);
                    rpmRedline = parseField(rRed, rpmRedline);
                    saveParameters();
                })
                .setNeutralButton("Reset Defaults", (d, w) -> resetDefaultParameters())
                .setNegativeButton("Cancel", null)
                .create();
        paramDialog.setOnDismissListener(d -> paramDialog = null);
        paramDialog.show();
    }

    private EditText addNumberField(LinearLayout parent, String title, float currentValue) {
        TextView lbl = label(title, 12, MUTED);
        lbl.setPadding(0, px(6), 0, px(2));
        parent.addView(lbl);
        EditText input = new EditText(getContext());
        input.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL | InputType.TYPE_NUMBER_FLAG_SIGNED);
        input.setText(String.format(Locale.US, "%.1f", currentValue));
        parent.addView(input);
        return input;
    }

    private static float parseField(EditText field, float fallback) {
        try {
            return Float.parseFloat(field.getText().toString().trim());
        } catch (Exception e) {
            return fallback;
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
        if (paramDialog != null) paramDialog.dismiss();
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
        button.setMinHeight(px(44));
        button.setMinimumHeight(px(44));
        button.setPadding(px(5), px(6), px(5), px(6));
        button.setBackground(new RippleDrawable(
                ColorStateList.valueOf(Color.argb(60, 6, 182, 212)),
                background(CARD_INNER, CARD_EDGE, 8), null));
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
        float left = bounds.left + dp(16);
        float right = bounds.right - dp(16);
        textClipped(canvas, label, left, bounds.top + dp(22), right, dp(13), PRIMARY, sansMedium);
        textClipped(canvas, String.format(Locale.US, "CAN %s · R_PULLUP %.0f Ω · BOUNDS %.0f–%.0f °F",
                canId, coolantPullupOhms, coolantMinF, coolantMaxF),
                left, bounds.top + dp(38), right, dp(10), MUTED, mono);

        boolean fresh = state.usbConnected && reading != null
                && SystemClock.elapsedRealtime() - reading.receivedAtMillis < 1_500;
        boolean valid = fresh && reading.valid;

        double rOhms = (reading != null && reading.adcRaw > 0 && reading.adcRaw < 4095)
                ? (coolantPullupOhms * reading.adcRaw) / (4095.0 - reading.adcRaw)
                : Double.NaN;

        if (displayMode == DisplayMode.SPLIT) {
            float mid = bounds.centerX();
            RectF leftBox = new RectF(left, bounds.top + dp(48), mid - dp(4), bounds.top + dp(148));
            RectF rightBox = new RectF(mid + dp(4), bounds.top + dp(48), right, bounds.top + dp(148));
            drawSubBox(canvas, leftBox);
            drawSubBox(canvas, rightBox);

            text(canvas, "REPORTED TEMP", leftBox.left + dp(10), leftBox.top + dp(18), dp(9), MUTED, mono);
            String repF = valid ? String.format(Locale.US, "%.1f °F", reading.fahrenheit) : "--.- °F";
            textClipped(canvas, repF, leftBox.left + dp(10), leftBox.top + dp(56), leftBox.right - dp(8),
                    dp(28), valid ? PRIMARY : MUTED, sansMedium);
            String repC = valid ? String.format(Locale.US, "%.1f °C", reading.celsius) : "NO VALID TEMP";
            textClipped(canvas, repC, leftBox.left + dp(10), leftBox.top + dp(84), leftBox.right - dp(8),
                    dp(12), ACCENT, mono);

            text(canvas, "RAW PIN VOLTAGE & ADC", rightBox.left + dp(10), rightBox.top + dp(18), dp(9), MUTED, mono);
            String vStr = reading != null ? String.format(Locale.US, "%.3f V", reading.voltage) : "-.--- V";
            textClipped(canvas, vStr, rightBox.left + dp(10), rightBox.top + dp(44), rightBox.right - dp(8),
                    dp(16), PRIMARY, mono);
            String rStr = !Double.isNaN(rOhms) ? String.format(Locale.US, "R: %.0f Ω", rOhms) : "R: -- Ω";
            textClipped(canvas, rStr, rightBox.left + dp(10), rightBox.top + dp(66), rightBox.right - dp(8),
                    dp(12), ACCENT, mono);
            String adcStr = reading != null ? String.format(Locale.US, "ADC: %d / 4095", reading.adcRaw) : "ADC: --";
            textClipped(canvas, adcStr, rightBox.left + dp(10), rightBox.top + dp(86), rightBox.right - dp(8),
                    dp(11), MUTED, mono);
        } else {
            String primaryText;
            String subText;
            if (displayMode == DisplayMode.VOLTAGE) {
                primaryText = reading != null ? String.format(Locale.US, "%.3f V", reading.voltage) : "-.--- V";
                subText = valid ? String.format(Locale.US, "Reported: %.1f °F (%.1f °C) · ADC %d",
                        reading.fahrenheit, reading.celsius, reading.adcRaw) : "Pin Voltage Source";
            } else if (displayMode == DisplayMode.RESISTANCE) {
                primaryText = !Double.isNaN(rOhms) ? String.format(Locale.US, "%.0f Ω", rOhms) : "-- Ω";
                subText = valid ? String.format(Locale.US, "Reported: %.1f °F · Pin %.3f V",
                        reading.fahrenheit, reading.voltage) : "Thermistor Resistance Source";
            } else if (displayMode == DisplayMode.RAW_ADC) {
                primaryText = reading != null ? String.format(Locale.US, "%d ADC", reading.adcRaw) : "-- ADC";
                subText = valid ? String.format(Locale.US, "Reported: %.1f °F · Pin %.3f V",
                        reading.fahrenheit, reading.voltage) : "12-Bit ADC Count (0–4095)";
            } else {
                primaryText = valid ? String.format(Locale.US, "%.1f °F", reading.fahrenheit) : "--.- °F";
                subText = valid ? String.format(Locale.US, "%.1f °C · %.3f V · %.0f Ω",
                        reading.celsius, reading.voltage, rOhms) : "NO VALID READING";
            }
            textClipped(canvas, primaryText, left, bounds.top + dp(100), right, dp(42),
                    valid || reading != null ? PRIMARY : MUTED, sansMedium);
            textClipped(canvas, subText, left, bounds.top + dp(130), right, dp(13), ACCENT, mono);
        }

        drawGauge(canvas, left, right, bounds.bottom - dp(76), valid ? reading.fahrenheit : Double.NaN);
        String status = !fresh ? "STALE / NO DATA" : !reading.valid && reading.status == 0
                ? "INVALID READING" : VanCanDecoder.sensorStatusText(reading.status);
        int statusColor = !fresh ? AMBER : !valid ? DANGER
                : reading.fahrenheit >= coolantCritF ? DANGER
                : reading.fahrenheit >= coolantWarnF ? AMBER : EMERALD;
        textClipped(canvas, status + String.format(Locale.US, "  (WARN %.0f° · CRIT %.0f°)", coolantWarnF, coolantCritF),
                left, bounds.bottom - dp(34), right, dp(11), statusColor, sansMedium);
        String details = reading == null ? "Waiting for coolant sensor · " + canId
                : String.format(Locale.US, "ADC %d  ·  %.3f V  ·  %.0f Ω  ·  SEQ %d",
                reading.adcRaw, reading.voltage, Double.isNaN(rOhms) ? 0.0 : rOhms, reading.sequence);
        textClipped(canvas, details, left, bounds.bottom - dp(16), right, dp(11), MUTED, mono);
    }

    private void drawRpm(Canvas canvas, RectF bounds) {
        float left = bounds.left + dp(16);
        float right = bounds.right - dp(16);
        VanCanDecoder.RpmReading reading = state.rpm;
        boolean fresh = reading != null && reading.fresh(state.usbConnected, SystemClock.elapsedRealtime());
        boolean valid = fresh && reading.valid;
        double hz = valid ? reading.pulseHz() : Double.NaN;
        double periodMs = reading != null && reading.periodTicks > 0 ? reading.periodTicks / 100.0 : Double.NaN;

        textClipped(canvas, "ENGINE RPM · FORD 400M V8", left, bounds.top + dp(22), right, dp(13), PRIMARY, sansMedium);
        textClipped(canvas, String.format(Locale.US, "CAN 0x130 · COILX + 757 (D5/PB4) · 4 PPR · %.0f–%.0f RPM",
                rpmMin, rpmMax), left, bounds.top + dp(38), right, dp(10), MUTED, mono);

        if (displayMode == DisplayMode.SPLIT) {
            float mid = bounds.centerX();
            RectF leftBox = new RectF(left, bounds.top + dp(48), mid - dp(4), bounds.top + dp(142));
            RectF rightBox = new RectF(mid + dp(4), bounds.top + dp(48), right, bounds.top + dp(142));
            drawSubBox(canvas, leftBox);
            drawSubBox(canvas, rightBox);

            text(canvas, "REPORTED TACH RPM", leftBox.left + dp(10), leftBox.top + dp(18), dp(9), MUTED, mono);
            String rpmStr = valid ? String.format(Locale.US, "%d RPM", reading.rpm) : "-- RPM";
            textClipped(canvas, rpmStr, leftBox.left + dp(10), leftBox.top + dp(56), leftBox.right - dp(8),
                    dp(28), valid ? PRIMARY : MUTED, sansMedium);
            String formulaStr = valid ? String.format(Locale.US, "%.2f Hz × 15", hz) : "RPM = (1500000+T/2)/T";
            textClipped(canvas, formulaStr, leftBox.left + dp(10), leftBox.top + dp(82), leftBox.right - dp(8),
                    dp(11), ACCENT, mono);

            text(canvas, "RAW PULSE HZ & 10 µS TICKS", rightBox.left + dp(10), rightBox.top + dp(18), dp(9), MUTED, mono);
            String hzStr = !Double.isNaN(hz) ? String.format(Locale.US, "%.2f Hz", hz) : "--.-- Hz";
            textClipped(canvas, hzStr, rightBox.left + dp(10), rightBox.top + dp(44), rightBox.right - dp(8),
                    dp(16), PRIMARY, mono);
            String msStr = !Double.isNaN(periodMs)
                    ? String.format(Locale.US, "%.2f ms (%d ticks)", periodMs, reading.periodTicks)
                    : "Period: -- ms (0 ticks)";
            textClipped(canvas, msStr, rightBox.left + dp(10), rightBox.top + dp(65), rightBox.right - dp(8),
                    dp(11), ACCENT, mono);
            textClipped(canvas, "B1: 5.0V → A1: 3.3V (TIM3_CH1)", rightBox.left + dp(10), rightBox.top + dp(83),
                    rightBox.right - dp(8), dp(10), MUTED, mono);
        } else {
            String primaryText;
            String subText;
            if (displayMode == DisplayMode.VOLTAGE) {
                primaryText = "3.30 V (A1) / 5.00 V (B1)";
                subText = valid ? String.format(Locale.US, "Reported: %d RPM · %.2f Hz · D5/PB4 TIM3_CH1",
                        reading.rpm, hz) : "Adafruit 757 BSS138 Level Shifter Logic Rails";
            } else if (displayMode == DisplayMode.RESISTANCE) {
                primaryText = !Double.isNaN(periodMs) ? String.format(Locale.US, "%.2f ms", periodMs) : "--.-- ms";
                subText = valid ? String.format(Locale.US, "Reported: %d RPM · %d ticks (10 µs) · %.2f Hz",
                        reading.rpm, reading.periodTicks, hz) : "TIM3 Capture Period (10 µs / tick)";
            } else if (displayMode == DisplayMode.RAW_ADC) {
                primaryText = !Double.isNaN(hz) ? String.format(Locale.US, "%.2f Hz", hz) : "--.-- Hz";
                subText = valid ? String.format(Locale.US, "Reported: %d RPM · Period %d ticks (%.2f ms)",
                        reading.rpm, reading.periodTicks, periodMs) : "CoilX Ignition Pulse Frequency";
            } else {
                primaryText = valid ? String.format(Locale.US, "%d RPM", reading.rpm) : "-- RPM";
                subText = valid ? String.format(Locale.US, "%.2f Hz · %.2f ms (%d ticks)",
                        hz, periodMs, reading.periodTicks) : "COILX · V8 · 4 PULSES / REV";
            }
            textClipped(canvas, primaryText, left, bounds.top + dp(96), right, dp(38),
                    valid ? PRIMARY : MUTED, sansMedium);
            textClipped(canvas, subText, left, bounds.top + dp(126), right, dp(12), ACCENT, mono);
        }

        // Tachometer Gauge Bar
        float y = bounds.top + dp(162);
        stroke.setStrokeWidth(dp(8));
        stroke.setColor(CARD_EDGE);
        canvas.drawLine(left, y, right, y, stroke);
        if (valid) {
            float span = Math.max(500f, rpmMax - rpmMin);
            float ratio = Math.max(0f, Math.min(1f, (reading.rpm - rpmMin) / span));
            stroke.setColor(reading.rpm >= rpmRedline ? DANGER : reading.rpm >= rpmWarnHigh ? AMBER : EMERALD);
            canvas.drawLine(left, y, left + (right - left) * ratio, y, stroke);
        }
        text(canvas, String.format(Locale.US, "%.0f", rpmMin), left, y + dp(18), dp(9), MUTED, mono);
        String benchMarks = "100Hz=1500 · 200Hz=3000 · 400Hz=6000";
        textClipped(canvas, benchMarks, left + dp(35), y + dp(18), right - dp(50), dp(9), MUTED, mono);
        String maxLbl = String.format(Locale.US, "%.0f RPM", rpmMax);
        text(canvas, maxLbl, right - measure(maxLbl, dp(9), mono), y + dp(18), dp(9), MUTED, mono);

        String status = !fresh ? "STALE / NO CAN DATA" : !reading.valid && reading.status == 0
                ? "INVALID READING" : VanCanDecoder.rpmStatusText(reading.status);
        int statusColor = !fresh ? AMBER : !valid ? AMBER
                : reading.rpm >= rpmRedline ? DANGER
                : reading.rpm >= rpmWarnHigh ? AMBER : EMERALD;
        textClipped(canvas, status + String.format(Locale.US, "  (WARN %.0f · REDLINE %.0f)", rpmWarnHigh, rpmRedline),
                left, bounds.bottom - dp(32), right, dp(11), statusColor, sansMedium);
        String details = valid
                ? String.format(Locale.US, "%.2f Hz  ·  %d TICKS (%.2f ms)  ·  SEQ %d",
                        hz, reading.periodTicks, periodMs, reading.sequence)
                : fresh && reading.status == 1 ? "Engine stopped or signal missing · CAN 0x130"
                : "Waiting for RPM pulses · CAN 0x130 (100 ms)";
        textClipped(canvas, details, left, bounds.bottom - dp(14), right, dp(11), MUTED, mono);
    }

    private void drawFuel(Canvas canvas, RectF bounds) {
        float left = bounds.left + dp(16);
        float right = bounds.right - dp(16);
        long now = SystemClock.elapsedRealtime();
        VanCanDecoder.FuelReading reading = state.fuel.reading();
        boolean fresh = state.fuel.fresh(state.usbConnected, now);

        // Compute custom fuel % using user's modifiable emptyOhms / fullOhms endpoints
        double customPct = Double.NaN;
        if (fresh && reading != null && reading.valid) {
            double span = Math.max(1.0, fuelEmptyOhms - fuelFullOhms);
            customPct = Math.max(0.0, Math.min(100.0, ((fuelEmptyOhms - reading.resistanceOhms) / span) * 100.0));
        }
        boolean valid = !Double.isNaN(customPct);

        text(canvas, "FUEL TANK LEVEL (FG72A)", left, bounds.top + dp(22), dp(13), PRIMARY, sansMedium);
        textClipped(canvas, String.format(Locale.US, "CAN 0x120 · EMPTY %.0f Ω / FULL %.0f Ω · R_PULLUP %.0f Ω",
                fuelEmptyOhms, fuelFullOhms, fuelPullupOhms),
                left, bounds.top + dp(38), right, dp(10), AMBER, mono);

        if (displayMode == DisplayMode.SPLIT) {
            float mid = bounds.centerX();
            RectF leftBox = new RectF(left, bounds.top + dp(48), mid - dp(4), bounds.top + dp(138));
            RectF rightBox = new RectF(mid + dp(4), bounds.top + dp(48), right, bounds.top + dp(138));
            drawSubBox(canvas, leftBox);
            drawSubBox(canvas, rightBox);

            text(canvas, "REPORTED LEVEL", leftBox.left + dp(10), leftBox.top + dp(18), dp(9), MUTED, mono);
            String pctStr = valid ? String.format(Locale.US, "%.0f%%", customPct) : "--%";
            textClipped(canvas, pctStr, leftBox.left + dp(10), leftBox.top + dp(56), leftBox.right - dp(8),
                    dp(30), valid ? PRIMARY : MUTED, sansMedium);
            textClipped(canvas, "5s DAMPED EST.", leftBox.left + dp(10), leftBox.top + dp(80), leftBox.right - dp(8),
                    dp(10), ACCENT, mono);

            text(canvas, "RAW OHMS / VOLTS / ADC", rightBox.left + dp(10), rightBox.top + dp(18), dp(9), MUTED, mono);
            String rStr = (fresh && reading != null && reading.valid)
                    ? String.format(Locale.US, "%.1f Ω", reading.resistanceOhms) : "--.- Ω";
            textClipped(canvas, rStr, rightBox.left + dp(10), rightBox.top + dp(44), rightBox.right - dp(8),
                    dp(16), PRIMARY, mono);
            String vStr = reading != null ? String.format(Locale.US, "Pin: %.4f V", reading.voltage) : "Pin: -.---- V";
            textClipped(canvas, vStr, rightBox.left + dp(10), rightBox.top + dp(64), rightBox.right - dp(8),
                    dp(11), ACCENT, mono);
            String adcStr = reading != null ? String.format(Locale.US, "ADC: %d / 4095", reading.adcRaw) : "ADC: --";
            textClipped(canvas, adcStr, rightBox.left + dp(10), rightBox.top + dp(82), rightBox.right - dp(8),
                    dp(11), MUTED, mono);
        } else {
            String primaryText;
            String subText;
            if (displayMode == DisplayMode.VOLTAGE) {
                primaryText = reading != null ? String.format(Locale.US, "%.4f V", reading.voltage) : "-.---- V";
                subText = valid ? String.format(Locale.US, "Reported: %.0f%% · %.1f Ω · ADC %d",
                        customPct, reading.resistanceOhms, reading.adcRaw) : "Pin Voltage Source";
            } else if (displayMode == DisplayMode.RESISTANCE) {
                primaryText = (fresh && reading != null && reading.valid)
                        ? String.format(Locale.US, "%.1f Ω", reading.resistanceOhms) : "--.- Ω";
                subText = valid ? String.format(Locale.US, "Reported: %.0f%% · Pin %.4f V",
                        customPct, reading.voltage) : "Sender Resistance Source";
            } else if (displayMode == DisplayMode.RAW_ADC) {
                primaryText = reading != null ? String.format(Locale.US, "%d ADC", reading.adcRaw) : "-- ADC";
                subText = valid ? String.format(Locale.US, "Reported: %.0f%% · %.1f Ω",
                        customPct, reading.resistanceOhms) : "12-Bit ADC Count (0–4095)";
            } else {
                primaryText = valid ? String.format(Locale.US, "%.0f%% EST.", customPct) : "--%";
                subText = reading != null ? String.format(Locale.US, "%.1f Ω · %.4f V · ADC %d",
                        reading.resistanceOhms, reading.voltage, reading.adcRaw) : "Waiting for CAN 0x120";
            }
            textClipped(canvas, primaryText, left, bounds.top + dp(94), right, dp(38),
                    valid || reading != null ? PRIMARY : MUTED, sansMedium);
            textClipped(canvas, subText, left, bounds.top + dp(122), right, dp(12), ACCENT, mono);
        }

        float y = bounds.top + dp(156);
        stroke.setStrokeWidth(dp(8));
        stroke.setColor(CARD_EDGE);
        canvas.drawLine(left, y, right, y, stroke);
        if (valid) {
            float span = Math.max(1f, fuelMaxPct - fuelMinPct);
            float ratio = Math.max(0f, Math.min(1f, ((float) customPct - fuelMinPct) / span));
            stroke.setColor(customPct <= fuelWarnLowPct ? AMBER : EMERALD);
            canvas.drawLine(left, y, left + (right - left) * ratio, y, stroke);
        }
        String status = !fresh ? "STALE / NO DATA" : !reading.valid && reading.status == 0
                ? "INVALID READING" : reading.valid ? "ESTIMATE · LOW WARN ≤ " + String.format(Locale.US, "%.0f%%", fuelWarnLowPct)
                : VanCanDecoder.fuelStatusText(reading.status);
        textClipped(canvas, status, left, bounds.top + dp(184), right, dp(11),
                !fresh || (valid && customPct <= fuelWarnLowPct) ? AMBER : valid ? EMERALD : DANGER, sansMedium);
        String resistance = fresh && reading.valid ? String.format(Locale.US, "%.1f Ω", reading.resistanceOhms) : "-- Ω";
        String details = reading == null ? "Waiting for fuel sender · CAN 0x120"
                : String.format(Locale.US, "%s  ·  %.4f V  ·  ADC %d  ·  SEQ %d",
                resistance, reading.voltage, reading.adcRaw, reading.sequence);
        textClipped(canvas, details, left, bounds.top + dp(206), right, dp(11), MUTED, mono);
    }

    private void drawSubBox(Canvas canvas, RectF box) {
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(CARD_INNER);
        canvas.drawRoundRect(box, dp(8), dp(8), paint);
        stroke.setStrokeWidth(dp(1));
        stroke.setColor(CARD_EDGE);
        canvas.drawRoundRect(box, dp(8), dp(8), stroke);
    }

    private void drawGauge(Canvas canvas, float left, float right, float y, double temperatureF) {
        stroke.setStrokeWidth(dp(8));
        stroke.setColor(CARD_EDGE);
        canvas.drawLine(left, y, right, y, stroke);
        if (!Double.isNaN(temperatureF)) {
            double span = Math.max(10.0, coolantMaxF - coolantMinF);
            float ratio = (float) Math.max(0, Math.min(1, (temperatureF - coolantMinF) / span));
            stroke.setColor(temperatureF >= coolantCritF ? DANGER : temperatureF >= coolantWarnF ? AMBER : EMERALD);
            canvas.drawLine(left, y, left + (right - left) * ratio, y, stroke);
        }
        text(canvas, String.format(Locale.US, "%.0f °F", coolantMinF), left, y + dp(20), dp(9), MUTED, mono);
        String hot = String.format(Locale.US, "%.0f °F", coolantMaxF);
        text(canvas, hot, right - measure(hot, dp(9), mono), y + dp(20), dp(9), MUTED, mono);
    }

    private void drawSystem(Canvas canvas, RectF bounds) {
        float p = dp(16);
        text(canvas, "ENGINE NODE · CAN 0x100", bounds.left + p, bounds.top + dp(26), dp(13), PRIMARY, sansMedium);
        boolean heartbeatFresh = state.usbConnected && state.heartbeat != null
                && SystemClock.elapsedRealtime() - state.heartbeat.receivedAtMillis < 2_000;
        String online = heartbeatFresh ? "ONLINE" : "OFFLINE";
        text(canvas, online, bounds.right - p - measure(online, dp(12), sansMedium),
                bounds.top + dp(26), dp(12), heartbeatFresh ? EMERALD : AMBER, sansMedium);

        String uptime = state.heartbeat == null ? "--:--:--" : formatUptime(state.heartbeat.uptimeMillis);
        String seq = state.heartbeat == null ? "--" : Integer.toString(state.heartbeat.sequence);
        float line = bounds.top + Math.min(dp(72), bounds.height() * 0.62f);
        text(canvas, "UPTIME", bounds.left + p, line, dp(12), MUTED, sansMedium);
        text(canvas, uptime, bounds.left + dp(86), line, dp(22), PRIMARY, mono);
        String frames = String.format(Locale.US, "%d FRAMES  ·  %d FPS  ·  HB SEQ %s",
                state.totalFrames, state.framesPerSecond, seq);
        textClipped(canvas, frames, bounds.left + p, bounds.bottom - dp(17),
                bounds.right - p, dp(11), MUTED, mono);
    }

    private void drawRawFrames(Canvas canvas, RectF bounds) {
        float p = dp(16);
        text(canvas, "RAW CAN 2.0A STREAM", bounds.left + p, bounds.top + dp(26), dp(13), PRIMARY, sansMedium);
        String mode = state.logging ? "● RECORDING CSV" : "LIVE MONITOR";
        text(canvas, mode, bounds.right - p - measure(mode, dp(11), sansMedium),
                bounds.top + dp(26), dp(11), state.logging ? DANGER : ACCENT, sansMedium);

        float y = bounds.top + dp(52);
        float row = dp(24);
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
        if (shown == 0 && capacity > 0) text(canvas, "Waiting for CAN frames…", bounds.left + p, y, dp(12), MUTED, mono);
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
