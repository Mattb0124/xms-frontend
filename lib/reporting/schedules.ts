import type { SignalTone } from "@/components/xms/signal-pill";
import { apiError, describeError, type ApiError } from "@/lib/admin/api-error";
import type {
  Cadence,
  CreateScheduleBody,
  DeliveryOutcome,
  PatchScheduleBody,
  PeriodKind,
  Recipient,
  RecipientKind,
  ReportSchedule,
  RunNowBody,
} from "@/redux/reportingApi";

/**
 * The report schedule vocabulary (Dashboards functional 5.7, DR-05): the
 * cadences with their run-day rule (weekly 1 to 7, Monday first; monthly
 * and quarterly 1 to 31), the period each covers, the recipient kinds,
 * the form draft and the bodies it becomes, the delivery outcomes in
 * words, and the refusals.
 */
export const CADENCES: { value: Cadence; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
];

export const PERIOD_KINDS: { value: PeriodKind; label: string }[] = [
  { value: "previous_week", label: "Previous week" },
  { value: "previous_month", label: "Previous month" },
  { value: "previous_quarter", label: "Previous quarter" },
];

export const RECIPIENT_KINDS: { value: RecipientKind; label: string }[] = [
  { value: "internal", label: "Internal user" },
  { value: "portal_user", label: "Portal user" },
  { value: "contact", label: "Contact" },
];

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const WEEKLY_RUN_DAY_MESSAGE = "For a weekly schedule the run day is 1 (Monday) to 7 (Sunday).";

export function maxRunDay(cadence: Cadence): number {
  return cadence === "weekly" ? 7 : 31;
}

/** The server's default when none is given: the period the cadence naturally covers. */
export function defaultPeriodKind(cadence: Cadence): PeriodKind {
  return cadence === "weekly" ? "previous_week" : cadence === "monthly" ? "previous_month" : "previous_quarter";
}

export function periodKindLabel(kind: PeriodKind): string {
  return PERIOD_KINDS.find((row) => row.value === kind)?.label ?? kind;
}

export function recipientKindLabel(kind: RecipientKind): string {
  return RECIPIENT_KINDS.find((row) => row.value === kind)?.label ?? kind;
}

/** "Monday" for a weekly schedule, "day 15" otherwise. */
export function runDayLabel(cadence: Cadence, day: number): string {
  return cadence === "weekly" ? (WEEKDAYS[day - 1] ?? `day ${day}`) : `day ${day}`;
}

/** The server stores "HH:MM:SS"; the form and the list show "HH:MM". */
export function formatRunTime(runTime: string): string {
  return runTime.slice(0, 5);
}

/** "Weekly on Monday at 06:00", "Monthly on day 1 at 07:30". */
export function cadenceLabel(schedule: Pick<ReportSchedule, "cadence" | "run_day" | "run_time">): string {
  const cadence = CADENCES.find((row) => row.value === schedule.cadence)?.label ?? schedule.cadence;
  return `${cadence} on ${runDayLabel(schedule.cadence, schedule.run_day)} at ${formatRunTime(schedule.run_time)}`;
}

/** The recipient by name and address, else the address, else the id. */
export function recipientLabel(recipient: Recipient): string {
  if (recipient.name && recipient.email) return `${recipient.name} (${recipient.email})`;
  return recipient.name ?? recipient.email ?? recipient.id ?? "Unknown recipient";
}

// The form draft --------------------------------------------------------------------

export interface RecipientDraft {
  kind: RecipientKind;
  id: string;
  email: string;
  name: string;
}

export interface ScheduleDraft {
  name: string;
  cadence: Cadence;
  /** Kept as typed so a cleared field is not silently a number. */
  run_day: string;
  run_time: string;
  period_kind: PeriodKind;
  distribution: RecipientDraft[];
  enabled: boolean;
}

export function emptyRecipient(kind: RecipientKind = "contact"): RecipientDraft {
  return { kind, id: "", email: "", name: "" };
}

export function emptyScheduleDraft(): ScheduleDraft {
  return {
    name: "",
    cadence: "weekly",
    run_day: "1",
    run_time: "06:00",
    period_kind: "previous_week",
    distribution: [],
    enabled: true,
  };
}

export function draftFromSchedule(schedule: ReportSchedule): ScheduleDraft {
  return {
    name: schedule.name,
    cadence: schedule.cadence,
    run_day: String(schedule.run_day),
    run_time: formatRunTime(schedule.run_time),
    period_kind: schedule.period_kind,
    distribution: schedule.distribution.map((recipient) => ({
      kind: recipient.kind,
      id: recipient.id ?? "",
      email: recipient.email ?? "",
      name: recipient.name ?? "",
    })),
    enabled: schedule.enabled,
  };
}

const RUN_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The first problem in words, or null; the weekly rule mirrors the server's run_day_weekly. */
export function validateSchedule(draft: ScheduleDraft): string | null {
  if (!draft.name.trim()) return "Give the schedule a name.";
  const day = Number(draft.run_day);
  if (!Number.isInteger(day) || day < 1 || day > 31) return "The run day is a whole number from 1 to 31.";
  if (draft.cadence === "weekly" && day > 7) return WEEKLY_RUN_DAY_MESSAGE;
  if (!RUN_TIME.test(draft.run_time)) return "The run time is HH:MM, 24-hour.";
  for (const recipient of draft.distribution) {
    if (recipient.kind === "contact" && !EMAIL.test(recipient.email.trim()))
      return "Each contact needs an email address.";
    if (recipient.kind !== "contact" && !recipient.id) return `Choose the ${recipientKindLabel(recipient.kind).toLowerCase()}.`;
  }
  return null;
}

/** Recipients as the API takes them: only the fields that are set. */
export function toRecipients(drafts: RecipientDraft[]): Recipient[] {
  return drafts.map((draft) => {
    const recipient: Recipient = { kind: draft.kind };
    if (draft.id) recipient.id = draft.id;
    if (draft.email.trim()) recipient.email = draft.email.trim();
    if (draft.name.trim()) recipient.name = draft.name.trim();
    return recipient;
  });
}

export function scheduleBody(draft: ScheduleDraft, accountId: string): CreateScheduleBody {
  return {
    account_id: accountId,
    name: draft.name.trim(),
    cadence: draft.cadence,
    run_day: Number(draft.run_day),
    run_time: draft.run_time,
    period_kind: draft.period_kind,
    distribution: toRecipients(draft.distribution),
    enabled: draft.enabled,
  };
}

/** The whole set with the version the row was read at (the concurrent-edit rule). */
export function patchBody(draft: ScheduleDraft, version: number): PatchScheduleBody {
  return {
    version,
    name: draft.name.trim(),
    cadence: draft.cadence,
    run_day: Number(draft.run_day),
    run_time: draft.run_time,
    period_kind: draft.period_kind,
    distribution: toRecipients(draft.distribution),
    enabled: draft.enabled,
  };
}

// Run now ----------------------------------------------------------------------------

export const INVALID_RANGE_MESSAGE = "The period end must not be before its start.";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Both dates or neither; the end never before the start (the server's invalid_range). */
export function validateRunNow(start: string, end: string): string | null {
  if (!start && !end) return null;
  if (!DAY.test(start) || !DAY.test(end)) return "Give both the period start and its end, or neither.";
  if (end < start) return INVALID_RANGE_MESSAGE;
  return null;
}

export function runNowBody(start: string, end: string): RunNowBody {
  return start && end ? { period_start: start, period_end: end } : {};
}

// Delivery ---------------------------------------------------------------------------

export const OUTCOME_LABELS: Record<DeliveryOutcome["outcome"], string> = {
  notified: "Notified",
  emailed: "Emailed",
  skipped: "Skipped",
};

export function outcomeTone(outcome: DeliveryOutcome["outcome"]): SignalTone {
  return outcome === "skipped" ? "overdue" : "complete";
}

const REASON_LABELS: Record<string, string> = {
  no_email: "No email address",
  no_sender_identity: "The account has no sender identity",
  no_user_id: "No user id",
  send_failed: "The email could not be sent",
};

export function reasonLabel(reason: string | undefined): string | null {
  if (!reason) return null;
  return REASON_LABELS[reason] ?? reason.replace(/_/g, " ");
}

/** "1 notified, 1 emailed, 1 skipped"; "Not delivered yet" before the run finished. */
export function deliverySummary(delivery: DeliveryOutcome[] | null | undefined): string {
  if (!delivery) return "Not delivered yet";
  if (delivery.length === 0) return "No recipients";
  const counts = (["notified", "emailed", "skipped"] as const)
    .map((outcome) => ({ outcome, n: delivery.filter((row) => row.outcome === outcome).length }))
    .filter((row) => row.n > 0);
  return counts.map((row) => `${row.n} ${row.outcome}`).join(", ");
}

/** The worker requests as "system"; anyone else ran it on demand. */
export function requestedByLabel(requestedBy: string): string {
  return requestedBy === "system" ? "Scheduled" : "On demand";
}

export function nextRunLabel(schedule: Pick<ReportSchedule, "enabled" | "next_run_at">): string {
  if (!schedule.enabled || !schedule.next_run_at) return "Not scheduled";
  return schedule.next_run_at.slice(0, 16).replace("T", " ");
}

// Errors -----------------------------------------------------------------------------

export interface ScheduleError extends ApiError {
  /** run_day_weekly carries the largest day the cadence allows. */
  max?: number;
}

export function scheduleError(error: unknown): ScheduleError {
  const parsed = apiError(error) as ScheduleError;
  const data = (error as { data?: Record<string, unknown> })?.data;
  if (data && typeof data === "object" && typeof data.max === "number") parsed.max = data.max;
  return parsed;
}

export function describeScheduleError(error: ScheduleError): string {
  switch (error.code) {
    case "run_day_weekly":
      return WEEKLY_RUN_DAY_MESSAGE;
    case "stale_version":
      return "Someone else changed this schedule. It has been reloaded.";
    case "invalid_range":
      return INVALID_RANGE_MESSAGE;
    case "not_found":
      return "This schedule no longer exists, or the account is not granted to you.";
    default:
      return describeError(error);
  }
}
