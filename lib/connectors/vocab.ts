/**
 * Connector vocabulary shared by the admin screens and the ticket Sync card
 * (ServiceNow Sync functional 5.1). Mirrors the backend's domain/sync/maps
 * XMS_FIELDS table: the fields a map may target and their default system of
 * record. The server validates; this list only drives the pickers.
 */
export type ConnectorMode = "off" | "ingest_only" | "bidirectional";
export type ConnectorHealth = "healthy" | "degraded" | "failing" | "tripped";
export type KillSwitchState = "armed" | "tripped";
export type LinkState = "linked" | "pending_external" | "pending_xms" | "conflict" | "unlinked";
export type RunDirection = "in" | "out" | "poll" | "webhook";
export type RunOutcome =
  "success" | "retried" | "dead_lettered" | "skipped_reflection" | "skipped_policy" | "skipped_mode" | "noop";
export type MapState = "draft" | "validated" | "active" | "retired";
export type Direction = "in" | "out" | "both";
export type SystemOfRecord = "xms" | "external" | "newest" | "merge" | "external_at_create_then_xms" | "none";
export type TransformKind = "none" | "lookup" | "template" | "truncate";

export type XmsField =
  | "short_description"
  | "requester_email"
  | "description"
  | "requester_name"
  | "category"
  | "impact"
  | "urgency"
  | "external_ref"
  | "client_reference"
  | "client_notes";

export const XMS_FIELDS: { value: XmsField; label: string; required: boolean; sor: SystemOfRecord }[] = [
  { value: "short_description", label: "Short description", required: true, sor: "external_at_create_then_xms" },
  { value: "requester_email", label: "Requester email", required: true, sor: "external_at_create_then_xms" },
  { value: "description", label: "Description", required: false, sor: "external_at_create_then_xms" },
  { value: "requester_name", label: "Requester name", required: false, sor: "external_at_create_then_xms" },
  { value: "category", label: "Category", required: false, sor: "xms" },
  { value: "impact", label: "Impact", required: false, sor: "external_at_create_then_xms" },
  { value: "urgency", label: "Urgency", required: false, sor: "external_at_create_then_xms" },
  { value: "external_ref", label: "External reference", required: false, sor: "external" },
  { value: "client_reference", label: "Client reference", required: false, sor: "external" },
  { value: "client_notes", label: "Client notes", required: false, sor: "newest" },
];

export function defaultSor(field: XmsField): SystemOfRecord {
  return XMS_FIELDS.find((entry) => entry.value === field)?.sor ?? "none";
}

export const DIRECTIONS: { value: Direction; label: string }[] = [
  { value: "in", label: "In" },
  { value: "out", label: "Out" },
  { value: "both", label: "Both" },
];

export const SYSTEMS_OF_RECORD: { value: SystemOfRecord; label: string }[] = [
  { value: "xms", label: "XMS" },
  { value: "external", label: "External" },
  { value: "newest", label: "Newest (free text)" },
  { value: "merge", label: "Merge (journals)" },
  { value: "external_at_create_then_xms", label: "External at create, then XMS" },
  { value: "none", label: "None" },
];

export const TRANSFORM_KINDS: { value: TransformKind; label: string }[] = [
  { value: "none", label: "None" },
  { value: "lookup", label: "Lookup table" },
  { value: "template", label: "Template" },
  { value: "truncate", label: "Truncate" },
];

export const MODES: { value: ConnectorMode; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "ingest_only", label: "Ingest only" },
  { value: "bidirectional", label: "Bidirectional" },
];

/** Copy shown beside the disabled bidirectional option (the API answers 409 mode_unavailable). */
export const BIDIRECTIONAL_UNAVAILABLE = "Bidirectional mode ships with Phase 3.";

export const RUN_DIRECTIONS: { value: RunDirection; label: string }[] = [
  { value: "in", label: "In" },
  { value: "out", label: "Out" },
  { value: "poll", label: "Poll" },
  { value: "webhook", label: "Webhook" },
];

export const RUN_OUTCOMES: { value: RunOutcome; label: string }[] = [
  { value: "success", label: "Success" },
  { value: "retried", label: "Retried" },
  { value: "dead_lettered", label: "Dead lettered" },
  { value: "skipped_reflection", label: "Skipped (reflection)" },
  { value: "skipped_policy", label: "Skipped (policy)" },
  { value: "skipped_mode", label: "Skipped (mode)" },
  { value: "noop", label: "No change" },
];

/** Signal tone names from the `--state-*` trios (never the identity accent). */
export type SignalTone = "complete" | "needs-input" | "overdue" | "blocked" | "ready" | "progress";

export function healthTone(health: ConnectorHealth): SignalTone {
  switch (health) {
    case "healthy":
      return "complete";
    case "degraded":
      return "needs-input";
    case "failing":
    case "tripped":
      return "overdue";
    default:
      return "blocked";
  }
}

export function healthLabel(health: ConnectorHealth): string {
  return health.charAt(0).toUpperCase() + health.slice(1);
}

export function modeTone(mode: ConnectorMode): SignalTone {
  switch (mode) {
    case "ingest_only":
      return "ready";
    case "bidirectional":
      return "progress";
    default:
      return "blocked";
  }
}

export function modeLabel(mode: ConnectorMode): string {
  return MODES.find((entry) => entry.value === mode)?.label ?? mode;
}

export function linkStateTone(state: LinkState): SignalTone {
  switch (state) {
    case "linked":
      return "complete";
    case "pending_external":
    case "pending_xms":
      return "needs-input";
    case "conflict":
      return "overdue";
    default:
      return "blocked";
  }
}

export const LINK_STATE_LABEL: Record<LinkState, string> = {
  linked: "Linked",
  pending_external: "Pending in ServiceNow",
  pending_xms: "Pending in XMS",
  conflict: "Conflict",
  unlinked: "Unlinked",
};

export function outcomeTone(outcome: RunOutcome): SignalTone {
  switch (outcome) {
    case "success":
      return "complete";
    case "retried":
      return "needs-input";
    case "dead_lettered":
      return "overdue";
    case "noop":
      return "blocked";
    default:
      return "ready";
  }
}

export function outcomeLabel(outcome: RunOutcome): string {
  return RUN_OUTCOMES.find((entry) => entry.value === outcome)?.label ?? outcome;
}

export function mapStateTone(state: MapState): SignalTone {
  switch (state) {
    case "active":
      return "complete";
    case "validated":
      return "ready";
    case "retired":
      return "blocked";
    default:
      return "needs-input";
  }
}

export function mapStateLabel(state: MapState): string {
  return state.charAt(0).toUpperCase() + state.slice(1);
}

/** The ServiceNow record URL for a linked ticket (opens the form in the client instance). */
export function externalRecordUrl(baseUrl: string, tableName: string, sysId: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/nav_to.do?uri=${encodeURIComponent(`${tableName}.do?sys_id=${sysId}`)}`;
}

/** Seconds as "2m 5s" or "3h 12m"; used for the inbound lag and run durations. */
export function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
