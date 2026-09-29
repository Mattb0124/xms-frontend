/**
 * The outbound half of the ServiceNow connector (ServiceNow Sync functional
 * 5.5 and 5.7, SN-03 to SN-05): the queue vocabulary, and the reading of the
 * conflict outcome the worker settled a row with. The server decides; this
 * file only puts the decision into words.
 */
import type { SignalTone } from "@/lib/connectors/vocab";

export type OutboundStatus = "pending" | "sent" | "failed" | "dead_lettered" | "skipped";

export type OutboundEvent =
  "ticket.updated" | "ticket.transitioned" | "comment.created" | "work_note.created" | "attachment.scanned";

/** The statuses the API's `?status=` accepts; anything else is a 400, never an empty list. */
export const OUTBOUND_STATUSES: { value: OutboundStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
  { value: "dead_lettered", label: "Dead lettered" },
  { value: "skipped", label: "Skipped by policy" },
];

export const OUTBOUND_EVENT_LABEL: Record<OutboundEvent, string> = {
  "ticket.updated": "Ticket updated",
  "ticket.transitioned": "State changed",
  "comment.created": "Comment",
  "work_note.created": "Work note",
  "attachment.scanned": "Attachment",
};

export function outboundStatusLabel(status: OutboundStatus): string {
  return OUTBOUND_STATUSES.find((entry) => entry.value === status)?.label ?? status;
}

export function outboundEventLabel(event: string): string {
  return OUTBOUND_EVENT_LABEL[event as OutboundEvent] ?? event;
}

export function outboundStatusTone(status: OutboundStatus): SignalTone {
  switch (status) {
    case "sent":
      return "complete";
    case "pending":
      return "ready";
    case "failed":
      return "needs-input";
    case "dead_lettered":
      return "overdue";
    default:
      return "blocked";
  }
}

/** Only a settled failure is worth requeueing; the API answers `already_pending` for the rest. */
export function isRetryable(status: OutboundStatus): boolean {
  return status === "failed" || status === "dead_lettered";
}

export interface DroppedField {
  field: string;
  policy: string;
  reason: string;
}

/**
 * What the worker wrote on a contested row: which fields went, which stayed
 * behind and the client's own stamp at the moment it decided.
 */
export interface ConflictOutcome {
  external_changed?: boolean;
  kept?: string[];
  dropped?: DroppedField[];
  external_sys_updated_on?: string;
  [key: string]: unknown;
}

export function keptFields(conflict: ConflictOutcome | null | undefined): string[] {
  return Array.isArray(conflict?.kept) ? conflict.kept.map(String) : [];
}

export function droppedFields(conflict: ConflictOutcome | null | undefined): DroppedField[] {
  if (!Array.isArray(conflict?.dropped)) return [];
  return conflict.dropped
    .filter((entry) => typeof entry === "object" && entry !== null)
    .map((entry) => ({
      field: String(entry.field ?? ""),
      policy: String(entry.policy ?? ""),
      reason: String(entry.reason ?? ""),
    }));
}

/** Why a field stayed behind, in the operator's words rather than the rule's name. */
export function dropReasonLabel(reason: string): string {
  switch (reason) {
    case "external_owned":
      return "ServiceNow owns this field";
    case "older":
      return "the client's change is newer";
    case "none":
      return "this field is never sent";
    default:
      return reason;
  }
}

/**
 * One line for a settled row: what the push carried and what it left behind.
 * Null when the row was never contested, which is the ordinary case.
 */
export function conflictSummary(conflict: ConflictOutcome | null | undefined): string | null {
  const kept = keptFields(conflict);
  const dropped = droppedFields(conflict);
  if (kept.length === 0 && dropped.length === 0) return null;
  const parts: string[] = [];
  if (kept.length > 0) parts.push(`kept ${kept.join(", ")}`);
  if (dropped.length > 0) parts.push(`dropped ${dropped.map((entry) => entry.field).join(", ")}`);
  return `The last push ${parts.join(" and ")}.`;
}

/** The ticket Sync card's outbound state, as the API answers it per link. */
export interface SyncCardOutbound {
  last_pushed_at: string | null;
  pending: number;
  failed: number;
  last_error: string | null;
}

/** "Nothing waiting", "1 change waiting to send", "4 changes waiting to send". */
export function pendingLabel(pending: number): string {
  if (pending <= 0) return "Nothing waiting to send";
  return `${pending} change${pending === 1 ? "" : "s"} waiting to send`;
}
