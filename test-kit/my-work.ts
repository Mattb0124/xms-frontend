import type { WaitingItem, WaitingOnMe } from "@/redux/api";

/**
 * Constructed fixtures for the My work rails. Nothing here is copied from a
 * live response: the counts and labels are invented. The links are written
 * the way the API writes them (`src/modules/me/waiting.module.ts`), in the
 * platform's URL space rather than this application's, which is exactly why
 * the rail resolves the item key through the route registry instead of
 * following the link.
 */
export function aWaitingItem(overrides: Partial<WaitingItem> = {}): WaitingItem {
  return {
    key: "tickets_assigned",
    label: "Tickets assigned to me",
    count: 4,
    link: "/queue?view=my-tickets",
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
        link: "/queue?view=awaiting-approval",
      }),
      aWaitingItem({
        key: "articles_in_review",
        label: "My articles in review",
        count: 0,
        link: "/knowledge?status=in_review&owner=me",
      }),
      aWaitingItem({
        key: "report_reviews",
        label: "Report packs to review",
        count: 3,
        link: "/reports/runs?status=awaiting_review",
      }),
      aWaitingItem({
        key: "unread_notifications",
        label: "Unread notifications",
        count: 7,
        link: "/notifications",
      }),
      aWaitingItem({
        key: "pending_time",
        label: "Days this week with unlogged time",
        count: 2,
        link: "/timesheet?week=2026-09-07",
      }),
      aWaitingItem({
        key: "csat_low_scores",
        label: "Low satisfaction scores to answer",
        count: 1,
        link: "/notifications?type=csat.low_score",
      }),
    ],
    ...overrides,
  };
}
