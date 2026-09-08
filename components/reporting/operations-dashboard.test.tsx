import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OperationsDashboard } from "@/components/reporting/operations-dashboard";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";
import { anOperationsDashboard, someMeasures } from "@/test-kit/reporting";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/operations",
  useRouter: () => ({ push }),
}));

describe("OperationsDashboard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    push.mockReset();
  });

  it("renders the synthesis line, the six tiles, the SLA meters, the backlog bars, notable tickets and the account strip", async () => {
    stubFetch({ "GET /v1/dashboards/operations": () => json(anOperationsDashboard()) });
    renderDesk(<OperationsDashboard />);
    await waitFor(() => expect(screen.getByTestId("synthesis")).toBeInTheDocument());
    expect(screen.getByTestId("synthesis")).toHaveTextContent(
      "Resolution attainment 90% across 2 accounts, 6 breached now, 14 at risk, 7 unassigned.",
    );

    const tiles = screen.getByTestId("tile-strip");
    expect(tiles.querySelectorAll("a")).toHaveLength(6);
    expect(screen.getByRole("link", { name: /Breached/ })).toHaveAttribute("href", "/tickets?view=breached");
    expect(screen.getByRole("link", { name: /Unassigned/ })).toHaveAttribute("href", "/tickets?view=unassigned");
    // Every tile number is ink (render 10). The tile carried a tone, so a
    // Breached count of zero was drawn in the "good" green, which is a signal
    // where there is none.
    expect(screen.getByRole("link", { name: /Breached/ }).querySelector("[data-tone]")).toBeNull();

    expect(screen.getByTestId("sla-response")).toHaveTextContent("94%");
    expect(screen.getByTestId("sla-resolution")).toHaveTextContent("90%");
    expect(screen.getByText("11.4h")).toBeInTheDocument();
    expect(screen.getByText("4%")).toBeInTheDocument();
    expect(screen.getByTestId("backlog-3_7d")).toHaveStyle({ height: "100px" });

    const notable = screen.getByTestId("notable-list");
    expect(notable.querySelectorAll("li")).toHaveLength(2);
    expect(notable.querySelector("li[data-breached]")).toHaveTextContent("CS0001204");

    expect(screen.getByRole("row", { name: /Brookfield/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("row", { name: /Northwind Health/ }));
    expect(push).toHaveBeenCalledWith("/accounts/acct-2");
  });

  it("re-fetches for the chosen period", async () => {
    const calls = stubFetch({
      "GET /v1/dashboards/operations": () =>
        json(anOperationsDashboard({ measures: someMeasures({ breached_now: 0 }) })),
    });
    renderDesk(<OperationsDashboard />);
    await waitFor(() => expect(screen.getByTestId("synthesis")).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole("radio", { name: "30 days" })[0]);
    await waitFor(() => expect(calls.some((call) => call.search === "?days=30")).toBe(true));
  });
});
