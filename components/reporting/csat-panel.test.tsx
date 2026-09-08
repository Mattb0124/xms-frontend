import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountCsatView } from "@/components/reporting/csat-panel";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";
import { aCsatSummary } from "@/test-kit/reporting";

vi.mock("next/navigation", () => ({ usePathname: () => "/accounts/acct-1" }));

const CSAT = "GET /v1/accounts/acct-1/csat";

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: ["acct-1"], permissions } });

describe("AccountCsatView", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fails closed without tickets:view and never reads the scores", async () => {
    const calls = stubFetch({ "GET /v1/admin/me": me(["capacity:view"]) });
    renderDesk(<AccountCsatView accountId="acct-1" />);
    await screen.findByText(/Needs the tickets:view permission/);
    expect(calls.some((call) => call.key === CSAT)).toBe(false);
  });

  it("shows the average, the five bars, the low count, the surveys sent and answered, and the responses", async () => {
    const calls = stubFetch({ "GET /v1/admin/me": me(["tickets:view"]), [CSAT]: () => json(aCsatSummary()) });
    renderDesk(<AccountCsatView accountId="acct-1" />);
    await screen.findByTestId("account-csat");
    await waitFor(() => expect(screen.getByLabelText("Average score")).toHaveTextContent("3.5 of 5"));
    expect(screen.getByLabelText("Responses in range")).toHaveTextContent("2");
    expect(screen.getByLabelText("Responses in range")).toHaveTextContent("2026-06-09 to 2026-09-07");
    expect(screen.getByLabelText("Low scores")).toHaveTextContent("1");
    expect(screen.getByLabelText("Surveys")).toHaveTextContent("4 sent, 2 answered");
    expect(screen.getByLabelText("Surveys")).toHaveTextContent("1 suppressed");
    // The range goes out as the API names it (its own ninety-day default when untouched).
    const first = calls.find((call) => call.key === CSAT);
    expect(first?.search).toMatch(/^\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/);

    const bars = within(screen.getByRole("list", { name: "Score distribution" })).getAllByRole("listitem");
    expect(bars.map((bar) => bar.getAttribute("data-score"))).toEqual(["5", "4", "3", "2", "1"]);
    expect(bars.map((bar) => bar.getAttribute("data-count"))).toEqual(["1", "0", "0", "1", "0"]);
    expect(bars.map((bar) => bar.getAttribute("data-percent"))).toEqual(["100", "0", "0", "100", "0"]);
    expect(bars[0]).toHaveTextContent("Very satisfied");
    expect(bars[4]).toHaveTextContent("Very dissatisfied");

    const table = screen.getByRole("table", { name: "Survey responses" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("5 of 5")).toHaveAttribute("data-state", "complete");
    expect(within(rows[0]).getByRole("link", { name: "CS0001001" })).toHaveAttribute("href", "/tickets/CS0001001");
    expect(rows[0]).toHaveTextContent("No comment");
    expect(rows[0]).toHaveTextContent("Pat Client (pat@client.test)");
    expect(rows[0]).toHaveTextContent("2026-09-06");
    expect(within(rows[1]).getByText("2 of 5")).toHaveAttribute("data-state", "overdue");
    expect(rows[1]).toHaveTextContent("Took too long to hear back");
    expect(rows[1]).toHaveTextContent("Anonymous");
  });

  it("sends a changed range and shows the empty states", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["tickets:view"]),
      [CSAT]: () =>
        json(
          aCsatSummary({
            from: "2026-01-01",
            to: "2026-01-31",
            summary: { responses: 0, average: null, distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 }, low: 0 },
            surveys: { sent: 0, answered: 0, suppressed: 0 },
            responses: [],
          }),
        ),
    });
    renderDesk(<AccountCsatView accountId="acct-1" />);
    await screen.findByLabelText("Average score");
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-01-31" } });
    await waitFor(() =>
      expect(calls.some((call) => call.key === CSAT && call.search === "?from=2026-01-01&to=2026-01-31")).toBe(true),
    );
    expect(screen.getByLabelText("Average score")).toHaveTextContent("No responses yet");
    expect(screen.getByLabelText("Surveys")).toHaveTextContent("0 sent, 0 answered");
    expect(screen.getByLabelText("Surveys")).not.toHaveTextContent("suppressed");
    expect(screen.getByText("No responses in this range.")).toBeInTheDocument();
  });
});
