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
import type { RoutableType, RoutingRuleInput, TicketGroupKind, TicketGroupStatus } from "@/redux/ticketsApi";

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
}

export const GROUP_NAME_REQUIRED = "A group needs a name.";
export const GROUP_NAME_TOO_LONG = "A name is at most 160 characters.";
export const GROUP_ACCOUNT_REQUIRED = "A group belongs to one account. Choose one.";
export const CHANGE_WINDOW_ENDS_REQUIRED = "A change window needs a start and an end.";
export const ENDS_AFTER_STARTS = "The end has to be after the start.";

/**
 * Refused here in the API's own limits before it is asked: 160 characters,
 * one account, and a change window with both ends in the right order, which
 * the API answers as `invalid_schedule`.
 */
export function validateTicketGroup(draft: TicketGroupDraft): string[] {
  const problems: string[] = [];
  if (draft.name.trim() === "") problems.push(GROUP_NAME_REQUIRED);
  if (draft.name.trim().length > 160) problems.push(GROUP_NAME_TOO_LONG);
  if (draft.accountId === "") problems.push(GROUP_ACCOUNT_REQUIRED);
  if (draft.kind === "change_window" && (draft.startsAt === "" || draft.endsAt === ""))
    problems.push(CHANGE_WINDOW_ENDS_REQUIRED);
  if (draft.startsAt !== "" && draft.endsAt !== "" && Date.parse(draft.endsAt) <= Date.parse(draft.startsAt))
    problems.push(ENDS_AFTER_STARTS);
  return problems;
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
