import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WaitingRail, isNotDeployed, waitingRows } from "@/components/my-work/waiting-rail";
import { aWaiting, aWaitingItem, WAITING_ACCOUNT_ID } from "@/test-kit/my-work";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: ["acct-1"], permissions } });

const ROUTE = "GET /v1/me/waiting";

describe("waitingRows", () => {
  it("keeps only what is actually waiting", () => {
    const rows = waitingRows(aWaiting().items);
    expect(rows.map((row) => row.key)).toEqual([
      "tickets_assigned",
      "scope_approvals",
      "report_reviews",
      "unread_notifications",
      "pending_time",
      "csat_low_scores",
    ]);
    expect(waitingRows([aWaitingItem({ count: 0 })])).toEqual([]);
    expect(waitingRows(undefined)).toEqual([]);
  });
});

describe("isNotDeployed", () => {
  it("recognizes only the two statuses that mean the route is not there yet", () => {
    expect(isNotDeployed({ status: 404 })).toBe(true);
    expect(isNotDeployed({ status: 501 })).toBe(true);
    expect(isNotDeployed({ status: 500 })).toBe(false);
    expect(isNotDeployed({ status: 403 })).toBe(false);
    expect(isNotDeployed({ status: "FETCH_ERROR" })).toBe(false);
    expect(isNotDeployed(undefined)).toBe(false);
  });
});

describe("WaitingRail", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("links each row to an address this application serves and this viewer may open", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["tickets:view", "time:log", "reports:view-portfolio"]),
      [ROUTE]: () => json(aWaiting()),
    });
    renderDesk(<WaitingRail />);
    await screen.findByTestId("waiting-rail");

    const assigned = screen.getByRole("link", { name: /Tickets assigned to me/ });
    expect(assigned).toHaveAttribute("href", "/cases?view=mine");
    expect(assigned).toHaveTextContent("4");
    // The Queue filters on the flag now, so the row opens the tickets it counted.
    expect(screen.getByRole("link", { name: /Out-of-scope flags to approve/ })).toHaveAttribute(
      "href",
      "/cases?out_of_scope=flagged",
    );
    // The API named an account's Report packs tab, which needs admin:accounts;
    // this viewer does not hold it, so the row falls back to the key's screen.
    expect(screen.getByRole("link", { name: /Report packs to review/ })).toHaveAttribute("href", "/reports");
    // The account whose Satisfaction tab carries the scores is tickets:view,
    // which this viewer does hold, so the server's own address is followed.
    expect(screen.getByRole("link", { name: /Low satisfaction scores to answer/ })).toHaveAttribute(
      "href",
      `/accounts/${WAITING_ACCOUNT_ID}?tab=satisfaction`,
    );
    expect(screen.getByRole("link", { name: /Days this week with unlogged time/ })).toHaveAttribute("href", "/time");
    // Notifications are the shell's bell menu, not a screen, so the row keeps
    // its count and offers no address rather than a link to nothing.
    expect(screen.queryByRole("link", { name: /Unread notifications/ })).not.toBeInTheDocument();
    expect(screen.getByText("Unread notifications")).toBeInTheDocument();
    // A count of zero is not waiting on anyone, so the row is left out.
    expect(screen.queryByText("My articles in review")).not.toBeInTheDocument();
    // Render 08 draws a plain title and the rows. The ALL-CAPS "MY WORK"
    // eyebrow named the screen the card was already on, and the "Counted by
    // the server as of" line explained a figure nobody had asked about.
    expect(screen.queryByText(/as of 2026-09-07/)).not.toBeInTheDocument();
    expect(screen.queryByText("MY WORK")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Waiting on me" })).toBeInTheDocument();
  });

  it("renders a row whose screen this viewer may not open as plain text", async () => {
    stubFetch({ "GET /v1/admin/me": me(["tickets:view"]), [ROUTE]: () => json(aWaiting()) });
    renderDesk(<WaitingRail />);
    await screen.findByTestId("waiting-rail");
    // time:log and reports:view-portfolio are not held here.
    expect(screen.queryByRole("link", { name: /Days this week with unlogged time/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Report packs to review/ })).not.toBeInTheDocument();
    expect(screen.getByText("Days this week with unlogged time")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Tickets assigned to me/ })).toHaveAttribute("href", "/cases?view=mine");
  });

  it("renders an unknown key whose link is not an address in this application as plain text", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["tickets:view"]),
      [ROUTE]: () => json(aWaiting({ items: [aWaitingItem({ key: "later_key", link: "javascript:alert(1)" })] })),
    });
    renderDesk(<WaitingRail />);
    await screen.findByTestId("waiting-rail");
    expect(screen.getByText("Tickets assigned to me")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("says nothing is waiting when every count is zero", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["tickets:view"]),
      [ROUTE]: () => json(aWaiting({ items: [aWaitingItem({ count: 0 })] })),
    });
    renderDesk(<WaitingRail />);
    expect(await screen.findByTestId("waiting-empty")).toHaveTextContent("Nothing is waiting on you");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("hides itself, with no error, while the route answers 404 or 501", async () => {
    for (const status of [404, 501]) {
      const calls = stubFetch({
        "GET /v1/admin/me": me(["tickets:view"]),
        [ROUTE]: () => json({ code: "not_found" }, status),
      });
      const { container, unmount } = renderDesk(<WaitingRail />);
      await waitFor(() => expect(calls.some((call) => call.key === ROUTE)).toBe(true));
      await waitFor(() => expect(container.querySelector("section")).toBeNull());
      expect(screen.queryByText(/could not be loaded/)).not.toBeInTheDocument();
      unmount();
      vi.unstubAllGlobals();
    }
  });

  it("says so on a failure the person can act on, and asks nothing without tickets:view", async () => {
    const failing = stubFetch({
      "GET /v1/admin/me": me(["tickets:view"]),
      [ROUTE]: () => json({ code: "server_error" }, 500),
    });
    const view = renderDesk(<WaitingRail />);
    await screen.findByText("The waiting list could not be loaded.");
    expect(failing.some((call) => call.key === ROUTE)).toBe(true);
    view.unmount();
    vi.unstubAllGlobals();

    const calls = stubFetch({ "GET /v1/admin/me": me(["capacity:view"]) });
    const { container } = renderDesk(<WaitingRail />);
    await waitFor(() => expect(calls.some((call) => call.key === "GET /v1/admin/me")).toBe(true));
    expect(container.querySelector("section")).toBeNull();
    expect(calls.some((call) => call.key === ROUTE)).toBe(false);
  });
});
