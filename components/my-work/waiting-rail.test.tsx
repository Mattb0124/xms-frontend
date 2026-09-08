import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WaitingRail, isNotDeployed, waitingRows } from "@/components/my-work/waiting-rail";
import { aWaiting, aWaitingItem } from "@/test-kit/my-work";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: ["acct-1"], permissions } });

const ROUTE = "GET /v1/me/waiting";

describe("waitingRows", () => {
  it("keeps only what is actually waiting", () => {
    const rows = waitingRows(aWaiting().items);
    expect(rows.map((row) => row.key)).toEqual(["tickets_assigned", "scope_approvals", "pending_time"]);
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

  it("renders a row per waiting item, linking to the address the server gave", async () => {
    stubFetch({ "GET /v1/admin/me": me(["tickets:view"]), [ROUTE]: () => json(aWaiting()) });
    renderDesk(<WaitingRail />);
    await screen.findByTestId("waiting-rail");

    const assigned = screen.getByRole("link", { name: /Tickets assigned to me/ });
    expect(assigned).toHaveAttribute("href", "/tickets?view=mine");
    expect(assigned).toHaveTextContent("4");
    expect(screen.getByRole("link", { name: /Out-of-scope flags to approve/ })).toHaveAttribute(
      "href",
      "/tickets?view=awaiting_approval",
    );
    expect(screen.getByRole("link", { name: /Days this week with unlogged time/ })).toHaveAttribute(
      "href",
      "/time?week=2026-09-07",
    );
    // A count of zero is not waiting on anyone, so the row is left out.
    expect(screen.queryByText("My articles in review")).not.toBeInTheDocument();
    expect(screen.getByText(/as of 2026-09-07/)).toBeInTheDocument();
  });

  it("renders an item whose link is not an address in this application as plain text", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["tickets:view"]),
      [ROUTE]: () => json(aWaiting({ items: [aWaitingItem({ link: "javascript:alert(1)" })] })),
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
