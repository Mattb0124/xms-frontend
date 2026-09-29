import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotificationsMenu } from "@/components/shell/notifications-menu";
import { matchScreen } from "@/lib/routes";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";
import { REVIEW_RUN_ID } from "@/test-kit/reporting";

const pushed: string[] = [];
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: (href: string) => pushed.push(href) }),
}));

/** A notification as `acct.notifications` holds it, with the target the API set. */
function aNotification(overrides: Record<string, unknown> = {}) {
  return {
    id: "n-1",
    type: "report.review.requested",
    title: "Weekly status report: report pack for 2026-08-31 to 2026-09-06 is ready for review",
    body: "Approve or cancel it before 2026-09-08T06:00:00Z.",
    target_kind: "report_run",
    target_id: REVIEW_RUN_ID,
    link: `/reports/runs/${REVIEW_RUN_ID}`,
    count: 1,
    read_at: null,
    updated_at: "2026-09-07T06:00:00Z",
    ...overrides,
  };
}

describe("NotificationsMenu", () => {
  afterEach(() => {
    pushed.length = 0;
    vi.unstubAllGlobals();
  });

  it("opens a reviewer notification on the review screen and marks it read", async () => {
    const calls = stubFetch({
      "GET /v1/notifications": () => json([aNotification()]),
      "PATCH /v1/notifications/n-1/read": () => json(aNotification({ read_at: "2026-09-07T07:00:00Z" })),
    });
    renderDesk(<NotificationsMenu onClose={() => {}} />);
    fireEvent.click(await screen.findByText(/is ready for review/));

    expect(pushed).toEqual([`/reports/runs/${REVIEW_RUN_ID}`]);
    await waitFor(() => expect(calls.some((call) => call.key.endsWith("/read"))).toBe(true));
  });

  it("targets a report_run, and that address is the review screen this application registers", () => {
    const row = aNotification();
    expect(row.target_kind).toBe("report_run");
    // The API builds the link from the target, so the two must agree.
    expect(row.link).toBe(`/reports/runs/${row.target_id}`);
    const screenRow = matchScreen(row.link);
    expect(screenRow?.screen).toBe("report_run");
    expect(screenRow?.permission).toBe("reports:manage");
  });

  it("navigates nowhere when the link is not an ordinary address", async () => {
    stubFetch({
      "GET /v1/notifications": () =>
        json([aNotification({ id: "n-2", link: "javascript:alert(1)", read_at: "2026-09-07T07:00:00Z" })]),
    });
    renderDesk(<NotificationsMenu onClose={() => {}} />);
    fireEvent.click(await screen.findByText(/is ready for review/));
    expect(pushed).toEqual([]);
  });
});
