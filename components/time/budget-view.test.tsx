import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountBudgetView } from "@/components/time/budget-view";
import {
  aBudget,
  aBudgetCard,
  aBudgetEntries,
  aForecast,
  aPosition,
  aThresholdEvent,
  aThresholds,
} from "@/test-kit/time";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/accounts/acct-1" }));

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: ["acct-1"], permissions } });

const BUDGET = "GET /v1/accounts/acct-1/budget";
const ENTRIES = "GET /v1/accounts/acct-1/budget/entries";
const CATALOGS = "GET /v1/catalogs";

const catalogs = () =>
  json({
    resolution_codes: [],
    activity_types: [
      { key: "analysis", label: "Analysis", billable_class: "billable" },
      { key: "development", label: "Development", billable_class: "billable" },
    ],
    billable_classes: [
      { key: "billable", label: "Billable", consumes_contract: true },
      { key: "absorbed", label: "Absorbed", consumes_contract: false },
    ],
  });

function overPosition() {
  const { contract: _contract, ...position } = aPosition({
    consumed_minutes: 2500,
    remaining_minutes: 0,
    percent_consumed: 104.2,
    status: "over",
  });
  void _contract;
  return position;
}

describe("AccountBudgetView", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fails closed without contracts:view and never reads the budget", async () => {
    const calls = stubFetch({ "GET /v1/admin/me": me(["admin:accounts"]) });
    renderDesk(<AccountBudgetView accountId="acct-1" />);
    await screen.findByText(/Needs the contracts:view permission/);
    expect(calls.some((call) => call.key === BUDGET)).toBe(false);
  });

  it("shows an on-track contract: the burn bar, the next threshold and the forecast sentence with its figures", async () => {
    stubFetch({ "GET /v1/admin/me": me(["contracts:view"]), [BUDGET]: () => json(aBudget()), [CATALOGS]: catalogs });
    renderDesk(<AccountBudgetView accountId="acct-1" />);
    const card = await screen.findByLabelText("CT10001 Support retainer");
    expect(within(card).getByText("On track")).toBeInTheDocument();
    expect(card.querySelector("[data-consumed]")).toHaveTextContent("10 h");
    expect(card).toHaveTextContent("of 40 h used, 30 h remaining");
    const bar = within(card).getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "25");
    expect(bar).toHaveAttribute("data-tone", "good");
    expect(bar.querySelectorAll("[data-marker]")).toHaveLength(4);
    expect(bar.querySelector('[data-marker="50"]')).toHaveAttribute("data-next", "true");
    expect(bar.querySelector("[data-fired]")).toBeNull();
    expect(within(card).getByRole("list", { name: "Thresholds" })).toHaveTextContent("50% next, at 20 h");
    expect(card.querySelector("[data-forecast]")).toHaveTextContent(
      "At the current rate of 2 h per business day the period ends at 110% of the budget; the budget runs out in 15 business days.",
    );
    expect(
      within(card).getByText("Rate over the last 5 business days; 5 of 22 business days elapsed."),
    ).toBeInTheDocument();
    expect(card.querySelector("[data-unrated]")).toBeNull();
    expect(screen.getByText(/As of/)).toHaveTextContent("2026-09-07");
  });

  it("turns amber after the first fired threshold and notes unrated minutes", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["contracts:view"]),
      [BUDGET]: () =>
        json(
          aBudget({
            contracts: [
              aBudgetCard({
                thresholds: aThresholds({
                  fired: [50],
                  next_percent: 75,
                  next_at_minutes: 1800,
                  events: [aThresholdEvent()],
                }),
                unrated_minutes: 90,
              }),
            ],
          }),
        ),
      [CATALOGS]: catalogs,
    });
    renderDesk(<AccountBudgetView accountId="acct-1" />);
    const card = await screen.findByLabelText("CT10001 Support retainer");
    const bar = within(card).getByRole("progressbar");
    expect(bar).toHaveAttribute("data-tone", "warn");
    expect(bar.querySelector('[data-marker="50"]')).toHaveAttribute("data-fired", "true");
    expect(bar.querySelector('[data-marker="75"]')).toHaveAttribute("data-next", "true");
    const legend = within(card).getByRole("list", { name: "Thresholds" });
    expect(legend).toHaveTextContent("50% fired 2026-09-04");
    expect(legend).toHaveTextContent("75% next, at 30 h");
    expect(card.querySelector("[data-unrated]")).toHaveTextContent(
      "1.5 h in this period carry no rate; add a rate card for the roles involved before the period locks.",
    );
  });

  it("turns red when the period is over its budget and says the budget is used up", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["contracts:view"]),
      [BUDGET]: () =>
        json(
          aBudget({
            contracts: [
              aBudgetCard({
                position: overPosition(),
                forecast: aForecast({
                  forecast_minutes: 2900,
                  forecast_percent: 120.8,
                  business_days_to_exhaustion: 0,
                }),
                thresholds: aThresholds({ fired: [50, 75, 90, 100], next_percent: null, next_at_minutes: null }),
              }),
            ],
          }),
        ),
      [CATALOGS]: catalogs,
    });
    renderDesk(<AccountBudgetView accountId="acct-1" />);
    const card = await screen.findByLabelText("CT10001 Support retainer");
    expect(within(card).getByText("Over")).toBeInTheDocument();
    const bar = within(card).getByRole("progressbar");
    expect(bar).toHaveAttribute("data-tone", "breach");
    expect(bar).toHaveAttribute("aria-valuenow", "100");
    expect(bar.querySelectorAll("[data-fired]")).toHaveLength(4);
    expect(card.querySelector("[data-forecast]")).toHaveTextContent(
      "At the current rate of 2 h per business day the period ends at 120.8% of the budget; the budget is already used up.",
    );
  });

  it("drills through to the entries with the period as the default range and sends the filters to the API", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["contracts:view"]),
      [BUDGET]: () => json(aBudget()),
      [CATALOGS]: catalogs,
      [ENTRIES]: () => {
        const last = calls[calls.length - 1];
        if (last.search.includes("person=p-2")) {
          const all = aBudgetEntries();
          return json({ ...all, entries: [all.entries[1]], total_minutes: 60, total_amount: 150 });
        }
        return json(aBudgetEntries());
      },
    });
    renderDesk(<AccountBudgetView accountId="acct-1" />);
    const card = await screen.findByLabelText("CT10001 Support retainer");
    expect(calls.some((call) => call.key === ENTRIES)).toBe(false);
    fireEvent.click(within(card).getByRole("button", { name: "Show entries" }));
    await waitFor(() => expect(document.querySelector('[data-entry="be-2"]')).toHaveTextContent("Dev Patel"));
    expect(calls.find((call) => call.key === ENTRIES)?.search).toBe("?from=2026-09-01&to=2026-09-30&contract=c-1");
    expect(screen.getByTestId("entries-total-hours")).toHaveTextContent("3 h");
    expect(screen.getByTestId("entries-total-amount")).toHaveTextContent("USD 375.00");
    expect(document.querySelector('[data-entry="be-1"] [data-amount]')).toHaveTextContent("USD 225.00");
    expect(document.querySelector('[data-entry="be-3"] [data-amount]')).toHaveTextContent("unrated");
    expect(within(document.querySelector('[data-entry="be-1"]') as HTMLElement).getByText("CS1000001")).toHaveAttribute(
      "href",
      "/tickets/CS1000001",
    );
    expect(
      within(document.querySelector('[data-entry="be-2"]') as HTMLElement).getByText("Internal"),
    ).toBeInTheDocument();
    const exportButton = screen.getByRole("button", { name: "Export" });
    expect(exportButton).toBeDisabled();
    expect(exportButton).toHaveAttribute("title", expect.stringContaining("not available yet"));

    fireEvent.change(screen.getByLabelText("Person"), { target: { value: "p-2" } });
    fireEvent.change(screen.getByLabelText("Activity"), { target: { value: "development" } });
    fireEvent.change(screen.getByLabelText("Billable class"), { target: { value: "billable" } });
    fireEvent.change(screen.getByLabelText("Entries from"), { target: { value: "2026-09-04" } });
    await waitFor(() => expect(screen.getByTestId("entries-total-hours")).toHaveTextContent("1 h"));
    expect(calls[calls.length - 1].key).toBe(ENTRIES);
    expect(calls[calls.length - 1].search).toBe(
      "?from=2026-09-04&to=2026-09-30&contract=c-1&person=p-2&activity=development&class=billable",
    );
    expect(screen.getByTestId("entries-total-amount")).toHaveTextContent("USD 150.00");
    // The chosen person stays pickable while the list holds only their entries.
    expect(screen.getByLabelText("Person")).toHaveValue("p-2");
    expect(screen.queryByText("Cara Lee")).not.toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Hide entries" }));
    expect(screen.queryByTestId("budget-entries")).not.toBeInTheDocument();
  });

  it("says so when a contract has no period and when the account has no contract", async () => {
    let first = true;
    stubFetch({
      "GET /v1/admin/me": me(["contracts:view"]),
      [BUDGET]: () => {
        const body = first
          ? aBudget({ contracts: [aBudgetCard({ period: null, position: null, forecast: null, thresholds: null })] })
          : aBudget({ contracts: [] });
        first = false;
        return json(body);
      },
      [CATALOGS]: catalogs,
    });
    const { unmount } = renderDesk(<AccountBudgetView accountId="acct-1" />);
    await screen.findByText(/No period on this contract yet/);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    unmount();
    renderDesk(<AccountBudgetView accountId="acct-1" />);
    await screen.findByText(/No active contract on this account/);
  });
});
