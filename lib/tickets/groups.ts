/**
 * Groups (TM-08, TM-10): the two things the desk calls a group and keeps
 * apart.
 *
 * An **assignment group** is a team that work is queued to. It is the
 * ticket's `group_id`, the Queue's group chip, the target of the account's
 * routing defaults, and what a saved view shared with a group names.
 *
 * A **ticket group** is a project or a change window: a named container with
 * a schedule that a ticket tree belongs to (`ticket_group_id`). It is what
 * the change calendar draws.
 *
 * The words here are the ones the screens use, and every refusal the API
 * answers with is turned into a sentence rather than a code.
 */
import { apiError } from "@/lib/admin/api-error";
import type {
  FreezeWindow,
  RoutableType,
  RoutingRuleInput,
  TicketGroupKind,
  TicketGroupStatus,
} from "@/redux/ticketsApi";

/** The problems an `invalid_schedule` refusal carries; the API sends them under `problems`. */
export function refusalProblems(error: unknown): string[] {
  const data = (error as { data?: Record<string, unknown> })?.data;
  if (data && typeof data === "object" && Array.isArray(data.problems)) return data.problems.map(String);
  return [];
}

/** Plain words for a refused group change on a ticket. */
export function describeGroupError(error: unknown): string {
  const parsed = apiError(error);
  switch (parsed.code) {
    case "group_retired":
      return "That group has been retired, so work cannot be queued to it.";
    case "stale_version":
      return "Someone else changed this ticket. It has been reloaded; try again.";
    case "ticket_closed":
      return "Closed and cancelled tickets cannot be reassigned.";
    default:
      return `The group was not changed (${parsed.code}).`;
  }
}

export const TICKET_GROUP_KIND_LABEL: Record<TicketGroupKind, string> = {
  project: "Project",
  change_window: "Change window",
};

export const TICKET_GROUP_STATUS_LABEL: Record<TicketGroupStatus, string> = {
  planned: "Planned",
  active: "Active",
  closed: "Closed",
  cancelled: "Cancelled",
};

export function ticketGroupKindLabel(kind: string): string {
  return TICKET_GROUP_KIND_LABEL[kind as TicketGroupKind] ?? kind.replace(/_/g, " ");
}

export function ticketGroupStatusLabel(status: string): string {
  return TICKET_GROUP_STATUS_LABEL[status as TicketGroupStatus] ?? status.replace(/_/g, " ");
}

/**
 * One freeze as the form holds it (TM-18): a span during which nothing may
 * be scheduled, with the reason it is there. The API stores freezes on the
 * window itself, so the whole set travels with every save.
 */
export interface FreezeDraft {
  /** Local datetime strings as the form holds them ("2026-10-01T18:00"), or "". */
  startsAt: string;
  endsAt: string;
  reason: string;
}

export interface TicketGroupDraft {
  accountId: string;
  kind: TicketGroupKind;
  name: string;
  description: string;
  ownerUserId: string;
  status: TicketGroupStatus;
  /** Local datetime strings as the form holds them ("2026-10-01T18:00"), or "". */
  startsAt: string;
  endsAt: string;
  freezes: FreezeDraft[];
  /**
   * Why a change window's schedule moved. The API records it on the audit
   * row and refuses a schedule change on a change window without it, because
   * the same principal who can widen a window is the one the deploy gate
   * would otherwise have refused.
   */
  changeWindowReason: string;
}

export const GROUP_NAME_REQUIRED = "A group needs a name.";
export const GROUP_NAME_TOO_LONG = "A name is at most 160 characters.";
export const GROUP_ACCOUNT_REQUIRED = "A group belongs to one account. Choose one.";
export const CHANGE_WINDOW_ENDS_REQUIRED = "A change window needs a start and an end.";
export const ENDS_AFTER_STARTS = "The end has to be after the start.";
export const FREEZE_ENDS_REQUIRED = "Every freeze needs a start and an end.";
export const FREEZE_ENDS_AFTER_STARTS = "A freeze has to end after it starts.";
export const CHANGE_WINDOW_REASON_REQUIRED = "Moving a change window is recorded, so it needs a reason.";

/**
 * Has the schedule moved? The API treats any of `starts_at`, `ends_at` or
 * `freeze_windows` arriving on a change window as a schedule change, and
 * asks for the override permission and a reason. Comparing against the row
 * being edited keeps a rename from reading as one.
 */
export function scheduleMoved(
  before: { starts_at: string | null; ends_at: string | null; freeze_windows?: FreezeWindow[] | null },
  after: { startsAt: string | null; endsAt: string | null; freezes: FreezeWindow[] },
): boolean {
  if (!sameInstant(before.starts_at, after.startsAt)) return true;
  if (!sameInstant(before.ends_at, after.endsAt)) return true;
  return !sameFreezes(before.freeze_windows ?? [], after.freezes);
}

/**
 * Two moments, compared as moments.
 *
 * The form holds a local datetime and sends an instant, so the same moment
 * makes a round trip through the browser's zone and comes back spelled
 * differently ("...T18:00:00Z" against "...T18:00:00.000Z"). Comparing the
 * strings made every save of a change window read as a schedule change, and
 * asked for a reason to move a schedule that had not moved.
 */
function sameInstant(left: string | null | undefined, right: string | null | undefined): boolean {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return Date.parse(left) === Date.parse(right);
}

/** The same freezes, in the same order, each span compared as moments. */
function sameFreezes(before: readonly FreezeWindow[], after: readonly FreezeWindow[]): boolean {
  if (before.length !== after.length) return false;
  return before.every(
    (freeze, index) =>
      sameInstant(freeze.starts_at, after[index].starts_at) &&
      sameInstant(freeze.ends_at, after[index].ends_at) &&
      (freeze.reason ?? "") === (after[index].reason ?? ""),
  );
}

/**
 * Refused here in the API's own limits before it is asked: 160 characters,
 * one account, and a change window with both ends in the right order, which
 * the API answers as `invalid_schedule`.
 */
export function validateTicketGroup(
  draft: TicketGroupDraft,
  editing?: { starts_at: string | null; ends_at: string | null; freeze_windows?: FreezeWindow[] | null },
): string[] {
  const problems: string[] = [];
  if (draft.name.trim() === "") problems.push(GROUP_NAME_REQUIRED);
  if (draft.name.trim().length > 160) problems.push(GROUP_NAME_TOO_LONG);
  if (draft.accountId === "") problems.push(GROUP_ACCOUNT_REQUIRED);
  if (draft.kind === "change_window" && (draft.startsAt === "" || draft.endsAt === ""))
    problems.push(CHANGE_WINDOW_ENDS_REQUIRED);
  if (draft.startsAt !== "" && draft.endsAt !== "" && Date.parse(draft.endsAt) <= Date.parse(draft.startsAt))
    problems.push(ENDS_AFTER_STARTS);
  // The API's own freeze rules (`freezeProblems`): a freeze with no end, or
  // an end before its start, is not a rule anyone can apply.
  if (draft.freezes.some((freeze) => freeze.startsAt === "" || freeze.endsAt === ""))
    problems.push(FREEZE_ENDS_REQUIRED);
  if (
    draft.freezes.some(
      (freeze) =>
        freeze.startsAt !== "" && freeze.endsAt !== "" && Date.parse(freeze.endsAt) <= Date.parse(freeze.startsAt),
    )
  )
    problems.push(FREEZE_ENDS_AFTER_STARTS);
  // Asked for here rather than waiting for the API's own refusal, so the
  // reader is told before the save rather than after it.
  if (
    editing &&
    draft.kind === "change_window" &&
    draft.changeWindowReason.trim() === "" &&
    scheduleMoved(editing, {
      startsAt: toInstant(draft.startsAt),
      endsAt: toInstant(draft.endsAt),
      freezes: toFreezeWindows(draft.freezes),
    })
  )
    problems.push(CHANGE_WINDOW_REASON_REQUIRED);
  return problems;
}

/** The freezes as the API stores them; a blank reason travels as no reason at all. */
export function toFreezeWindows(freezes: readonly FreezeDraft[]): FreezeWindow[] {
  return freezes.flatMap((freeze) => {
    const starts = toInstant(freeze.startsAt);
    const ends = toInstant(freeze.endsAt);
    if (!starts || !ends) return [];
    return [{ starts_at: starts, ends_at: ends, ...(freeze.reason.trim() ? { reason: freeze.reason.trim() } : {}) }];
  });
}

/** The stored freezes as the form holds them. */
export function toFreezeDrafts(freezes: readonly FreezeWindow[] | undefined): FreezeDraft[] {
  return (freezes ?? []).map((freeze) => ({
    startsAt: toLocalInput(freeze.starts_at),
    endsAt: toLocalInput(freeze.ends_at),
    reason: freeze.reason ?? "",
  }));
}

/** A local datetime from the form as the ISO instant the API takes, or null. */
export function toInstant(local: string): string | null {
  if (local.trim() === "") return null;
  const parsed = new Date(local);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** An ISO instant as the value a datetime-local input holds. */
export function toLocalInput(instant: string | null | undefined): string {
  if (!instant) return "";
  const parsed = new Date(instant);
  if (Number.isNaN(parsed.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

/** Plain words for the refusals `/v1/ticket-groups` answers with. */
export function describeTicketGroupError(error: unknown): string {
  const parsed = apiError(error);
  const problems = refusalProblems(error);
  switch (parsed.code) {
    case "invalid_schedule":
      return problems.length > 0
        ? `The API refused the schedule: ${problems.join("; ")}.`
        : "The API refused the schedule of this group.";
    case "stale_version":
      return "Someone else changed this group. It has been reloaded; try again.";
    case "not_found":
      return "That group is gone, or it belongs to an account you cannot see.";
    case "validation_failed":
      return parsed.details?.join("; ") ?? "The group was not valid.";
    default:
      return `The group was not saved (${parsed.code}).`;
  }
}

/**
 * One routing default as the editor holds it. `category` empty means the
 * rule is for the ticket type as a whole; a rule naming a category wins over
 * it on the server.
 */
export interface RoutingRuleDraft {
  ticketType: RoutableType;
  category: string;
  groupId: string;
}

export const RULE_GROUP_REQUIRED = "Every rule has to name a group.";
export const RULE_DUPLICATE = "Two rules cannot cover the same type and category.";
export const RULE_CATEGORY_TOO_LONG = "A category is at most 120 characters.";

/** The whole set, checked before the PUT that replaces it. */
export function validateRoutingRules(rules: RoutingRuleDraft[]): string[] {
  const problems: string[] = [];
  if (rules.some((rule) => rule.groupId === "")) problems.push(RULE_GROUP_REQUIRED);
  if (rules.some((rule) => rule.category.trim().length > 120)) problems.push(RULE_CATEGORY_TOO_LONG);
  const seen = new Set<string>();
  for (const rule of rules) {
    const key = `${rule.ticketType}:${rule.category.trim().toLowerCase()}`;
    if (seen.has(key)) {
      problems.push(RULE_DUPLICATE);
      break;
    }
    seen.add(key);
  }
  return problems;
}

/** The set as the PUT body carries it: a blank category travels as null. */
export function toRoutingRuleInputs(rules: RoutingRuleDraft[]): RoutingRuleInput[] {
  return rules.map((rule) => ({
    ticket_type: rule.ticketType,
    category: rule.category.trim() === "" ? null : rule.category.trim(),
    group_id: rule.groupId,
  }));
}
