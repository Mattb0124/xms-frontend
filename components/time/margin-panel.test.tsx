import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  AccountMarginPanel,
  caveat,
  hours,
  money,
  monthLabel,
  monthWindow,
  recentMonths,
} from "@/components/time/margin-panel";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";
import type { MarginLine } from "@/redux/profitabilityApi";

function line(overrides: Partial<MarginLine> = {}): MarginLine {
  return {
    key: "consultant",
    label: "consultant",
    minutes: 120,
    revenue: 400,
    cost: 190,
    margin: 210,
    margin_percent: 52.5,
    minutes_without_cost: 0,
    minutes_without_rate: 0,
    ...overrides,
  };
}

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: ["a1"], permissions } });

describe("monthWindow", () => {
  it("is the first and last day of the month named", () => {
    expect(monthWindow("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthWindow("2026-09")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
  });
});

describe("recentMonths", () => {
  it("counts back from the month in hand, newest first, and crosses the year", () => {
    expect(recentMonths(new Date("2026-02-15T00:00:00Z"), 3)).toEqual(["2026-02", "2026-01", "2025-12"]);
  });

  it("words a month for a reader rather than as a key", () => {
    expect(monthLabel("2026-09")).toBe("September 2026");
  });
});

describe("money and hours", () => {
  it("says a figure it could not read is not known, rather than printing a zero", () => {
    expect(money(null, "USD")).toBe("Not known");
    expect(money(0, "USD")).toBe("$0");
  });

  it("reads minutes back as hours", () => {
    expect(hours(90)).toBe("1.5 h");
    expect(hours(0)).toBe("0 h");
  });
});

describe("caveat", () => {
  it("is silent where everything was weighed", () => {
    expect(caveat(line())).toBe("");
  });

  it("names the time it could not weigh, and why", () => {
    expect(caveat(line({ minutes_without_cost: 60 }))).toBe("Not weighed: 1 h by people with no cost rate on file.");
    expect(caveat(line({ minutes_without_cost: 60, minutes_without_rate: 30 }))).toBe(
      "Not weighed: 1 h by people with no cost rate on file, and 0.5 h carrying no bill rate.",
    );
  });
});

describe("AccountMarginPanel", () => {
  const body = {
    total: line({ key: "total", label: "Total" }),
    by_role: [line()],
    by_person: [line({ key: "u1", label: "Cara Lee" })],
    currencies: ["USD"],
  };

  it("is not drawn at all for a reader without finance:view-margin", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["contracts:view"]),
      "GET /v1/accounts/a1/profitability": () => json(body),
    });
    renderDesk(<AccountMarginPanel accountId="a1" />);
    await screen.findByTestId("__nothing__").catch(() => undefined);
    expect(screen.queryByTestId("account-margin")).toBeNull();
    // And it never asks: the browser fails closed rather than letting the API refuse.
    expect(calls.some((call) => call.key.includes("profitability"))).toBe(false);
  });

  it("shows the margin, what it stands on, and the breakdowns", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["finance:view-margin"]),
      "GET /v1/accounts/a1/profitability": () => json(body),
    });
    renderDesk(<AccountMarginPanel accountId="a1" />);

    // The sentence exists only once the figures have arrived, so waiting on
    // it is waiting on the panel rather than on its wrapper.
    const sentence = "$400 billed against $190 of cost over 2 h, keeping 52.5%.";
    expect(await screen.findByText((text) => text.includes(sentence))).toBeInTheDocument();
    // The headline, and the same figure again in each breakdown row.
    expect(screen.getAllByText("$210")).toHaveLength(3);
    expect(within(screen.getByRole("table", { name: "By person" })).getByText("Cara Lee")).toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: "By role" })).getByText("consultant")).toBeInTheDocument();
  });

  it("says what it could not weigh rather than letting the number stand alone", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["finance:view-margin"]),
      "GET /v1/accounts/a1/profitability": () =>
        json({ ...body, total: line({ key: "total", label: "Total", minutes_without_cost: 120 }) }),
    });
    renderDesk(<AccountMarginPanel accountId="a1" />);
    expect(await screen.findByText(/Not weighed: 2 h by people with no cost rate on file\./)).toBeInTheDocument();
  });

  it("warns where more than one currency is in play, since the figures then do not add up", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["finance:view-margin"]),
      "GET /v1/accounts/a1/profitability": () => json({ ...body, currencies: ["GBP", "USD"] }),
    });
    renderDesk(<AccountMarginPanel accountId="a1" />);
    expect(await screen.findByText(/More than one currency is in play here \(GBP, USD\)/)).toBeInTheDocument();
  });
});
