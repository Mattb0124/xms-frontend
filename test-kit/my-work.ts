import type { WaitingItem, WaitingOnMe } from "@/redux/api";

/**
 * Constructed fixtures for the My work rails. Nothing here is copied from a
 * live response: the ids and labels are invented and the links are addresses
 * inside the application.
 */
export function aWaitingItem(overrides: Partial<WaitingItem> = {}): WaitingItem {
  return {
    key: "tickets_assigned",
    label: "Tickets assigned to me",
    count: 4,
    link: "/tickets?view=mine",
    ...overrides,
  };
}

export function aWaiting(overrides: Partial<WaitingOnMe> = {}): WaitingOnMe {
  return {
    as_of: "2026-09-07",
    items: [
      aWaitingItem(),
      aWaitingItem({
        key: "scope_approvals",
        label: "Out-of-scope flags to approve",
        count: 1,
        link: "/tickets?view=awaiting_approval",
      }),
      aWaitingItem({ key: "articles_in_review", label: "My articles in review", count: 0, link: "/knowledge" }),
      aWaitingItem({
        key: "pending_time",
        label: "Days this week with unlogged time",
        count: 2,
        link: "/time?week=2026-09-07",
      }),
    ],
    ...overrides,
  };
}
