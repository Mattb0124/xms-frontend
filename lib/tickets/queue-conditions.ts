/**
 * The fields the Queue's filter builder offers, and how a built set reaches
 * the list route.
 *
 * The catalogue is the server's own allowlist
 * (`src/modules/tickets/conditions.ts`, `FIELDS`): a field that is not there
 * is a 400, and a field that is there but has no readable value control is
 * worse than not offering it, so the boolean latches and the raw id fields
 * that only an administrator could type are left out. Everything offered can
 * be filled in from a control the reader already understands.
 */
import { stateLabel } from "@/components/xms/state-pill";
import { isComplete, type Condition, type ConditionField } from "@/lib/conditions";
import { encodeConditions, type ExportCondition, type ExportOperator } from "@/lib/tickets/export-conditions";
import { OUT_OF_SCOPE, outOfScopeLabel } from "@/lib/tickets/queue-views";
import { LEVELS, PRIORITIES, TICKET_TYPES } from "@/lib/tickets/vocab";

/** The URL parameter the built set travels in, as readable JSON. */
export const CONDITIONS_PARAM = "c";

const STATES = [
  "new",
  "assigned",
  "in_progress",
  "awaiting_client",
  "awaiting_third_party",
  "resolved",
  "closed",
  "cancelled",
];

const SOURCES = [
  { value: "portal", label: "Portal" },
  { value: "email", label: "Email" },
  { value: "internal", label: "Internal" },
  { value: "api", label: "API" },
  { value: "sync", label: "Sync" },
  { value: "import", label: "Import" },
];

export interface QueueFieldCatalogs {
  accounts?: Array<{ id: string; name: string }>;
  groups?: Array<{ id: string; name: string }>;
}

/**
 * The builder's field list, in the order a consultant reaches for them: what
 * the request says, then how it is classified, then who holds it, then when.
 * Accounts and groups carry their own names, so those two rows are a picker
 * rather than a uuid the reader would have to know.
 */
export function queueConditionFields({ accounts, groups }: QueueFieldCatalogs = {}): ConditionField[] {
  return [
    { key: "short_description", label: "Short description", kind: "text" },
    { key: "category", label: "Category", kind: "text" },
    { key: "state", label: "State", kind: "enum", options: STATES.map((v) => ({ value: v, label: stateLabel(v) })) },
    {
      key: "type",
      label: "Type",
      kind: "enum",
      options: TICKET_TYPES.map((t) => ({ value: t.value, label: t.label })),
    },
    {
      key: "priority",
      label: "Priority",
      kind: "enum",
      options: PRIORITIES.map((p) => ({ value: p, label: p.toUpperCase() })),
    },
    { key: "impact", label: "Impact", kind: "enum", options: LEVELS.map((l) => ({ value: l.value, label: l.label })) },
    {
      key: "urgency",
      label: "Urgency",
      kind: "enum",
      options: LEVELS.map((l) => ({ value: l.value, label: l.label })),
    },
    { key: "source", label: "Source", kind: "enum", options: SOURCES },
    {
      key: "out_of_scope",
      label: "Out of scope",
      kind: "enum",
      options: OUT_OF_SCOPE.map((v) => ({ value: v, label: outOfScopeLabel(v) })),
    },
    {
      key: "account_id",
      label: "Account",
      kind: "uuid",
      options: (accounts ?? []).map((account) => ({ value: account.id, label: account.name })),
    },
    {
      key: "group_id",
      label: "Group",
      kind: "group",
      options: (groups ?? []).map((group) => ({ value: group.id, label: group.name })),
    },
    { key: "assignee_id", label: "Assignee", kind: "actor" },
    { key: "created_at", label: "Opened", kind: "timestamp" },
    { key: "updated_at", label: "Updated", kind: "timestamp" },
    { key: "resolved_at", label: "Resolved", kind: "timestamp" },
  ];
}

/**
 * The finished rows in the server's own shape. A row still being filled in
 * stays in the URL, so the reader does not lose it, but it is left out of the
 * request: a condition the API would refuse is worse than no condition.
 */
export function builtConditions(conditions: Condition[]): ExportCondition[] {
  return conditions.filter(isComplete).map((condition) => ({
    field: condition.field,
    op: condition.op as ExportOperator,
    ...(condition.value === null ? {} : { value: condition.value }),
  }));
}

/**
 * The built set as the list and export routes take it: base64url JSON of
 * `{ conditions, match }`. Undefined when nothing is finished, so the
 * parameter is left off rather than sent empty.
 */
export function conditionsParam(conditions: Condition[]): string | undefined {
  const set = builtConditions(conditions);
  return set.length === 0 ? undefined : encodeConditions({ conditions: set, match: "all" });
}
