import com.nayman.vancan.DashboardLayout;
import com.nayman.vancan.DashboardLayout.Card;

import java.util.List;

/** User layout survives restart and malformed preferences without losing access to cards. */
public final class DashboardLayoutTest {
    public static void main(String[] args) {
        DashboardLayout layout = new DashboardLayout(null);
        check(layout.visibleCards().size() == 5, "new install shows every supported card");
        check(layout.hiddenCards().isEmpty(), "no duplicate add choices");
        check(!layout.move(Card.COOLANT_PRE, -1), "first card cannot move up");
        check(!layout.move(Card.RAW, 1), "last card cannot move down");
        check(!layout.move(Card.FUEL, 99), "reject invalid move direction");
        check(layout.move(Card.FUEL, -1) && layout.move(Card.FUEL, -1), "prioritize fuel");
        check(layout.visibleCards().get(0) == Card.FUEL, "fuel now first");
        check(layout.remove(Card.COOLANT_POST), "remove unused coolant card");
        check(!layout.remove(Card.COOLANT_POST), "repeat remove harmless");
        check(!layout.move(Card.COOLANT_POST, 1), "hidden cards cannot move");
        List<Card> snapshot = layout.visibleCards();
        check(!layout.add(Card.FUEL) && !layout.add(null), "cannot add duplicates or null");
        DashboardLayout restored = new DashboardLayout(layout.serialize());
        check(restored.visibleCards().equals(layout.visibleCards()), "restart preserves order and selection");
        check(restored.hiddenCards().equals(List.of(Card.COOLANT_POST)), "hidden card remains addable after restart");
        check(restored.add(Card.COOLANT_POST), "add removed card back");
        check(restored.visibleCards().get(4) == Card.COOLANT_POST, "added card goes last");
        check(snapshot.size() == 4, "callers receive stable snapshots");
        boolean immutable = false;
        try { snapshot.clear(); } catch (UnsupportedOperationException expected) { immutable = true; }
        check(immutable, "callers cannot mutate saved selection");
        for (Card card : layout.visibleCards()) check(layout.remove(card), "remove all cards");
        check(layout.serialize().isEmpty(), "all-hidden layout saved explicitly");
        restored = new DashboardLayout(layout.serialize());
        check(restored.visibleCards().isEmpty() && restored.hiddenCards().size() == 5,
                "empty layout survives restart and all cards can be restored");
        check(restored.add(Card.FUEL), "recover from empty dashboard");
        check(restored.visibleCards().equals(List.of(Card.FUEL)), "single card layout");
        check(!restored.move(Card.FUEL, 1) && !restored.move(Card.FUEL, -1), "single card movement bounded");
        restored.reset();
        check(restored.serialize().equals(new DashboardLayout(null).serialize()), "reset restores defaults");
        restored = new DashboardLayout("fuel,fuel,removed_future_card, raw ,engine");
        check(restored.visibleCards().equals(List.of(Card.FUEL, Card.RAW, Card.ENGINE)),
                "unknown and duplicate preferences do not create bad cards");
        check(new DashboardLayout("unknown,,,").visibleCards().size() == 5,
                "unusable preferences recover default dashboard");
        System.out.println("Android dashboard layout checks passed");
    }

    private static void check(boolean ok, String message) {
        if (!ok) throw new AssertionError(message);
    }
}
