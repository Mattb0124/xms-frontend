import type { SignalTone } from "@/components/xms/signal-pill";
import { apiError, describeError, type ApiError } from "@/lib/admin/api-error";
import type { CreateEngagementBody, Engagement, EngagementStatus, PatchEngagementBody } from "@/redux/ticketsApi";

/**
 * The engagement vocabulary (Time, Contracts & Budget technical 2.1): the
 * commercial envelope a contract is filed under, its owner, its renewal date
 * and the notice period counted back from it.
 *
 * The server decides the status and fires the renewal alerts once per lead
 * time (90, 60 and 30 days, and 0 for the notice-period boundary); nothing
 * here recomputes either. The one figure the browser works out is how many
 * days are left to the renewal, and only to word a chip, the same way the
 * SLA meters count down against the server's due time.
 */
export const ENGAGEMENT_STATUS: Record<EngagementStatus, { label: string; tone: SignalTone }> = {
  active: { label: "Active", tone: "ready" },
  expiring: { label: "Expiring", tone: "needs-input" },
  ended: { label: "Ended", tone: "blocked" },
};

/** The statuses a person may set by hand on the edit form, in the order they read. */
export const ENGAGEMENT_STATUSES: { value: EngagementStatus; label: string }[] = (
  ["active", "expiring", "ended"] as EngagementStatus[]
).map((value) => ({ value, label: ENGAGEMENT_STATUS[value].label }));

export const MAX_NOTICE_DAYS = 365;

/** The alert key the server writes for the notice-period boundary. */
export const NOTICE_BOUNDARY_KEY = 0;

export function isoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** Whole days from `from` to `to`, both ISO dates; negative once `to` is past. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function today(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function renewalLabel(date: string | null): string {
  return date ?? "No renewal date";
}

export function noticeLabel(days: number | null): string {
  if (days === null) return "No notice period";
  return days === 1 ? "1 day of notice" : `${days} days of notice`;
}

/** The date by which a renewal decision must be made, or null without both parts. */
export function noticeDeadline(engagement: Pick<Engagement, "renewal_date" | "notice_period_days">): string | null {
  const { renewal_date: renewal, notice_period_days: notice } = engagement;
  if (renewal === null || notice === null || !isoDate(renewal)) return null;
  return new Date(Date.parse(`${renewal}T00:00:00Z`) - notice * 86_400_000).toISOString().slice(0, 10);
}

/** "90 days, 60 days and the notice period", or "None sent" before the first sweep. */
export function alertsLabel(fired: readonly number[]): string {
  if (fired.length === 0) return "None sent";
  const parts = [...fired]
    .sort((a, b) => b - a)
    .map((key) => (key === NOTICE_BOUNDARY_KEY ? "the notice period" : `${key} days`));
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** The owner by name where the directory is readable, else the short id, else "No owner". */
export function ownerLabel(id: string | null, names: Record<string, string>): string {
  if (id === null) return "No owner";
  return names[id] ?? id.slice(0, 8);
}

/** The engagement a contract is filed under, by name; "Not filed" when it is under none. */
export function engagementName(id: string | null, engagements: readonly Engagement[]): string {
  if (id === null) return "Not filed";
  return engagements.find((row) => row.id === id)?.name ?? id.slice(0, 8);
}

// The renewal chip ---------------------------------------------------------

/** The engagements the account record should announce: the ones the server marked expiring. */
export function expiringEngagements(engagements: readonly Engagement[] | undefined): Engagement[] {
  return (engagements ?? []).filter((row) => row.status === "expiring");
}

/** "Managed services renews in 21 days", from the server's date and today. */
export function renewalChipLabel(engagement: Engagement, on: string = today()): string {
  const date = engagement.renewal_date;
  if (date === null || !isoDate(date)) return `${engagement.name} renews on a date not yet set`;
  const days = daysBetween(on, date);
  if (days < 0) return `${engagement.name} renewed on ${date}`;
  if (days === 0) return `${engagement.name} renews today`;
  if (days === 1) return `${engagement.name} renews tomorrow`;
  return `${engagement.name} renews in ${days} days`;
}

/**
 * Amber while the renewal is ahead, red once the notice period has been
 * entered: past that boundary the decision is already late, which is the
 * whole point of recording a notice period.
 */
export function renewalChipTone(engagement: Engagement, on: string = today()): SignalTone {
  const deadline = noticeDeadline(engagement);
  if (deadline === null) return "needs-input";
  return daysBetween(on, deadline) <= 0 ? "overdue" : "needs-input";
}

/** What the chip says on hover: the date, and the notice rule when there is one. */
export function renewalChipTitle(engagement: Engagement): string {
  const deadline = noticeDeadline(engagement);
  const renewal = renewalLabel(engagement.renewal_date);
  return deadline === null
    ? `Renewal date ${renewal}`
    : `Renewal date ${renewal}; ${noticeLabel(engagement.notice_period_days)}, so decide by ${deadline}`;
}

// The form -----------------------------------------------------------------

/** The engagement as the form holds it; numbers and dates stay text until they are sent. */
export interface EngagementDraft {
  name: string;
  /** The internal user answerable for it; empty for none. */
  ownerUserId: string;
  /** A calendar date from the form, empty for no renewal. */
  renewalDate: string;
  /** Whole days, empty for no notice period. */
  noticePeriodDays: string;
  /** Meaningful on the edit form only; a create takes the status the date implies. */
  status: EngagementStatus;
}

export const emptyEngagementDraft: EngagementDraft = {
  name: "",
  ownerUserId: "",
  renewalDate: "",
  noticePeriodDays: "",
  status: "active",
};

export function draftFromEngagement(engagement: Engagement): EngagementDraft {
  return {
    name: engagement.name,
    ownerUserId: engagement.owner_user_id ?? "",
    renewalDate: engagement.renewal_date ?? "",
    noticePeriodDays: engagement.notice_period_days === null ? "" : String(engagement.notice_period_days),
    status: engagement.status,
  };
}

export const NOTICE_NEEDS_RENEWAL =
  "A notice period is counted back from the renewal date, so give a renewal date or clear the notice period.";

/** Why the draft cannot be sent yet, in the screen's words; null when it can. */
export function validateEngagement(draft: EngagementDraft): string | null {
  if (draft.name.trim() === "") return "Give the engagement a name.";
  if (draft.name.trim().length > 160) return "The name is at most 160 characters.";
  if (draft.renewalDate !== "" && !isoDate(draft.renewalDate)) return "The renewal date is a calendar date.";
  if (draft.noticePeriodDays !== "") {
    if (!/^\d+$/.test(draft.noticePeriodDays.trim())) return `The notice period is a whole number of days.`;
    const days = Number(draft.noticePeriodDays);
    if (days > MAX_NOTICE_DAYS) return `The notice period is at most ${MAX_NOTICE_DAYS} days.`;
    if (draft.renewalDate === "") return NOTICE_NEEDS_RENEWAL;
  }
  return null;
}

/** The POST body: every field the person filled in, and null for the ones they left empty. */
export function engagementBody(draft: EngagementDraft): CreateEngagementBody {
  return {
    name: draft.name.trim(),
    owner_user_id: draft.ownerUserId === "" ? null : draft.ownerUserId,
    renewal_date: draft.renewalDate === "" ? null : draft.renewalDate,
    notice_period_days: draft.noticePeriodDays === "" ? null : Number(draft.noticePeriodDays),
  };
}

/**
 * The PATCH body: the whole record with the version the screen holds. The
 * status travels only when a person changed it by hand, because the server
 * lets a moved renewal date decide the status otherwise, and a status echoed
 * back unchanged would silence that.
 */
export function patchEngagementBody(engagement: Engagement, draft: EngagementDraft): PatchEngagementBody {
  return {
    version: engagement.version,
    ...engagementBody(draft),
    ...(draft.status === engagement.status ? {} : { status: draft.status }),
  };
}

export function engagementError(error: unknown): ApiError {
  return apiError(error);
}

export function describeEngagementError(error: ApiError): string {
  switch (error.code) {
    case "renewal_date_required":
      return NOTICE_NEEDS_RENEWAL;
    case "stale_version":
      return "Someone else changed this engagement. It has been reloaded.";
    case "not_found":
      return "This engagement is not on this account any more.";
    case "forbidden":
      return "You need the contracts:manage permission.";
    default:
      return describeError(error);
  }
}
