import type { TicketListParams } from "@/lib/tickets/queue-views";

/**
 * The export route takes the server's ConditionSet grammar (Ticket
 * Management technical 3.3), not the Queue's list parameters, so the current
 * view and chips are expressed as conditions here. Operators and fields
 * come from the server allowlist; anything the grammar cannot say (the
 * breached view is response OR resolution breached) is approximated and
 * named in `notes` so the toast can say so.
 */
export type ExportOperator = "eq" | "neq" | "in" | "not_in" | "contains" | "before" | "after" | "is_null" | "is_me";

export interface ExportCondition {
  field: string;
  op: ExportOperator;
  value?: string | string[] | boolean;
}

export interface ExportConditionSet {
  conditions: ExportCondition[];
  match?: "all" | "any";
}

export interface ExportSpec {
  conditions: ExportConditionSet;
  accountIds: string[];
  notes: string[];
}

const CLOSED_STATES = ["closed", "cancelled"];

export function paramsToExportSpec(params: TicketListParams): ExportSpec {
  const conditions: ExportCondition[] = [];
  const notes: string[] = [];
  if (params.state?.length) conditions.push({ field: "state", op: "in", value: params.state });
  else if (params.open) conditions.push({ field: "state", op: "not_in", value: CLOSED_STATES });
  if (params.type?.length) conditions.push({ field: "type", op: "in", value: params.type });
  if (params.priority?.length) conditions.push({ field: "priority", op: "in", value: params.priority });
  // The out-of-scope flag is an enum in the server's own allowlist now
  // (`src/modules/tickets/conditions.ts`), so the export says exactly what
  // the list said rather than quietly widening to every ticket.
  if (params.out_of_scope?.length) conditions.push({ field: "out_of_scope", op: "in", value: params.out_of_scope });
  if (params.mine) conditions.push({ field: "assignee_id", op: "is_me" });
  else if (params.unassigned) conditions.push({ field: "assignee_id", op: "is_null" });
  else if (params.assignee_id) conditions.push({ field: "assignee_id", op: "eq", value: params.assignee_id });
  if (params.group_id) conditions.push({ field: "group_id", op: "eq", value: params.group_id });
  if (params.breached) {
    conditions.push({ field: "sla_resolution_breached", op: "eq", value: true });
    notes.push("Breached counts resolution breaches only in the export.");
  }
  if (params.q) conditions.push({ field: "short_description", op: "contains", value: params.q });
  return { conditions: { conditions, match: "all" }, accountIds: params.account_id ?? [], notes };
}

/** base64url without padding, the encoding the export route decodes. */
export function encodeConditions(set: ExportConditionSet): string {
  const json = JSON.stringify(set);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function exportUrl(format: "csv" | "xlsx", spec: ExportSpec): string {
  const search = new URLSearchParams({ format });
  if (spec.conditions.conditions.length > 0) search.set("conditions", encodeConditions(spec.conditions));
  if (spec.accountIds.length > 0) search.set("account_id", spec.accountIds.join(","));
  return `/v1/exports/tickets?${search.toString()}`;
}
