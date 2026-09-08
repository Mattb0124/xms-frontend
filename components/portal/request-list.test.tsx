import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PortalRequestsPage from "@/app/(portal)/portal/requests/page";
import { DashboardStrip } from "@/components/portal/dashboard-strip";
import { aPortalMe, aPortalTicket, json, renderPortal, stubFetch } from "@/test-kit/portal";

vi.mock("next/navigation", () => ({
  usePathname: () => "/portal/requests",
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const ME = "GET /v1/portal/me";
const TICKETS = "GET /v1/portal/tickets";
const DASHBOARD = "GET /v1/portal/dashboard";

/**
 * One unreadable row emptied a whole client's list while the home said "Open
 * requests 63" (frontend review finding 2). The API fix is its own; here the
 * client must never turn a refusal or a partial answer into "you have no
 * requests", and the home count must come from the list's own query.
 */
describe("My requests, when the list does not fully load", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders the rows that loaded and words the ones that did not", async () => {
    stubFetch({
      [ME]: () => json(aPortalMe()),
      [TICKETS]: () =>
        json({
          items: [aPortalTicket(), aPortalTicket({ id: "t-2", key: "CS0001002", short_description: "Login loop" })],
          next_cursor: null,
          unavailable: 2,
        }),
    });
    renderPortal(<PortalRequestsPage />);
    expect(await screen.findByRole("link", { name: /CS0001001/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /CS0001002/ })).toBeInTheDocument();
    expect(
      screen.getByText(/2 requests could not be loaded and are not shown/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/No open requests/)).not.toBeInTheDocument();
  });

  it("says one request in the singular", async () => {
    stubFetch({
      [ME]: () => json(aPortalMe()),
      [TICKETS]: () => json({ items: [aPortalTicket()], next_cursor: null, unavailable: 1 }),
    });
    renderPortal(<PortalRequestsPage />);
    expect(await screen.findByText(/1 request could not be loaded and is not shown/)).toBeInTheDocument();
  });

  it("words a failed list as a refusal with a retry, never as an empty list", async () => {
    const calls = stubFetch({
      [ME]: () => json(aPortalMe()),
      [TICKETS]: () => json({ code: "not_found", entity: "ticket" }, 404),
    });
    renderPortal(<PortalRequestsPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("We could not load your requests just now.");
    expect(screen.queryByText(/No open requests/)).not.toBeInTheDocument();
    expect(screen.queryByText(/You have not made any requests yet/)).not.toBeInTheDocument();
    const retry = screen.getByRole("button", { name: "Try again" });
    const before = calls.filter((call) => call.key === TICKETS).length;
    retry.click();
    await waitFor(() => expect(calls.filter((call) => call.key === TICKETS).length).toBeGreaterThan(before));
  });

  it("still shows the empty state when the API really answered with no rows", async () => {
    stubFetch({
      [ME]: () => json(aPortalMe()),
      [TICKETS]: () => json({ items: [], next_cursor: null }),
    });
    renderPortal(<PortalRequestsPage />);
    expect(await screen.findByText("No open requests. Search for a solution or make a request.")).toBeInTheDocument();
    expect(screen.queryByText(/could not be loaded/)).not.toBeInTheDocument();
  });

  it("names the account, and falls back to organization spelled with a z", async () => {
    const named = stubFetch({
      [ME]: () => json(aPortalMe({ permissions: ["portal:view-org-tickets"] })),
      [TICKETS]: () => json({ items: [], next_cursor: null }),
    });
    void named;
    const first = renderPortal(<PortalRequestsPage />);
    expect((await screen.findByRole("checkbox")).closest("label")?.textContent).toContain("Everyone at Brookfield");
    first.unmount();
    vi.unstubAllGlobals();

    stubFetch({
      [ME]: () => json(aPortalMe({ permissions: ["portal:view-org-tickets"] }, null)),
      [TICKETS]: () => json({ items: [], next_cursor: null }),
    });
    renderPortal(<PortalRequestsPage />);
    const label = (await screen.findByRole("checkbox")).closest("label");
    expect(label?.textContent).toContain("Everyone at my organization");
    expect(document.body.textContent).not.toContain("organisation");
  });
});

describe("the portal home count", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("counts the open requests from the same query the list runs, not the dashboard measure", async () => {
    const calls = stubFetch({
      [ME]: () => json(aPortalMe()),
      [TICKETS]: () => json({ items: [aPortalTicket()], next_cursor: null }),
      // The measure disagrees on purpose: the tile must follow the list.
      [DASHBOARD]: () => json({ measures: { open_tickets: 63, volume_created: 4 } }),
    });
    renderPortal(<DashboardStrip />);
    const tile = await screen.findByLabelText("Open requests");
    expect(tile).toHaveTextContent("1");
    expect(screen.getByLabelText("Raised")).toHaveTextContent("4");
    await waitFor(() => expect(calls.some((call) => call.key === TICKETS)).toBe(true));
    // The list screen opens on this exact key, so the two share one cache entry.
    expect(calls.find((call) => call.key === TICKETS)?.search).toBe("?scope=open");
  });

  it("leaves the count out rather than showing a number it cannot stand behind", async () => {
    stubFetch({
      [ME]: () => json(aPortalMe()),
      [TICKETS]: () => json({ code: "not_found" }, 404),
      [DASHBOARD]: () => json({ measures: { open_tickets: 63, volume_created: 4 } }),
    });
    renderPortal(<DashboardStrip />);
    expect(await screen.findByLabelText("Raised")).toHaveTextContent("4");
    expect(screen.queryByLabelText("Open requests")).not.toBeInTheDocument();
  });

  it("says how many it could not count when the API reports some unavailable", async () => {
    stubFetch({
      [ME]: () => json(aPortalMe()),
      [TICKETS]: () => json({ items: [aPortalTicket()], next_cursor: null, unavailable: 3 }),
      [DASHBOARD]: () => json({ measures: { volume_created: 4 } }),
    });
    renderPortal(<DashboardStrip />);
    expect(await screen.findByText("3 more requests could not be loaded and are not counted.")).toBeInTheDocument();
  });
});
