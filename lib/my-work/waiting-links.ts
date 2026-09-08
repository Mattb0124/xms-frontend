import { SCREENS, isDynamicPath, matchScreen, type Screen } from "@/lib/routes";
import { safeHref } from "@/lib/safe-url";
import type { WaitingItem } from "@/redux/api";

/**
 * Where "Waiting on me" opens (User Experience 3.1).
 *
 * The API used to answer each item with the platform's own address
 * (`/queue`, `/timesheet`, `/notifications`, `/reports/runs`), none of which
 * this desk serves, so the rail ignored the link and resolved the item's
 * stable `key` through the route registry instead. The backend now writes
 * this application's own addresses (`src/modules/me/waiting.module.ts`,
 * `test/waiting.int-spec.ts`), and two of them carry more than a key ever
 * could: the report-review row names the account whose Report packs tab to
 * open, and the low-score row names the account whose Satisfaction tab to
 * open. Following the key would throw that away.
 *
 * So the link comes first, and it is checked rather than trusted: it must be
 * a same-site address, it must match a screen this registry declares, and
 * that screen must be one this viewer may open. Anything else falls back to
 * the key's own target below, and a key the registry has never heard of
 * falls back to the server's link through `safeHref` alone, since that is
 * all a newer API leaves to go on.
 *
 * `screen: null` means the desk deliberately has no screen for that key:
 * notifications live in the shell's bell menu, which is on every page, so
 * the row carries its count and no address rather than a broken one. The
 * API sends no link for that row either.
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
  // Out-of-scope flags are a ticket field, not a state, and neither the list
  // parameters nor the server's condition-set allowlist carry one, so the
  // Queue has no chip: the row opens the Queue and the count says how many.
  scope_approvals: { screen: "queue" },
  articles_in_review: { screen: "knowledge", search: "?status=in_review" },
  // With a run waiting the API names the account's Report packs tab, an
  // address no key can express; with none waiting it sends /reports. That tab
  // links each held run on to /reports/runs/[id], the review screen, so the
  // rail lands one click from the decision. A newer API that names the run
  // itself needs no change here either: that address is a registered screen,
  // so `serverHref` accepts it for a viewer who holds reports:manage.
  report_reviews: { screen: "report_packs" },
  // The timesheet opens on the current week, which is the week the count is
  // about; it takes no week parameter, so none is invented here.
  pending_time: { screen: "time" },
  unread_notifications: { screen: null },
  // The API names the account whose Satisfaction tab carries the scores, or
  // the accounts list when no one account owns them.
  csat_low_scores: { screen: "accounts" },
};

/**
 * The server's link, when it is an address this application serves and this
 * viewer may open; null otherwise. The path goes through `matchScreen`, the
 * same resolver the shell uses, so a dynamic address such as
 * `/accounts/{id}?tab=satisfaction` is accepted through its `/accounts/[id]`
 * pattern while an address from another URL space is not.
 */
export function serverHref(link: string | null | undefined, permitted: readonly Screen[]): string | null {
  const safe = safeHref(link);
  // Only a same-site path can be checked against the registry; an absolute
  // URL is another origin's business and never this rail's.
  if (!safe || !safe.startsWith("/")) return null;
  const screen = matchScreen(safe.split(/[?#]/)[0]);
  if (!screen) return null;
  return permitted.some((row) => row.screen === screen.screen) ? safe : null;
}

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
  const fromServer = serverHref(item.link, permitted);
  if (fromServer) return fromServer;
  const screen = permitted.find((row) => row.screen === target.screen);
  if (!screen || isDynamicPath(screen.path)) return null;
  return `${screen.path}${target.search ?? ""}`;
}
