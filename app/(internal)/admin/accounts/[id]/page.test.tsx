import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminAccountRecordPage, { accountRecordTabs, initialTab } from "@/app/(internal)/admin/accounts/[id]/page";
import { aSkillsMatrixAccount } from "@/redux/capacityApi.test";
import { aBudget } from "@/redux/timeApi.test";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";
import { aRun, aSchedule } from "@/test-kit/reporting";

const ACCOUNT_ID = "77777777-7777-4777-8777-777777777777";
let search = "tab=budget";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: ACCOUNT_ID }),
  useSearchParams: () => new URLSearchParams(search),
  usePathname: () => `/admin/accounts/${ACCOUNT_ID}`,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: [ACCOUNT_ID], permissions } });

const account = () =>
  json({
    id: ACCOUNT_ID,
    key: "BRK",
    name: "Brookfield",
    status: "active",
    legal_name: null,
    isolation_tier: "shared",
    residency_region: "eu-west-1",
    default_time_zone: "Europe/London",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    version: 1,
  });

describe("initialTab", () => {
  it("opens the tab a link names and falls back to the overview", () => {
    expect(initialTab(new URLSearchParams("tab=budget"))).toBe("budget");
    expect(initialTab(new URLSearchParams("tab=contracts"))).toBe("contracts");
    expect(initialTab(new URLSearchParams("tab=reports"))).toBe("reports");
    expect(initialTab(new URLSearchParams("tab=nonsense"))).toBe("overview");
    expect(initialTab(new URLSearchParams(""))).toBe("overview");
    expect(initialTab(null)).toBe("overview");
  });

  it("keeps Contracts, Budget and Billing out of reach without contracts:view", () => {
    const keys = (permissions: string[] | undefined) =>
      accountRecordTabs(permissions ? new Set(permissions) : undefined).map((tab) => tab.key);
    expect(keys(["admin:accounts"])).not.toContain("budget");
    expect(keys(["admin:accounts"])).not.toContain("contracts");
    expect(keys(["admin:accounts"])).not.toContain("billing");
    expect(keys(["admin:accounts"])).toContain("overview");
    expect(keys(undefined)).not.toContain("budget");

    const full = keys(["admin:accounts", "contracts:view"]);
    expect(full).toContain("contracts");
    expect(full).toContain("budget");
    expect(full).toContain("billing");
    expect(initialTab(new URLSearchParams("tab=budget"), accountRecordTabs(new Set(["admin:accounts"])))).toBe(
      "overview",
    );
  });
});

describe("AdminAccountRecordPage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("resolves ?tab=budget (the threshold notification link) to the Budget view", async () => {
    search = "tab=budget";
    const calls = stubFetch({
      "GET /v1/admin/me": me(["admin:accounts", "contracts:view"]),
      [`GET /v1/admin/accounts/${ACCOUNT_ID}`]: account,
      [`GET /v1/accounts/${ACCOUNT_ID}/budget`]: () => json(aBudget({ account_id: ACCOUNT_ID })),
    });
    renderDesk(<AdminAccountRecordPage />);
    await screen.findByLabelText("CT10001 Support retainer");
    expect(screen.getByRole("tab", { name: "Budget" })).toHaveAttribute("aria-selected", "true");
    expect(calls.some((call) => call.key === `GET /v1/accounts/${ACCOUNT_ID}/budget`)).toBe(true);
  });

  it("opens the Report packs tab under reports:manage, reading the schedules and the runs for this account", async () => {
    search = "tab=reports";
    const calls = stubFetch({
      "GET /v1/admin/me": me(["admin:accounts", "reports:manage"]),
      [`GET /v1/admin/accounts/${ACCOUNT_ID}`]: account,
      "GET /v1/reporting/schedules": () => json([aSchedule({ account_id: ACCOUNT_ID })]),
      "GET /v1/reporting/runs": () => json([aRun({ account_id: ACCOUNT_ID })]),
    });
    renderDesk(<AdminAccountRecordPage />);
    await screen.findByRole("table", { name: "Report schedules" });
    expect(screen.getByRole("tab", { name: "Report packs" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Weekly on Monday at 06:00")).toBeInTheDocument();
    expect(calls.find((call) => call.key === "GET /v1/reporting/schedules")?.search).toBe(`?account=${ACCOUNT_ID}`);
    expect(calls.find((call) => call.key === "GET /v1/reporting/runs")?.search).toBe(`?account=${ACCOUNT_ID}`);
  });

  it("fails closed on the Report packs tab without reports:manage", async () => {
    search = "tab=reports";
    const calls = stubFetch({
      "GET /v1/admin/me": me(["admin:accounts", "tickets:view"]),
      [`GET /v1/admin/accounts/${ACCOUNT_ID}`]: account,
    });
    renderDesk(<AdminAccountRecordPage />);
    await screen.findByText(/Needs the reports:manage permission/);
    expect(calls.some((call) => call.key.startsWith("GET /v1/reporting/"))).toBe(false);
  });

  it("offers no Budget, Contracts or Billing tab without contracts:view and leaves the skills lens alone without capacity:view", async () => {
    search = "tab=budget";
    const calls = stubFetch({
      "GET /v1/admin/me": me(["admin:accounts"]),
      [`GET /v1/admin/accounts/${ACCOUNT_ID}`]: account,
    });
    renderDesk(<AdminAccountRecordPage />);
    await screen.findByText("Identity and residency");
    for (const label of ["Budget", "Contracts", "Billing"]) {
      expect(screen.queryByRole("tab", { name: label })).not.toBeInTheDocument();
    }
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    expect(calls.some((call) => call.key.endsWith("/budget"))).toBe(false);
    expect(calls.some((call) => call.key.endsWith("/contracts"))).toBe(false);
    expect(calls.some((call) => call.key.endsWith("/billing-periods"))).toBe(false);
    expect(calls.some((call) => call.key === "GET /v1/capacity/skills-matrix")).toBe(false);
    expect(screen.queryByRole("list", { name: "Skills coverage" })).not.toBeInTheDocument();
  });

  it("shows the single point of failure and gap chips under the record bar with capacity:view", async () => {
    search = "";
    const calls = stubFetch({
      "GET /v1/admin/me": me(["admin:accounts", "capacity:view"]),
      [`GET /v1/admin/accounts/${ACCOUNT_ID}`]: account,
      "GET /v1/capacity/skills-matrix": () =>
        json(aSkillsMatrixAccount({ accounts: [{ ...aSkillsMatrixAccount().accounts[0], account_id: ACCOUNT_ID }] })),
      "GET /v1/roster/skills": () =>
        json([{ id: "s-1", kind: "technology", code: "onestream", name: "OneStream", account_id: null, is_active: true }]),
    });
    renderDesk(<AdminAccountRecordPage />);
    await screen.findByText("Single point of failure: OneStream");
    expect(screen.getByText("Gap: sap")).toHaveAttribute("data-state", "overdue");
    expect(decodeURIComponent(calls.find((call) => call.key === "GET /v1/capacity/skills-matrix")?.search ?? "")).toBe(
      `?lens=account&account=${ACCOUNT_ID}`,
    );
  });
});
