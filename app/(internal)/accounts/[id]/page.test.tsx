import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AccountPage, { accountTabs, initialAccountTab } from "@/app/(internal)/accounts/[id]/page";
import { aSkillsMatrixAccount } from "@/redux/capacityApi.test";
import { aBudget } from "@/redux/timeApi.test";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";
import { aCsatSummary, anAccountDashboard } from "@/test-kit/reporting";

let search = "tab=budget";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "acct-1" }),
  useSearchParams: () => new URLSearchParams(search),
  usePathname: () => "/accounts/acct-1",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: ["acct-1"], permissions } });

describe("initialAccountTab", () => {
  it("opens the tab a link names and falls back to the dashboard", () => {
    expect(initialAccountTab(new URLSearchParams("tab=budget"))).toBe("budget");
    expect(initialAccountTab(new URLSearchParams("tab=satisfaction"))).toBe("satisfaction");
    expect(initialAccountTab(new URLSearchParams("tab=nonsense"))).toBe("dashboard");
    expect(initialAccountTab(new URLSearchParams(""))).toBe("dashboard");
    expect(initialAccountTab(null)).toBe("dashboard");
  });

  it("keeps the Budget tab out of reach without contracts:view", () => {
    const withoutContracts = accountTabs(new Set(["tickets:view"]));
    expect(withoutContracts.map((tab) => tab.key)).toEqual(["dashboard", "satisfaction"]);
    expect(initialAccountTab(new URLSearchParams("tab=budget"), withoutContracts)).toBe("dashboard");

    const withContracts = accountTabs(new Set(["tickets:view", "contracts:view"]));
    expect(withContracts.map((tab) => tab.key)).toEqual(["dashboard", "budget", "satisfaction"]);
    expect(initialAccountTab(new URLSearchParams("tab=budget"), withContracts)).toBe("budget");
    expect(accountTabs(undefined).map((tab) => tab.key)).toEqual(["dashboard", "satisfaction"]);
  });
});

describe("AccountPage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("resolves ?tab=satisfaction to the CSAT view with the range as the API names it", async () => {
    search = "tab=satisfaction";
    const calls = stubFetch({
      "GET /v1/admin/me": me(["tickets:view"]),
      "GET /v1/accounts/acct-1/csat": () => json(aCsatSummary()),
    });
    renderDesk(<AccountPage />);
    await screen.findByTestId("account-csat");
    expect(screen.getByRole("tab", { name: "Satisfaction" })).toHaveAttribute("aria-selected", "true");
    await screen.findByRole("list", { name: "Score distribution" });
    const csat = calls.find((call) => call.key === "GET /v1/accounts/acct-1/csat");
    expect(csat?.search).toMatch(/^\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/);
    expect(calls.some((call) => call.key === "GET /v1/dashboards/accounts/acct-1")).toBe(false);
  });

  it("resolves ?tab=budget to the Budget view for a reader with contracts:view and no admin:accounts", async () => {
    search = "tab=budget";
    const calls = stubFetch({
      "GET /v1/admin/me": me(["tickets:view", "contracts:view"]),
      "GET /v1/accounts/acct-1/budget": () => json(aBudget()),
      "GET /v1/catalogs": () => json({ resolution_codes: [], activity_types: [], billable_classes: [] }),
    });
    renderDesk(<AccountPage />);
    await screen.findByLabelText("CT10001 Support retainer");
    expect(screen.getByRole("tab", { name: "Budget" })).toHaveAttribute("aria-selected", "true");
    expect(calls.some((call) => call.key === "GET /v1/accounts/acct-1/budget")).toBe(true);
    expect(calls.some((call) => call.key === "GET /v1/dashboards/accounts/acct-1")).toBe(false);
    // No capacity:view: the coverage chips are neither asked for nor shown.
    expect(calls.some((call) => call.key === "GET /v1/capacity/skills-matrix")).toBe(false);
    expect(screen.queryByRole("list", { name: "Skills coverage" })).not.toBeInTheDocument();
  });

  it("shows the coverage chips above the tabs for a reader with capacity:view", async () => {
    search = "tab=budget";
    const calls = stubFetch({
      "GET /v1/admin/me": me(["tickets:view", "contracts:view", "capacity:view"]),
      "GET /v1/accounts/acct-1/budget": () => json(aBudget()),
      "GET /v1/catalogs": () => json({ resolution_codes: [], activity_types: [], billable_classes: [] }),
      "GET /v1/capacity/skills-matrix": () =>
        json(aSkillsMatrixAccount({ accounts: [{ ...aSkillsMatrixAccount().accounts[0], account_id: "acct-1" }] })),
    });
    renderDesk(<AccountPage />);
    await screen.findByText("Single point of failure: onestream");
    expect(screen.getByText("Gap: sap")).toHaveAttribute("data-state", "overdue");
    expect(decodeURIComponent(calls.find((call) => call.key === "GET /v1/capacity/skills-matrix")?.search ?? "")).toBe(
      "?lens=account&account=acct-1",
    );
  });


  it("opens on the dashboard without a tab and switches to the budget on click", async () => {
    search = "";
    const calls = stubFetch({
      "GET /v1/admin/me": me(["tickets:view", "contracts:view"]),
      "GET /v1/accounts": () => json([{ id: "acct-1", key: "BRK", name: "Brookfield", status: "active" }]),
      "GET /v1/dashboards/accounts/acct-1": () => json(anAccountDashboard()),
      "GET /v1/accounts/acct-1/reports": () => json([]),
      "GET /v1/accounts/acct-1/time/comp-time": () => json({ from: "", to: "", entries: [], total_minutes: 0, by_person: [] }),
      "GET /v1/accounts/acct-1/budget": () => json(aBudget()),
      "GET /v1/catalogs": () => json({ resolution_codes: [], activity_types: [], billable_classes: [] }),
    });
    renderDesk(<AccountPage />);
    await screen.findByTestId("account-dashboard");
    expect(screen.getByRole("tab", { name: "Dashboard" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("tab", { name: "Budget" }));
    await screen.findByLabelText("CT10001 Support retainer");
    expect(calls.some((call) => call.key === "GET /v1/accounts/acct-1/budget")).toBe(true);
  });

  it("fails closed without tickets:view", async () => {
    search = "tab=budget";
    const calls = stubFetch({ "GET /v1/admin/me": me(["capacity:view"]) });
    renderDesk(<AccountPage />);
    await screen.findByText("Not permitted");
    expect(calls.some((call) => call.key.endsWith("/budget"))).toBe(false);
  });

  it("offers no Budget tab, and opens the dashboard, for a reader without contracts:view", async () => {
    search = "tab=budget";
    const calls = stubFetch({
      "GET /v1/admin/me": me(["tickets:view"]),
      "GET /v1/accounts": () => json([{ id: "acct-1", key: "BRK", name: "Brookfield", status: "active" }]),
      "GET /v1/dashboards/accounts/acct-1": () => json(anAccountDashboard()),
      "GET /v1/accounts/acct-1/reports": () => json([]),
    });
    renderDesk(<AccountPage />);
    await screen.findByTestId("account-dashboard");
    expect(screen.queryByRole("tab", { name: "Budget" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Dashboard" })).toHaveAttribute("aria-selected", "true");
    expect(calls.some((call) => call.key.endsWith("/budget"))).toBe(false);
    expect(calls.some((call) => call.key.endsWith("/time/comp-time"))).toBe(false);
  });
});
