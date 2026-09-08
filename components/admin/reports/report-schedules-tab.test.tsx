import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReportSchedulesTab } from "@/components/admin/reports/report-schedules-tab";
import { reviewRequiredNote, WEEKLY_RUN_DAY_MESSAGE } from "@/lib/reporting/schedules";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";
import { aDelivery, aRun, aSchedule, INTERNAL_USER_ID, REVIEW_RUN_ID, SCHEDULE_ID } from "@/test-kit/reporting";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/accounts/acct-1" }));

const SCHEDULES = "GET /v1/reporting/schedules";
const RUNS = "GET /v1/reporting/runs";
const CREATE = "POST /v1/reporting/schedules";
const PATCH = `PATCH /v1/reporting/schedules/${SCHEDULE_ID}`;
const RUN_NOW = `POST /v1/reporting/schedules/${SCHEDULE_ID}/run-now`;

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: ["acct-1"], permissions } });

const directories = {
  "GET /v1/admin/users": () =>
    json([
      { id: INTERNAL_USER_ID, email: "cara@example.test", first_name: "Cara", last_name: "Lee", status: "active" },
      {
        id: "99999999-9999-4999-8999-999999999999",
        email: "old@example.test",
        first_name: "Old",
        last_name: "Hand",
        status: "deactivated",
      },
    ]),
  "GET /v1/admin/accounts/acct-1/portal-users": () =>
    json([
      {
        id: "88888888-8888-4888-8888-888888888888",
        email: "pat@client.test",
        first_name: "Pat",
        last_name: "Client",
        status: "active",
      },
    ]),
};

describe("ReportSchedulesTab", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fails closed without reports:manage and never reads the schedules", async () => {
    const calls = stubFetch({ "GET /v1/admin/me": me(["admin:accounts", "tickets:view"]) });
    renderDesk(<ReportSchedulesTab accountId="acct-1" />);
    await screen.findByText(/Needs the reports:manage permission/);
    expect(calls.some((call) => call.key === SCHEDULES || call.key === RUNS)).toBe(false);
  });

  it("lists the schedules with cadence, day, time, next run and enabled, and the runs with their delivery and pack", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["reports:manage"]),
      [SCHEDULES]: () =>
        json([
          aSchedule(),
          aSchedule({
            id: "s-2",
            name: "Quarter review",
            cadence: "quarterly",
            run_day: 3,
            run_time: "09:15:00",
            period_kind: "previous_quarter",
            enabled: false,
            next_run_at: null,
            distribution: [],
          }),
        ]),
      [RUNS]: () =>
        json([
          aRun(),
          aRun({
            id: "run-9",
            schedule_id: null,
            status: "failed",
            error: "template missing",
            pack_id: null,
            delivery: null,
            requested_by: "u1",
            period_start: "2026-08-24",
            period_end: "2026-08-30",
          }),
        ]),
    });
    renderDesk(<ReportSchedulesTab accountId="acct-1" />);
    const table = await screen.findByRole("table", { name: "Report schedules" });
    expect(calls.find((call) => call.key === SCHEDULES)?.search).toBe("?account=acct-1");
    expect(calls.find((call) => call.key === RUNS)?.search).toBe("?account=acct-1");
    const weekly = within(table).getByRole("row", { name: /Weekly status report/ });
    expect(weekly).toHaveTextContent("Weekly on Monday at 06:00");
    expect(weekly).toHaveTextContent("Previous week");
    expect(weekly).toHaveTextContent("2026-09-14 06:00");
    expect(weekly).toHaveTextContent("Cara Lee (cara@example.test), Pat Client (pat@client.test)");
    expect(within(weekly).getByText("Enabled")).toHaveAttribute("data-state", "ready");
    const quarterly = within(table).getByRole("row", { name: /Quarter review/ });
    expect(quarterly).toHaveTextContent("Quarterly on day 3 at 09:15");
    expect(quarterly).toHaveTextContent("Not scheduled");
    expect(quarterly).toHaveTextContent("Nobody");
    expect(within(quarterly).getByText("Disabled")).toHaveAttribute("data-state", "blocked");

    const runs = screen.getByRole("table", { name: "Report runs" });
    const sent = within(runs).getByRole("row", { name: /2026-08-31 to 2026-09-06/ });
    expect(sent).toHaveTextContent("Weekly status report");
    expect(sent).toHaveTextContent("Scheduled");
    expect(within(sent).getByText("Sent")).toBeInTheDocument();
    expect(sent.querySelector("[data-delivery-summary]")).toHaveTextContent("1 notified, 1 skipped");
    expect(within(sent).getByRole("link", { name: "Open pack" })).toHaveAttribute("href", "/reports/packs/pack-10");
    fireEvent.click(within(sent).getByRole("button", { name: "Details" }));
    const outcomes = within(within(sent).getByRole("list", { name: "Delivery outcomes" })).getAllByRole("listitem");
    expect(outcomes[0]).toHaveTextContent("Internal user");
    expect(outcomes[0]).toHaveTextContent(INTERNAL_USER_ID);
    expect(within(outcomes[0]).getByText("Notified")).toHaveAttribute("data-state", "complete");
    expect(outcomes[1]).toHaveTextContent("pat@client.test");
    expect(within(outcomes[1]).getByText("Skipped")).toHaveAttribute("data-state", "overdue");
    expect(outcomes[1]).toHaveTextContent("The account has no sender identity");
    const failed = within(runs).getByRole("row", { name: /2026-08-24 to 2026-08-30/ });
    expect(failed).toHaveTextContent("Generated by hand");
    expect(failed).toHaveTextContent("On demand");
    expect(failed).toHaveTextContent("Failed");
    expect(failed).toHaveTextContent("template missing");
    expect(failed).toHaveTextContent("Not delivered yet");
    expect(failed).toHaveTextContent("No pack");
    expect(within(failed).queryByRole("link", { name: "Open pack" })).not.toBeInTheDocument();
  });

  it("marks the schedules that hold their runs and the runs that are waiting, linking each held run to the review", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["reports:manage"]),
      [SCHEDULES]: () =>
        json([
          aSchedule({ review_required: true, review_grace_hours: 48 }),
          aSchedule({ id: "s-2", name: "Quarter review", review_required: false }),
        ]),
      [RUNS]: () =>
        json([
          aRun({ id: REVIEW_RUN_ID, status: "ready_for_review", delivery: null, pack_id: "pack-held" }),
          aRun({
            id: "run-late",
            status: "awaiting_review",
            delivery: null,
            pack_id: "pack-late",
            period_start: "2026-08-24",
            period_end: "2026-08-30",
          }),
          aRun({ id: "run-old", status: "sent", period_start: "2026-08-17", period_end: "2026-08-23" }),
        ]),
      ...directories,
    });
    renderDesk(<ReportSchedulesTab accountId="acct-1" />);

    const table = await screen.findByRole("table", { name: "Report schedules" });
    const holding = within(table).getByRole("row", { name: /Weekly status report/ });
    const held = within(holding).getByText("Held for review");
    expect(held).toHaveAttribute("data-state", "needs-input");
    expect(held).toHaveAttribute("title", expect.stringContaining("48 hours"));
    expect(within(table).getByRole("row", { name: /Quarter review/ })).toHaveTextContent("Sends on run");

    const runs = screen.getByRole("table", { name: "Report runs" });
    const waiting = within(runs).getByRole("row", { name: /2026-08-31 to 2026-09-06/ });
    // The run's own status and its review state, the second on the signal trios.
    expect(within(waiting).getAllByText("Ready for review").length).toBe(2);
    expect(within(waiting).getByText("Ready for review", { selector: ".aix-state-pill" })).toHaveAttribute(
      "data-state",
      "needs-input",
    );
    expect(within(waiting).getByRole("link", { name: "Review" })).toHaveAttribute(
      "href",
      `/reports/runs/${REVIEW_RUN_ID}`,
    );
    // A held run has delivered nothing, and the row says so rather than
    // counting recipients it never wrote to.
    expect(waiting.querySelector("[data-delivery-summary]")).toHaveTextContent("Not delivered yet");

    const overdue = within(runs).getByRole("row", { name: /2026-08-24 to 2026-08-30/ });
    expect(within(overdue).getByText("Awaiting review", { selector: ".aix-state-pill" })).toHaveAttribute(
      "data-state",
      "overdue",
    );
    expect(within(overdue).getByRole("link", { name: "Review" })).toHaveAttribute("href", "/reports/runs/run-late");

    // A run review never touched carries no review pill and no review link.
    const decided = within(runs).getByRole("row", { name: /2026-08-17 to 2026-08-23/ });
    expect(within(decided).queryByRole("link", { name: "Review" })).not.toBeInTheDocument();
    expect(decided.querySelector(".aix-state-pill")).toBeNull();
  });

  it("carries the review switch with a sentence, and sends the flag with the schedule", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["reports:manage"]),
      [SCHEDULES]: () => json([]),
      [RUNS]: () => json([]),
      [CREATE]: () => json(aSchedule({ id: "new", review_required: true }), 201),
      ...directories,
    });
    renderDesk(<ReportSchedulesTab accountId="acct-1" />);
    await screen.findByText(/No schedule yet/);
    fireEvent.click(screen.getByRole("button", { name: "New schedule" }));
    const form = await screen.findByRole("form", { name: "Schedule" });

    const toggle = within(form).getByLabelText("Review before sending");
    expect(toggle).not.toBeChecked();
    expect(form).toHaveTextContent(reviewRequiredNote());
    fireEvent.change(within(form).getByLabelText("Name"), { target: { value: "Weekly" } });
    fireEvent.click(toggle);
    fireEvent.click(within(form).getByRole("button", { name: "Save" }));

    await screen.findByText("Schedule created");
    expect(calls.find((call) => call.key === CREATE)?.body).toMatchObject({ review_required: true });
  });

  it("says a run of a review schedule was held, not sent, and offers the review", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["reports:manage"]),
      [SCHEDULES]: () => json([aSchedule({ review_required: true })]),
      [RUNS]: () => json([]),
      [RUN_NOW]: () =>
        json(
          {
            run_id: REVIEW_RUN_ID,
            pack_id: "pack-held",
            period: { start: "2026-08-31", end: "2026-09-06" },
            delivery: [],
            status: "ready_for_review",
            review_due_at: "2026-09-08T06:00:00Z",
          },
          201,
        ),
      ...directories,
    });
    renderDesk(<ReportSchedulesTab accountId="acct-1" />);
    await screen.findByRole("table", { name: "Report schedules" });
    fireEvent.click(screen.getByRole("button", { name: "Run Weekly status report now" }));
    fireEvent.click(await screen.findByRole("button", { name: "Run" }));

    await screen.findByText("Report pack held for review");
    const result = screen.getByTestId("run-now-result");
    expect(within(result).getByText("Approve or cancel it before 2026-09-08 06:00.")).toBeTruthy();
    expect(within(result).getByRole("link", { name: "Review it" })).toHaveAttribute(
      "href",
      `/reports/runs/${REVIEW_RUN_ID}`,
    );
    // Nothing was delivered, so no outcome list is drawn at all.
    expect(within(result).queryByRole("list", { name: "Delivery outcomes" })).not.toBeInTheDocument();
  });

  it("creates a monthly schedule with a contact recipient, sending the body the API takes", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["reports:manage"]),
      [SCHEDULES]: () => json([]),
      [RUNS]: () => json([]),
      [CREATE]: () => json(aSchedule({ id: "new", name: "Monthly pack", cadence: "monthly" }), 201),
      ...directories,
    });
    renderDesk(<ReportSchedulesTab accountId="acct-1" />);
    await screen.findByText(/No schedule yet/);
    fireEvent.click(screen.getByRole("button", { name: "New schedule" }));
    const form = await screen.findByRole("form", { name: "Schedule" });
    fireEvent.change(within(form).getByLabelText("Name"), { target: { value: "Monthly pack" } });
    fireEvent.change(within(form).getByLabelText("Cadence"), { target: { value: "monthly" } });
    // The period follows the cadence until chosen by hand.
    expect(within(form).getByLabelText("Period")).toHaveValue("previous_month");
    fireEvent.change(within(form).getByLabelText("Run day"), { target: { value: "15" } });
    fireEvent.change(within(form).getByLabelText("Run time"), { target: { value: "07:30" } });
    fireEvent.click(within(form).getByRole("button", { name: "Add recipient" }));
    fireEvent.change(within(form).getByLabelText("Recipient 1 email"), { target: { value: "pat@client.test" } });
    fireEvent.change(within(form).getByLabelText("Recipient 1 name"), { target: { value: "Pat" } });
    fireEvent.click(within(form).getByRole("button", { name: "Save" }));
    await screen.findByText("Schedule created");
    expect(calls.find((call) => call.key === CREATE)?.body).toEqual({
      account_id: "acct-1",
      name: "Monthly pack",
      cadence: "monthly",
      run_day: 15,
      run_time: "07:30",
      period_kind: "previous_month",
      distribution: [{ kind: "contact", email: "pat@client.test", name: "Pat" }],
      review_required: false,
      enabled: true,
    });
    expect(screen.queryByRole("form", { name: "Schedule" })).not.toBeInTheDocument();
  });

  it("refuses a weekly run day beyond seven before asking the API", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["reports:manage"]),
      [SCHEDULES]: () => json([]),
      [RUNS]: () => json([]),
      ...directories,
    });
    renderDesk(<ReportSchedulesTab accountId="acct-1" />);
    await screen.findByText(/No schedule yet/);
    fireEvent.click(screen.getByRole("button", { name: "New schedule" }));
    const form = await screen.findByRole("form", { name: "Schedule" });
    fireEvent.change(within(form).getByLabelText("Name"), { target: { value: "Weekly" } });
    fireEvent.change(within(form).getByLabelText("Run day"), { target: { value: "9" } });
    fireEvent.click(within(form).getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(WEEKLY_RUN_DAY_MESSAGE);
    expect(calls.some((call) => call.key === CREATE)).toBe(false);
  });

  it("edits a schedule with the version it was read at, wording stale_version and reloading the list", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["reports:manage"]),
      [SCHEDULES]: () => json([aSchedule()]),
      [RUNS]: () => json([]),
      [PATCH]: () => json({ code: "stale_version" }, 409),
      ...directories,
    });
    renderDesk(<ReportSchedulesTab accountId="acct-1" />);
    await screen.findByRole("table", { name: "Report schedules" });
    fireEvent.click(screen.getByRole("button", { name: "Edit Weekly status report" }));
    const form = await screen.findByRole("form", { name: "Schedule" });
    expect(within(form).getByLabelText("Name")).toHaveValue("Weekly status report");
    expect(within(form).getByLabelText("Recipient 1 kind")).toHaveValue("internal");
    await waitFor(() => expect(within(form).getByLabelText("Recipient 1 user")).toHaveValue(INTERNAL_USER_ID));
    expect(within(form).getByLabelText("Recipient 2 email")).toHaveValue("pat@client.test");
    fireEvent.click(within(form).getByLabelText("Enabled"));
    fireEvent.click(within(form).getByRole("button", { name: "Save" }));
    await screen.findByText("Reloaded");
    expect(screen.getByText("Someone else changed this schedule. It has been reloaded.")).toBeInTheDocument();
    expect(calls.find((call) => call.key === PATCH)?.body).toEqual({
      version: 1,
      name: "Weekly status report",
      cadence: "weekly",
      run_day: 1,
      run_time: "06:00",
      period_kind: "previous_week",
      distribution: [
        { kind: "internal", id: INTERNAL_USER_ID, email: "cara@example.test", name: "Cara Lee" },
        { kind: "contact", email: "pat@client.test", name: "Pat Client" },
      ],
      review_required: false,
      enabled: false,
    });
    await waitFor(() => expect(calls.filter((call) => call.key === SCHEDULES).length).toBeGreaterThanOrEqual(2));
    expect(screen.queryByRole("form", { name: "Schedule" })).not.toBeInTheDocument();
  });

  it("runs a schedule now for a chosen period and shows the outcome per recipient, wording invalid_range", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["reports:manage"]),
      [SCHEDULES]: () => json([aSchedule()]),
      [RUNS]: () => json([]),
      [RUN_NOW]: (body) => {
        const parsed = JSON.parse(body ?? "{}") as { period_start?: string };
        if (parsed.period_start === "2026-01-01") return json({ code: "invalid_range" }, 400);
        return json(
          {
            run_id: "run-11",
            pack_id: "pack-11",
            period: { start: "2026-08-24", end: "2026-08-30" },
            delivery: [aDelivery(), aDelivery({ kind: "portal_user", to: "", outcome: "skipped", reason: "no_email" })],
            status: "sent",
          },
          201,
        );
      },
    });
    renderDesk(<ReportSchedulesTab accountId="acct-1" />);
    await screen.findByRole("table", { name: "Report schedules" });
    fireEvent.click(screen.getByRole("button", { name: "Run Weekly status report now" }));
    const form = await screen.findByRole("form", { name: "Run now" });
    // The browser check first: the end before the start never reaches the API.
    fireEvent.change(within(form).getByLabelText("Period start"), { target: { value: "2026-08-30" } });
    fireEvent.change(within(form).getByLabelText("Period end"), { target: { value: "2026-08-24" } });
    fireEvent.click(within(form).getByRole("button", { name: "Run" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The period end must not be before its start.");
    expect(calls.some((call) => call.key === RUN_NOW)).toBe(false);
    // The server's own refusal is worded the same way.
    fireEvent.change(within(form).getByLabelText("Period start"), { target: { value: "2026-01-01" } });
    fireEvent.change(within(form).getByLabelText("Period end"), { target: { value: "2026-01-31" } });
    fireEvent.click(within(form).getByRole("button", { name: "Run" }));
    await waitFor(() => expect(calls.filter((call) => call.key === RUN_NOW).length).toBe(1));
    expect(await screen.findByRole("alert")).toHaveTextContent("The period end must not be before its start.");
    fireEvent.change(within(form).getByLabelText("Period start"), { target: { value: "2026-08-24" } });
    fireEvent.change(within(form).getByLabelText("Period end"), { target: { value: "2026-08-30" } });
    fireEvent.click(within(form).getByRole("button", { name: "Run" }));
    const result = await screen.findByTestId("run-now-result");
    expect(calls.filter((call) => call.key === RUN_NOW)[1].body).toEqual({
      period_start: "2026-08-24",
      period_end: "2026-08-30",
    });
    expect(result).toHaveTextContent("2026-08-24 to 2026-08-30");
    expect(within(result).getByRole("link", { name: "Open pack" })).toHaveAttribute("href", "/reports/packs/pack-11");
    const outcomes = within(within(result).getByRole("list", { name: "Delivery outcomes" })).getAllByRole("listitem");
    expect(outcomes).toHaveLength(2);
    expect(within(outcomes[0]).getByText("Notified")).toHaveAttribute("data-state", "complete");
    expect(outcomes[1]).toHaveTextContent("Portal user");
    expect(outcomes[1]).toHaveTextContent("(no address)");
    expect(within(outcomes[1]).getByText("Skipped")).toHaveAttribute("data-state", "overdue");
    expect(outcomes[1]).toHaveTextContent("No email address");
    expect(screen.getByText("Report pack sent")).toBeInTheDocument();
    // The schedules and the runs are read again after a run.
    await waitFor(() => expect(calls.filter((call) => call.key === RUNS).length).toBeGreaterThanOrEqual(2));
  });
});
