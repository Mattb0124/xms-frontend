import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CompTimePanel, daysBefore } from "@/components/time/comp-time-panel";
import { aCompTimeReport } from "@/redux/timeApi.test";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({ usePathname: () => "/accounts/acct-1" }));

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: ["acct-1"], permissions } });

const ROUTE = "GET /v1/accounts/acct-1/time/comp-time";

describe("CompTimePanel", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("computes the default range", () => {
    expect(daysBefore("2026-09-07", 30)).toBe("2026-08-08");
    expect(daysBefore("2026-03-01", 1)).toBe("2026-02-28");
  });

  it("renders nothing without tickets:view and never asks the API", async () => {
    const calls = stubFetch({ "GET /v1/admin/me": me(["time:log"]) });
    const { container } = renderDesk(<CompTimePanel accountId="acct-1" today="2026-09-07" />);
    await waitFor(() => expect(calls.some((call) => call.key === "GET /v1/admin/me")).toBe(true));
    expect(container.querySelector("section")).toBeNull();
    expect(calls.some((call) => call.key === ROUTE)).toBe(false);
  });

  it("lists minutes and entries per person with the totals over the last 30 days, then re-reads on a new range", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["tickets:view"]),
      [ROUTE]: () => {
        const last = calls[calls.length - 1];
        return json(
          last.search.includes("from=2026-09-01")
            ? aCompTimeReport({ from: "2026-09-01", entries: [], total_minutes: 0, by_person: [] })
            : aCompTimeReport(),
        );
      },
    });
    renderDesk(<CompTimePanel accountId="acct-1" today="2026-09-07" />);
    await screen.findByText("Dev Patel");
    expect(calls.find((call) => call.key === ROUTE)?.search).toBe("?from=2026-08-08&to=2026-09-07");
    const cara = document.querySelector('[data-person="p-1"]') as HTMLElement;
    expect(cara).toHaveTextContent("Cara Lee");
    expect(cara).toHaveTextContent("2");
    expect(cara.querySelector("[data-person-minutes]")).toHaveTextContent("2h");
    expect(document.querySelector('[data-person="p-2"] [data-person-minutes]')).toHaveTextContent("1h");
    expect(screen.getByTestId("comp-time-total")).toHaveTextContent("3h");
    expect(screen.getByTestId("comp-time-entries")).toHaveTextContent("3");

    fireEvent.change(screen.getByLabelText("Comp time from"), { target: { value: "2026-09-01" } });
    await screen.findByText("No comp time in this range.");
    expect(calls.filter((call) => call.key === ROUTE).map((call) => call.search)).toEqual([
      "?from=2026-08-08&to=2026-09-07",
      "?from=2026-09-01&to=2026-09-07",
    ]);
    expect(screen.getByTestId("comp-time-total")).toHaveTextContent("0m");

    fireEvent.change(screen.getByLabelText("Comp time to"), { target: { value: "2026-08-01" } });
    expect(screen.getByText("Choose a range where From is not after To.")).toBeInTheDocument();
    expect(calls.filter((call) => call.key === ROUTE)).toHaveLength(2);
  });
});
