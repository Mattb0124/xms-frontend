/**
 * Ticket vocabulary shared by the desk screens: types, levels, priorities,
 * pause reasons and the resolution codes. The state labels come from the
 * API (`state_label`); `stateLabel` from the StatePill is the fallback.
 * The resolution codes mirror the backend seed until the catalog is served
 * to non-administrators (the config route needs admin:config today).
 */
import { TYPE_LABEL, type TicketType } from "@/components/xms/type-bar";
import type { Priority } from "@/components/xms/priority-pill";

export type Level = "high" | "medium" | "low";
export type PauseReason = "awaiting_client" | "awaiting_third_party" | "scheduled_window" | "blocked";

/**
 * One name per type, taken from the type bar's map, so the Queue's Type
 * column and the dashboards' Open by type cannot disagree: Operations said
 * "Service Request" while the Queue said "Request" for the same type
 * (frontend review finding 23).
 */
export const TICKET_TYPES: { value: TicketType; label: string }[] = (
  ["incident", "service_request", "change", "problem", "project_task"] as TicketType[]
).map((value) => ({ value, label: TYPE_LABEL[value] }));

/** Names a type key, including one the API added that the client does not know. */
export function ticketTypeLabel(value: string): string {
  return TYPE_LABEL[value as TicketType] ?? value.replace(/_/g, " ");
}

export const LEVELS: { value: Level; label: string }[] = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export const PRIORITIES: Priority[] = ["p1", "p2", "p3", "p4"];

export const PAUSE_REASONS: { value: PauseReason; label: string }[] = [
  { value: "awaiting_client", label: "Awaiting client" },
  { value: "awaiting_third_party", label: "Awaiting third party" },
  { value: "scheduled_window", label: "Scheduled window" },
  { value: "blocked", label: "Blocked" },
];

export interface ResolutionCode {
  key: string;
  label: string;
  /** No-solution codes waive the solution link (Domain Model invariant 6). */
  noSolution: boolean;
}

export const RESOLUTION_CODES: ResolutionCode[] = [
  { key: "fixed", label: "Fixed", noSolution: false },
  { key: "configuration_change", label: "Configuration change", noSolution: false },
  { key: "workaround", label: "Workaround provided", noSolution: false },
  { key: "user_guidance", label: "User guidance", noSolution: false },
  { key: "data_correction", label: "Data correction", noSolution: false },
  { key: "vendor_fix", label: "Vendor fix", noSolution: false },
  { key: "no_fault_found", label: "No fault found", noSolution: true },
  { key: "duplicate", label: "Duplicate", noSolution: true },
  { key: "cancelled_by_client", label: "Cancelled by client", noSolution: true },
  { key: "out_of_scope", label: "Out of scope", noSolution: true },
  { key: "known_error", label: "Known error, no fix available", noSolution: true },
];

/** No-solution codes waive the solution link; the catalog from the API wins over the seed fallback. */
export function isNoSolutionCode(code: string | null | undefined, codes: ResolutionCode[] = RESOLUTION_CODES): boolean {
  return codes.some((entry) => entry.key === code && entry.noSolution);
}

export function resolutionLabel(code: string | null | undefined, codes: ResolutionCode[] = RESOLUTION_CODES): string {
  if (!code) return "none";
  return codes.find((entry) => entry.key === code)?.label ?? code;
}

export const SOURCE_LABEL: Record<string, string> = {
  portal: "Portal",
  email: "Email",
  internal: "Internal",
  api: "API",
  sync: "Sync",
  import: "Import",
};

export const OPEN_STATE_EXCLUSIONS = ["closed", "cancelled", "rejected"];

export function typeLabel(type: string): string {
  return TICKET_TYPES.find((entry) => entry.value === type)?.label ?? type;
}

export function levelLabel(level: string | null | undefined): string {
  return LEVELS.find((entry) => entry.value === level)?.label ?? "";
}
