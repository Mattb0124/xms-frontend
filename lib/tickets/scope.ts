import type { SignalTone } from "@/components/xms/signal-pill";
import { apiError, describeError, type ApiError } from "@/lib/admin/api-error";
import type { ScopeDecisionBody, ScopeFlagBody, TicketScope } from "@/redux/ticketsApi";

/**
 * The out-of-scope flag and its decision (TM-11, Ticket Management
 * functional 5.1 and technical 3.3): the four-value vocabulary the record
 * carries, how each state reads, the two bodies, and the server's refusals
 * in words.
 *
 * Two permissions, not one: raising the flag is part of working the ticket
 * (`tickets:work`); deciding it is the account's commercial answer
 * (`tickets:approve-scope`), and the person who raised it never decides it.
 * Every rule here is also enforced by the API; this only says so before the
 * click rather than after the refusal.
 */
export const SCOPE_STATES = ["none", "flagged", "approved", "declined"] as const;
export type ScopeState = (typeof SCOPE_STATES)[number];

export const SCOPE_LABELS: Record<string, string> = {
  none: "In scope",
  flagged: "Flagged out of scope",
  approved: "Approved out of scope",
  declined: "Declined as out of scope",
};

export function scopeLabel(state: string): string {
  return SCOPE_LABELS[state] ?? state;
}

/** Flagged waits on someone, declined is a refusal, approved is settled. */
export function scopeTone(state: string): SignalTone {
  if (state === "flagged") return "needs-input";
  if (state === "declined") return "overdue";
  if (state === "approved") return "complete";
  return "ready";
}

export function isFlagged(scope: Pick<TicketScope, "out_of_scope">): boolean {
  return scope.out_of_scope === "flagged";
}

/** An allowance in minutes as hours, the unit a contract period is read in. */
export function allowanceLabel(minutes: number | null): string {
  if (minutes === null || minutes === 0) return "No extra budget";
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h of extra budget (${minutes} minutes)`;
}

/** The person as the server named them, never an id prefix standing in for a name. */
export function actorLabel(name: string | null, id: string | null): string | null {
  return name ?? (id ? "Someone on the team" : null);
}

/**
 * Why this reader cannot decide a pending flag, or null when they can. The
 * flagger is refused here in the same words the API refuses them with
 * (`flagger_cannot_decide`), so a decision is never offered and then taken
 * back.
 */
export function decisionBlockedReason(
  scope: Pick<TicketScope, "out_of_scope" | "flagged_by">,
  viewerId: string | undefined,
): string | null {
  if (!isFlagged(scope)) return "There is no flag waiting for a decision.";
  if (viewerId && scope.flagged_by === viewerId)
    return "You raised this flag, so someone else decides it: approval is the account's commercial answer, not the flagger's own.";
  return null;
}

export function flagBody(version: number, reason: string): ScopeFlagBody {
  return { version, out_of_scope: true, reason: reason.trim() };
}

export function withdrawBody(version: number): ScopeFlagBody {
  return { version, out_of_scope: false };
}

/**
 * The decision body. An allowance is sent only when it is a whole number of
 * minutes above zero, since the API takes minutes from 1 upwards and
 * "approved, no extra budget" is the absent field, not a zero.
 */
export function decisionBody(
  version: number,
  decision: "approve" | "decline",
  note: string,
  allowanceMinutes?: string,
): ScopeDecisionBody {
  const body: ScopeDecisionBody = { version, decision };
  const trimmed = note.trim();
  if (trimmed) body.note = trimmed;
  const minutes = Number(allowanceMinutes);
  if (decision === "approve" && allowanceMinutes?.trim() && Number.isInteger(minutes) && minutes > 0)
    body.overage_allowance_minutes = minutes;
  return body;
}

/** Refused before the API: a flag says why, and a decline says why too. */
export function validateFlag(reason: string): string | null {
  return reason.trim() ? null : "Say why this work is outside the contract; the reason reaches the account's managers.";
}

export function validateDecision(
  decision: "approve" | "decline",
  note: string,
  allowanceMinutes: string,
): string | null {
  if (decision === "decline" && !note.trim()) return "Say why the work is declined; the flagger is told in your words.";
  if (decision === "approve" && allowanceMinutes.trim()) {
    const minutes = Number(allowanceMinutes);
    if (!Number.isInteger(minutes) || minutes < 1)
      return "The allowance is a whole number of minutes, or leave it empty to approve without extra budget.";
  }
  return null;
}

export interface ScopeError extends ApiError {
  /** no_contract_period names the day it looked for one. */
  on?: string;
}

export function scopeError(error: unknown): ScopeError {
  const parsed = apiError(error) as ScopeError;
  const data = (error as { data?: Record<string, unknown> })?.data;
  if (data && typeof data === "object" && typeof data.on === "string") parsed.on = data.on;
  return parsed;
}

/** Every refusal the two routes answer with, in words the consultant acts on. */
export function describeScopeError(error: ScopeError): string {
  switch (error.code) {
    case "ticket_closed":
      return "This ticket is closed or cancelled, so its scope can no longer be changed.";
    case "already_flagged":
      return "This ticket is already flagged out of scope and is waiting for a decision.";
    case "reason_required":
      return "A flag says why. Give a reason and try again.";
    case "not_flagged":
      return "There is no flag waiting for a decision. The record has been reloaded.";
    case "flagger_cannot_decide":
      return "You raised this flag, so someone else decides it.";
    case "no_contract_period":
      return error.on
        ? `The contract has no period covering ${error.on}, so the allowance has nowhere to land. Approve without extra budget, or open the period first.`
        : "The contract has no period covering today, so the allowance has nowhere to land.";
    case "stale_version":
      return "Someone else changed this ticket. It has been reloaded; try again.";
    default:
      return describeError(error);
  }
}
