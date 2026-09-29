import { screen, within } from "@testing-library/react";
import { formatDay } from "@/lib/format/date";
import { describe, expect, it, vi } from "vitest";
import { packTypeLabel, periodLabel, ReportPacksList } from "@/components/reporting/report-packs-list";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";
import type { ScheduleRun } from "@/redux/reportingApi";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

function run(overrides: Partial<ScheduleRun> = {}): ScheduleRun {
  return {
    id: "r1",
    account_id: "a1",
    schedule_id: "s1",
    pack_type: "wsr",
    period_start: "2026-09-01",
    period_end: "2026-09-07",
    status: "sent",
    error: null,
    pack_id: "p1",
    pptx_key: "key",
    delivery: [
      { kind: "contact", to: "sam@example.test", outcome: "emailed", reason: null },
      { kind: "contact", to: "pat@example.test", outcome: "skipped", reason: "no_address" },
    ],
    requested_by: "system",
    created_at: "2026-09-08T06:00:00Z",
    ...overrides,
  } as ScheduleRun;
}

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: ["a1"], permissions } });

const ACCOUNTS = () => json([{ id: "a1", key: "BRK", name: "Brookfield", status: "active" }]);

describe("packTypeLabel", () => {
  it("puts a short key in capitals and words a long one", () => {
    expect(packTypeLabel("wsr")).toBe("WSR");
    expect(packTypeLabel("qbr")).toBe("QBR");
    expect(packTypeLabel("executive_summary")).toBe("executive summary");
  });
});

describe("periodLabel", () => {
  it("reads as a span rather than two dates side by side", () => {
    expect(periodLabel("2026-09-01", "2026-09-07")).toBe(`${formatDay("2026-09-01")} to ${formatDay("2026-09-07")}`);
  });
});

describe("ReportPacksList", () => {
  it("is closed, and asks nothing, without reports:manage", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["reports:view-portfolio"]),
      "GET /v1/reporting/runs": () => json([run()]),
      "GET /v1/accounts": ACCOUNTS,
    });
    renderDesk(<ReportPacksList />);
    expect(await screen.findByText("Not permitted")).toBeInTheDocument();
    expect(calls.some((call) => call.key.includes("/v1/reporting/runs"))).toBe(false);
  });

  it("names the account, the period and how many the run actually reached", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["reports:manage"]),
      "GET /v1/reporting/runs": () => json([run()]),
      "GET /v1/accounts": ACCOUNTS,
    });
    renderDesk(<ReportPacksList />);

    const table = within(await screen.findByRole("table", { name: "Report packs" }));
    expect(table.getByText("WSR")).toBeInTheDocument();
    expect(table.getByText("Brookfield")).toBeInTheDocument();
    expect(table.getByText(`${formatDay("2026-09-01")} to ${formatDay("2026-09-07")}`)).toBeInTheDocument();
    // One of the two was skipped, so one was reached.
    expect(table.getByText("1 of 2")).toBeInTheDocument();
  });

  it("says a run reached nobody rather than printing a zero", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["reports:manage"]),
      "GET /v1/reporting/runs": () => json([run({ delivery: null, status: "ready_for_review" })]),
      "GET /v1/accounts": ACCOUNTS,
    });
    renderDesk(<ReportPacksList />);
    const table = within(await screen.findByRole("table", { name: "Report packs" }));
    expect(table.getByText("Nobody yet")).toBeInTheDocument();
    expect(table.getByText("Ready for review")).toBeInTheDocument();
  });

  it("shows the problem where a run failed", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["reports:manage"]),
      "GET /v1/reporting/runs": () => json([run({ status: "failed", error: "the pack had no numbers" })]),
      "GET /v1/accounts": ACCOUNTS,
    });
    renderDesk(<ReportPacksList />);
    const table = within(await screen.findByRole("table", { name: "Report packs" }));
    expect(table.getByText("the pack had no numbers")).toBeInTheDocument();
  });
});
