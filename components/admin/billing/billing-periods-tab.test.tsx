import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BillingPeriodsTab } from "@/components/admin/billing/billing-periods-tab";
import { DownloadError } from "@/lib/exports/download";
import { aBillingExport, aBillingPeriod, aLockedPeriod } from "@/redux/timeApi.test";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/accounts/acct-1" }));

const downloadFile = vi.fn();
vi.mock("@/lib/exports/download", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/exports/download")>();
  return { ...actual, downloadFile: (request: unknown) => downloadFile(request) };
});

const PERIODS = "GET /v1/accounts/acct-1/billing-periods";

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: ["acct-1"], permissions } });

describe("BillingPeriodsTab", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    downloadFile.mockReset();
  });

  it("fails closed without contracts:view and never reads the periods", async () => {
    const calls = stubFetch({ "GET /v1/admin/me": me(["admin:accounts"]) });
    renderDesk(<BillingPeriodsTab accountId="acct-1" />);
    await screen.findByText(/Needs the contracts:view permission/);
    expect(calls.some((call) => call.key === PERIODS)).toBe(false);
  });

  it("lists the periods with status pills and the summary figures, offering no actions to a plain reader", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["contracts:view"]),
      [PERIODS]: () => json([aBillingPeriod(), aLockedPeriod()]),
    });
    renderDesk(<BillingPeriodsTab accountId="acct-1" />);
    const table = await screen.findByRole("table", { name: "Billing periods" });
    const open = within(table).getByRole("row", { name: /September 2026/ });
    expect(within(open).getByText("Open")).toHaveAttribute("data-state", "ready");
    expect(open).toHaveTextContent("Not summarized yet");
    const locked = within(table).getByRole("row", { name: /August 2026/ });
    expect(within(locked).getByText("Locked")).toHaveAttribute("data-state", "blocked");
    expect(locked.querySelector("[data-summary-hours]")).toHaveTextContent("2.3 h");
    expect(locked.querySelector("[data-summary-amount]")).toHaveTextContent("225.00");
    expect(locked).toHaveTextContent("from 3 entries");
    expect(locked).toHaveTextContent("billable 1.8 h (175.00), absorbed 0.5 h (50.00)");
    expect(locked.querySelector("[data-unrated]")).toHaveTextContent("0.5 h carry no rate");
    expect(locked).toHaveTextContent("3f2a9c8e1b7d");
    // Who moved it, by the names the server resolved, with the day.
    expect(locked.querySelector("[data-by='submitted']")).toHaveTextContent("Submitted by Ana Silva 2026-09-01");
    expect(locked.querySelector("[data-by='approved']")).toHaveTextContent("Approved by Ben Ito 2026-09-02");
    expect(locked.querySelector("[data-by='locked']")).toHaveTextContent("Locked by Ben Ito 2026-09-03");
    expect(open.querySelector("[data-period-people]")).toBeNull();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "New billing period" })).not.toBeInTheDocument();
  });

  it("names the automatic lock as System", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["contracts:view"]),
      [PERIODS]: () =>
        json([aLockedPeriod({ locked_by: null, locked_by_name: "System", locked_at: "2026-09-07T09:00:00Z" })]),
    });
    renderDesk(<BillingPeriodsTab accountId="acct-1" />);
    const locked = await screen.findByRole("row", { name: /August 2026/ });
    expect(locked.querySelector("[data-by='locked']")).toHaveTextContent("Locked by System 2026-09-07");
    expect(locked.querySelector("[data-by='approved']")).toHaveTextContent("Approved by Ben Ito");
  });

  it("creates a period for the chosen month under time:lock-period", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["contracts:view", "time:lock-period"]),
      [PERIODS]: () => json([]),
      "POST /v1/accounts/acct-1/billing-periods": () =>
        json(aBillingPeriod({ id: "bp-new", starts_on: "2026-10-01", ends_on: "2026-10-31" }), 201),
    });
    renderDesk(<BillingPeriodsTab accountId="acct-1" />);
    await screen.findByText(/No billing period yet/);
    fireEvent.change(screen.getByLabelText("Period month"), { target: { value: "2026-10" } });
    fireEvent.click(screen.getByRole("button", { name: "New period" }));
    await screen.findByText("Period created");
    expect(calls.find((call) => call.key === "POST /v1/accounts/acct-1/billing-periods")?.body).toEqual({
      starts_on: "2026-10-01",
      ends_on: "2026-10-31",
    });
    expect(screen.getByText("October 2026")).toBeInTheDocument();
  });

  it("offers Submit and Reopen to contracts:manage only, sending the version, and words invalid_transition", async () => {
    let status: "open" | "submitted" = "open";
    const calls = stubFetch({
      "GET /v1/admin/me": me(["contracts:view", "contracts:manage"]),
      [PERIODS]: () => json([aBillingPeriod({ status, version: status === "open" ? 1 : 2 })]),
      "POST /v1/accounts/acct-1/billing-periods/bp-1/submit": () => {
        status = "submitted";
        return json(aBillingPeriod({ status: "submitted", version: 2 }), 201);
      },
      "POST /v1/accounts/acct-1/billing-periods/bp-1/reopen": () =>
        json({ code: "invalid_transition", status: "approved", allowed: ["lock"] }, 409),
    });
    renderDesk(<BillingPeriodsTab accountId="acct-1" />);
    const row = await screen.findByRole("row", { name: /September 2026/ });
    expect(within(row).queryByRole("button", { name: "Lock" })).not.toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    fireEvent.click(within(row).getByRole("button", { name: "Submit" }));
    await screen.findByText("Period submitted");
    expect(calls.find((call) => call.key.endsWith("/submit"))?.body).toEqual({ version: 1 });
    const reopen = await screen.findByRole("button", { name: "Reopen" });
    fireEvent.click(reopen);
    await screen.findByText("This period is approved; from here it can only be lock. The list has been reloaded.");
    expect(calls.find((call) => call.key.endsWith("/reopen"))?.body).toEqual({ version: 2 });
    expect(calls.filter((call) => call.key === PERIODS).length).toBeGreaterThanOrEqual(3);
  });

  it("offers Approve and Lock to time:lock-period behind a confirm and words stale_version", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["contracts:view", "time:lock-period"]),
      [PERIODS]: () => json([aBillingPeriod({ status: "submitted", version: 2 })]),
      "POST /v1/accounts/acct-1/billing-periods/bp-1/approve": () => json({ code: "stale_version" }, 409),
    });
    renderDesk(<BillingPeriodsTab accountId="acct-1" />);
    const row = await screen.findByRole("row", { name: /September 2026/ });
    expect(within(row).queryByRole("button", { name: "Reopen" })).not.toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Lock" })).toBeInTheDocument();
    fireEvent.click(within(row).getByRole("button", { name: "Approve" }));
    expect(calls.some((call) => call.key.endsWith("/approve"))).toBe(false);
    fireEvent.click(within(row).getByRole("button", { name: "Confirm approve" }));
    await screen.findByText("Reloaded");
    expect(screen.getByText("Someone else changed this period. It has been reloaded.")).toBeInTheDocument();
    expect(calls.find((call) => call.key.endsWith("/approve"))?.body).toEqual({ version: 2 });
  });

  it("exports a locked period as CSV or Excel through the bearer download, then lists the export records", async () => {
    downloadFile.mockResolvedValue({ blob: new Blob(), fileName: "finance-2026-08.csv", rowCount: 3 });
    const calls = stubFetch({
      "GET /v1/admin/me": me(["contracts:view", "time:lock-period"]),
      [PERIODS]: () => json([aLockedPeriod()]),
      "GET /v1/accounts/acct-1/billing-periods/bp-0/exports": () =>
        json([aBillingExport(), aBillingExport({ id: "bx-2", format: "csv", delivered_at: "2026-09-04T10:00:00Z" })]),
    });
    renderDesk(<BillingPeriodsTab accountId="acct-1" />);
    const row = await screen.findByRole("row", { name: /August 2026/ });
    fireEvent.click(within(row).getByRole("button", { name: "CSV" }));
    await screen.findByText("Exported 3 rows");
    expect(downloadFile).toHaveBeenCalledWith({
      url: "/v1/accounts/acct-1/billing-periods/bp-0/export?format=csv",
      fallbackName: "finance-2026-08.csv",
    });
    fireEvent.click(within(row).getByRole("button", { name: "Excel" }));
    await waitFor(() => expect(downloadFile).toHaveBeenCalledTimes(2));
    expect((downloadFile.mock.calls[1][0] as { url: string }).url).toBe(
      "/v1/accounts/acct-1/billing-periods/bp-0/export?format=xlsx",
    );
    // The period's checksum and the export records are read again after a file is produced.
    await waitFor(() => expect(calls.filter((call) => call.key === PERIODS).length).toBeGreaterThanOrEqual(2));
    fireEvent.click(within(row).getByRole("button", { name: "Exports" }));
    const list = await screen.findByRole("list", { name: "Finance files" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("XLSX");
    expect(items[0]).toHaveTextContent("3 rows");
    expect(items[0].querySelector("[data-checksum]")).toHaveTextContent("3f2a9c8e1b7d");
    expect(items[0]).toHaveTextContent("Not delivered");
    expect(items[1]).toHaveTextContent("Delivered 2026-09-04");
  });

  it("words period_not_locked from the download and offers no export on an open period", async () => {
    downloadFile.mockRejectedValue(new DownloadError(409, "period_not_locked"));
    stubFetch({
      "GET /v1/admin/me": me(["contracts:view", "time:lock-period"]),
      [PERIODS]: () => json([aBillingPeriod(), aLockedPeriod({ status: "exported" })]),
    });
    renderDesk(<BillingPeriodsTab accountId="acct-1" />);
    const open = await screen.findByRole("row", { name: /September 2026/ });
    expect(within(open).queryByRole("button", { name: "CSV" })).not.toBeInTheDocument();
    const exported = screen.getByRole("row", { name: /August 2026/ });
    fireEvent.click(within(exported).getByRole("button", { name: "Excel" }));
    await screen.findByText("Export not produced");
    expect(screen.getByText("The finance file is produced once the period is locked.")).toBeInTheDocument();
  });
});
