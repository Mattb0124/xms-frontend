import type { WaitingItem, WaitingOnMe } from "@/redux/api";

/**
 * Constructed fixtures for the My work rails. Nothing here is copied from a
 * live response: the counts and labels are invented. The links are written
 * the way the API writes them today (`src/modules/me/waiting.module.ts`,
 * pinned by `test/waiting.int-spec.ts`), which is this application's own URL
 * space: two of them name an account the key alone could never express.
 */
export const WAITING_ACCOUNT_ID = "77777777-7777-4777-8777-777777777777";

export function aWaitingItem(overrides: Partial<WaitingItem> = {}): WaitingItem {
  return {
    key: "tickets_assigned",
    label: "Tickets assigned to me",
    count: 4,
    link: "/cases?view=mine",
    ...overrides,
  };
}

/** Every key the API answers with, in the order it answers them. */
export function aWaiting(overrides: Partial<WaitingOnMe> = {}): WaitingOnMe {
  return {
    as_of: "2026-09-07",
    items: [
      aWaitingItem(),
      aWaitingItem({
        key: "scope_approvals",
        label: "Out-of-scope flags to approve",
        count: 1,
        // The list route filters on the flag now, so the API links the
        // tickets it counted rather than the whole queue (backend
        // src/modules/me/waiting.module.ts).
        link: "/cases?out_of_scope=flagged",
      }),
      aWaitingItem({
        key: "articles_in_review",
        label: "My articles in review",
        count: 0,
        link: "/knowledge?status=in_review",
      }),
      aWaitingItem({
        key: "report_reviews",
        label: "Report packs to review",
        count: 3,
        // The newest waiting run names its account's Report packs tab.
        link: `/admin/accounts/${WAITING_ACCOUNT_ID}?tab=reports`,
      }),
      aWaitingItem({
        key: "unread_notifications",
        label: "Unread notifications",
        count: 7,
        // No link at all: notifications live in the shell's bell menu.
        link: undefined,
      }),
      aWaitingItem({
        key: "pending_time",
        label: "Days this week with unlogged time",
        count: 2,
        link: "/time",
      }),
      aWaitingItem({
        key: "csat_low_scores",
        label: "Low satisfaction scores to answer",
        count: 1,
        link: `/accounts/${WAITING_ACCOUNT_ID}?tab=satisfaction`,
      }),
    ],
    ...overrides,
  };
}

/**
 * The same rail as an older API wrote it, in the platform's URL space rather
 * than this application's. Kept so the fallback stays covered: not one of
 * these addresses is a screen this desk serves, so every row must resolve
 * through its key instead.
 */
export function aPlatformWaiting(): WaitingOnMe {
  const links: Record<string, string | undefined> = {
    tickets_assigned: "/queue?view=my-tickets",
    scope_approvals: "/queue?view=awaiting-approval",
    articles_in_review: "/knowledge?status=in_review&owner=me",
    report_reviews: "/reports/runs?status=awaiting_review",
    unread_notifications: "/notifications",
    pending_time: "/timesheet?week=2026-09-07",
    csat_low_scores: "/notifications?type=csat.low_score",
  };
  const current = aWaiting();
  return { ...current, items: current.items.map((item) => ({ ...item, link: links[item.key] })) };
}
