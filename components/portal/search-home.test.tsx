import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchHome } from "@/components/portal/search-home";
import { aPortalTicket, json, renderPortal, stubFetch } from "@/test-kit/portal";

vi.mock("next/navigation", () => ({ usePathname: () => "/portal", useRouter: () => ({ push: vi.fn() }) }));

describe("portal search home", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows the dashboard strip in client language, and searches own requests plus the knowledge placeholder once two characters are typed", async () => {
    const calls = stubFetch({
      "GET /v1/portal/tickets": (body) => {
        void body;
        return json({ items: [aPortalTicket()], next_cursor: null });
      },
      "GET /v1/portal/dashboard": () =>
        json({
          period: { start: "2026-08-08T00:00:00Z", end: "2026-09-07T00:00:00Z" },
          measures: {
            open_tickets: 1,
            volume_created: 4,
            volume_resolved: 3,
            sla_response_attainment: { numerator: 4, denominator: 4, value: 100 },
            sla_resolution_attainment: { numerator: 2, denominator: 3, value: 66.7 },
            mttr_minutes: 300,
            backlog_by_age: { "0_1d": 1, "1_3d": 0, "3_7d": 0, "7_14d": 0, "14d_plus": 0 },
          },
        }),
    });
    renderPortal(<SearchHome debounceMs={0} />);
    await waitFor(() => expect(screen.getByLabelText("Open requests")).toHaveTextContent("1"));
    expect(screen.getByLabelText("Raised")).toHaveTextContent("4");
    expect(screen.getByLabelText("Resolution target met")).toHaveTextContent("66.7%");
    expect(screen.queryByText("Hours used")).not.toBeInTheDocument();
    expect(calls.some((call) => call.key === "GET /v1/portal/dashboard" && call.search === "?days=30")).toBe(true);
    expect(screen.queryByText("Knowledge articles will appear here.")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search solutions and your requests"), { target: { value: "r" } });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(calls.some((call) => call.search.includes("q="))).toBe(false);

    fireEvent.change(screen.getByLabelText("Search solutions and your requests"), { target: { value: "report" } });
    await waitFor(() => expect(screen.getByText("Knowledge articles will appear here.")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("Cannot open the consolidation report")).toBeInTheDocument());
    expect(calls.some((call) => call.search === "?scope=all&q=report")).toBe(true);
  });

  it("links to My requests and New request", async () => {
    stubFetch({
      "GET /v1/portal/tickets": () => json({ items: [], next_cursor: null }),
      "GET /v1/portal/dashboard": () => json({ period: {}, measures: { consumption_minutes: 90 } }),
    });
    renderPortal(<SearchHome debounceMs={0} />);
    expect(screen.getByRole("link", { name: "See my requests" })).toHaveAttribute("href", "/portal/requests");
    expect(screen.getByRole("link", { name: "New request" })).toHaveAttribute("href", "/portal/requests/new");
    // Consumption renders only because the API sent it (the account setting allows it).
    await waitFor(() => expect(screen.getByLabelText("Hours used")).toHaveTextContent("1.5h"));
  });
});
