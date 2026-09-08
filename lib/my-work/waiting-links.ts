import { SCREENS, isDynamicPath, type Screen } from "@/lib/routes";
import { safeHref } from "@/lib/safe-url";
import type { WaitingItem } from "@/redux/api";

/**
 * Where "Waiting on me" opens (User Experience 3.1).
 *
 * The API answers each item with a `link`, but those addresses are the
 * platform's vocabulary, not this application's route table: it sends
 * `/queue`, `/timesheet`, `/notifications` and `/reports/runs`, none of
 * which this desk serves. A link built from another service's idea of the
 * URL space is a 404 the person cannot act on, so the rail resolves the
 * item's stable `key` through `lib/routes.ts` instead and only falls back to
 * the server's link for a key this registry has never heard of.
 *
 * `screen: null` means the desk deliberately has no screen for that key:
 * notifications live in the shell's bell menu, which is on every page, so
 * the row carries its count and no address rather than a broken one.
 */
export interface WaitingTarget {
  /** The `screen` id in `SCREENS`, or null when this desk has no screen for the key. */
  screen: string | null;
  /** The search this screen's own URL grammar uses, where the key narrows the list. */
  search?: string;
}

export const WAITING_TARGETS: Record<string, WaitingTarget> = {
  // The Queue's system view for the signed-in person (lib/tickets/queue-views).
  tickets_assigned: { screen: "queue", search: "?view=mine" },
  // Out-of-scope flags are a ticket field, not a state, so the Queue has no
  // chip for them yet: the row opens the Queue and the count says how many.
  scope_approvals: { screen: "queue" },
  articles_in_review: { screen: "knowledge", search: "?status=in_review" },
  report_reviews: { screen: "report_packs" },
  // The timesheet opens on the current week, which is the week the count is
  // about; it takes no week parameter, so none is invented here.
  pending_time: { screen: "time" },
  unread_notifications: { screen: null },
  csat_low_scores: { screen: null },
};

/**
 * The address the rail links a waiting item to, or null when it links to
 * none. `permitted` is the screens this viewer may see, so a row never
 * offers a screen whose permission the viewer does not hold; the count still
 * shows, because the server counted it against them.
 */
export function waitingHref(item: WaitingItem, permitted: readonly Screen[] = SCREENS): string | null {
  const target = WAITING_TARGETS[item.key];
  // A key added by a newer API than this build knows: the server's link is
  // the only thing left, and it is untrusted, so it goes through safeHref.
  if (target === undefined) return safeHref(item.link);
  if (target.screen === null) return null;
  const screen = permitted.find((row) => row.screen === target.screen);
  if (!screen || isDynamicPath(screen.path)) return null;
  return `${screen.path}${target.search ?? ""}`;
}
