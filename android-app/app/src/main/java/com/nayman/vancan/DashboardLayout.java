package com.nayman.vancan;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/** Stable card IDs and a saved, ordered selection, independent of live telemetry. */
public final class DashboardLayout {
    public enum Card {
        COOLANT_PRE("coolant_pre", "Pre-radiator coolant", 240),
        COOLANT_POST("coolant_post", "Post-radiator coolant", 240),
        FUEL("fuel", "Fuel level", 200),
        ENGINE("engine", "Engine node", 140),
        RAW("raw", "Raw CAN frames", 180);

        public final String id;
        public final String title;
        public final int heightDp;

        Card(String id, String title, int heightDp) {
            this.id = id;
            this.title = title;
            this.heightDp = heightDp;
        }

        private static Card fromId(String id) {
            for (Card card : values()) if (card.id.equals(id)) return card;
            return null;
        }
    }

    private final List<Card> visible = new ArrayList<>();

    public DashboardLayout(String saved) {
        if (saved == null) {
            reset();
        } else if (!saved.isEmpty()) {
            for (String id : saved.split(",")) {
                Card card = Card.fromId(id.trim());
                if (card != null && !visible.contains(card)) visible.add(card);
            }
            // Recover unusable preferences; an intentionally empty selection stays empty.
            if (visible.isEmpty()) reset();
        }
    }

    public List<Card> visibleCards() {
        return Collections.unmodifiableList(new ArrayList<>(visible));
    }

    public List<Card> hiddenCards() {
        List<Card> hidden = new ArrayList<>(Arrays.asList(Card.values()));
        hidden.removeAll(visible);
        return Collections.unmodifiableList(hidden);
    }

    public boolean add(Card card) {
        if (card == null || visible.contains(card)) return false;
        visible.add(card);
        return true;
    }

    public boolean remove(Card card) {
        return visible.remove(card);
    }

    public boolean move(Card card, int direction) {
        if (direction != -1 && direction != 1) return false;
        int from = visible.indexOf(card);
        int to = from + direction;
        if (from < 0 || to < 0 || to >= visible.size()) return false;
        Collections.swap(visible, from, to);
        return true;
    }

    public void reset() {
        visible.clear();
        visible.addAll(Arrays.asList(Card.values()));
    }

    public String serialize() {
        StringBuilder saved = new StringBuilder();
        for (Card card : visible) {
            if (saved.length() > 0) saved.append(',');
            saved.append(card.id);
        }
        return saved.toString();
    }
}
