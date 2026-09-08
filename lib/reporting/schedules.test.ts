import { describe, expect, it } from "vitest";
import {
  cadenceLabel,
  deliverySummary,
  describeScheduleError,
  draftFromSchedule,
  emptyRecipient,
  emptyScheduleDraft,
  nextRunLabel,
  patchBody,
  reasonLabel,
  recipientLabel,
  requestedByLabel,
  runNowBody,
  scheduleBody,
  scheduleError,
  validateRunNow,
  validateSchedule,
  WEEKLY_RUN_DAY_MESSAGE,
} from "@/lib/reporting/schedules";
import { aDelivery, aSchedule, INTERNAL_USER_ID } from "@/test-kit/reporting";

describe("schedule vocabulary", () => {
  it("words the cadence with the day and the time, the next run and the recipients", () => {
    expect(cadenceLabel(aSchedule())).toBe("Weekly on Monday at 06:00");
    expect(cadenceLabel(aSchedule({ cadence: "monthly", run_day: 15, run_time: "07:30:00" }))).toBe(
      "Monthly on day 15 at 07:30",
    );
    expect(cadenceLabel(aSchedule({ cadence: "quarterly", run_day: 1 }))).toBe("Quarterly on day 1 at 06:00");
    expect(nextRunLabel(aSchedule())).toBe("2026-09-14 06:00");
    expect(nextRunLabel(aSchedule({ enabled: false, next_run_at: null }))).toBe("Not scheduled");
    expect(recipientLabel({ kind: "contact", email: "pat@client.test", name: "Pat" })).toBe("Pat (pat@client.test)");
    expect(recipientLabel({ kind: "internal", id: INTERNAL_USER_ID })).toBe(INTERNAL_USER_ID);
    expect(recipientLabel({ kind: "portal_user", email: "x@client.test" })).toBe("x@client.test");
  });

  it("validates the draft with the weekly rule and the recipient requirements", () => {
    expect(validateSchedule(emptyScheduleDraft())).toBe("Give the schedule a name.");
    const weekly = { ...emptyScheduleDraft(), name: "Weekly" };
    expect(validateSchedule(weekly)).toBeNull();
    expect(validateSchedule({ ...weekly, run_day: "9" })).toBe(WEEKLY_RUN_DAY_MESSAGE);
    expect(validateSchedule({ ...weekly, cadence: "monthly", run_day: "9" })).toBeNull();
    expect(validateSchedule({ ...weekly, cadence: "monthly", run_day: "32" })).toBe(
      "The run day is a whole number from 1 to 31.",
    );
    expect(validateSchedule({ ...weekly, run_day: "" })).toBe("The run day is a whole number from 1 to 31.");
    expect(validateSchedule({ ...weekly, run_time: "6:00" })).toBe("The run time is HH:MM, 24-hour.");
    expect(validateSchedule({ ...weekly, distribution: [emptyRecipient("contact")] })).toBe(
      "Each contact needs an email address.",
    );
    expect(validateSchedule({ ...weekly, distribution: [emptyRecipient("internal")] })).toBe(
      "Choose the internal user.",
    );
    expect(validateSchedule({ ...weekly, distribution: [emptyRecipient("portal_user")] })).toBe(
      "Choose the portal user.",
    );
  });

  it("builds the create body and the patch with the version, dropping empty recipient fields", () => {
    const draft = {
      ...emptyScheduleDraft(),
      name: " Monthly pack ",
      cadence: "monthly" as const,
      run_day: "15",
      run_time: "07:30",
      period_kind: "previous_month" as const,
      distribution: [
        { kind: "contact" as const, id: "", email: " pat@client.test ", name: "Pat" },
        { kind: "internal" as const, id: INTERNAL_USER_ID, email: "", name: "" },
      ],
      enabled: false,
    };
    expect(scheduleBody(draft, "acct-1")).toEqual({
      account_id: "acct-1",
      name: "Monthly pack",
      cadence: "monthly",
      run_day: 15,
      run_time: "07:30",
      period_kind: "previous_month",
      distribution: [
        { kind: "contact", email: "pat@client.test", name: "Pat" },
        { kind: "internal", id: INTERNAL_USER_ID },
      ],
      enabled: false,
    });
    expect(patchBody(draft, 3)).toMatchObject({ version: 3, name: "Monthly pack", run_day: 15, enabled: false });
    // A schedule round-trips into a draft the form can show.
    expect(draftFromSchedule(aSchedule())).toEqual({
      name: "Weekly status report",
      cadence: "weekly",
      run_day: "1",
      run_time: "06:00",
      period_kind: "previous_week",
      distribution: [
        { kind: "internal", id: INTERNAL_USER_ID, email: "cara@example.test", name: "Cara Lee" },
        { kind: "contact", id: "", email: "pat@client.test", name: "Pat Client" },
      ],
      enabled: true,
    });
  });

  it("checks the run-now period and builds its body", () => {
    expect(validateRunNow("", "")).toBeNull();
    expect(validateRunNow("2026-08-24", "")).toBe("Give both the period start and its end, or neither.");
    expect(validateRunNow("2026-08-30", "2026-08-24")).toBe("The period end must not be before its start.");
    expect(validateRunNow("2026-08-24", "2026-08-30")).toBeNull();
    expect(runNowBody("", "")).toEqual({});
    expect(runNowBody("2026-08-24", "2026-08-30")).toEqual({ period_start: "2026-08-24", period_end: "2026-08-30" });
  });

  it("words the delivery outcomes and who requested a run", () => {
    expect(
      deliverySummary([
        aDelivery(),
        aDelivery({ kind: "contact", to: "pat@client.test", outcome: "emailed" }),
        aDelivery({ kind: "portal_user", to: "", outcome: "skipped", reason: "no_email" }),
      ]),
    ).toBe("1 notified, 1 emailed, 1 skipped");
    expect(deliverySummary(null)).toBe("Not delivered yet");
    expect(deliverySummary([])).toBe("No recipients");
    expect(reasonLabel("no_sender_identity")).toBe("The account has no sender identity");
    expect(reasonLabel("send_failed")).toBe("The email could not be sent");
    expect(reasonLabel("something_else")).toBe("something else");
    expect(reasonLabel(undefined)).toBeNull();
    expect(requestedByLabel("system")).toBe("Scheduled");
    expect(requestedByLabel(INTERNAL_USER_ID)).toBe("On demand");
  });

  it("words the refusals", () => {
    expect(describeScheduleError(scheduleError({ status: 400, data: { code: "run_day_weekly", max: 7 } }))).toBe(
      WEEKLY_RUN_DAY_MESSAGE,
    );
    expect(scheduleError({ status: 400, data: { code: "run_day_weekly", max: 7 } }).max).toBe(7);
    expect(describeScheduleError(scheduleError({ status: 409, data: { code: "stale_version" } }))).toBe(
      "Someone else changed this schedule. It has been reloaded.",
    );
    expect(describeScheduleError(scheduleError({ status: 400, data: { code: "invalid_range" } }))).toBe(
      "The period end must not be before its start.",
    );
    expect(describeScheduleError(scheduleError({ status: 404, data: { code: "not_found" } }))).toMatch(
      /no longer exists/,
    );
  });
});
