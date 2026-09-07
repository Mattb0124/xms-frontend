/**
 * The condition set grammar shared by the Queue, saved views and the Audit
 * search. Serialises to a compact JSON string carried in the URL (`c=`) and
 * sent to the API verbatim; the server validates fields and operators against
 * its own allowlist (Ticket Management technical section 3, P2.11.1).
 */

export const OPERATORS = [
  "is",
  "is_not",
  "in",
  "contains",
  "gt",
  "lt",
  "before",
  "after",
  "empty",
  "not_empty",
] as const;
export type Operator = (typeof OPERATORS)[number];

export interface Condition {
  field: string;
  op: Operator;
  value: string | string[] | null;
}

export type FieldKind = "text" | "enum" | "number" | "date" | "actor";

export interface ConditionField {
  key: string;
  label: string;
  kind: FieldKind;
  options?: Array<{ value: string; label: string }>;
}

export const OPERATORS_BY_KIND: Record<FieldKind, Operator[]> = {
  text: ["contains", "is", "is_not", "empty", "not_empty"],
  enum: ["is", "is_not", "in", "empty"],
  number: ["is", "gt", "lt"],
  date: ["before", "after", "empty"],
  actor: ["is", "is_not", "empty"],
};

export const OPERATOR_LABEL: Record<Operator, string> = {
  is: "is",
  is_not: "is not",
  in: "is any of",
  contains: "contains",
  gt: "greater than",
  lt: "less than",
  before: "before",
  after: "after",
  empty: "is empty",
  not_empty: "is not empty",
};

export function isOperator(value: unknown): value is Operator {
  return typeof value === "string" && (OPERATORS as readonly string[]).includes(value);
}

export function serializeConditions(conditions: Condition[]): string {
  return JSON.stringify(conditions.map((c) => [c.field, c.op, c.value]));
}

/** Parses a serialised set; malformed input yields an empty set instead of throwing. */
export function parseConditions(raw: string | null | undefined): Condition[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: Condition[] = [];
    for (const entry of parsed) {
      if (!Array.isArray(entry) || entry.length !== 3) continue;
      const [field, op, value] = entry as unknown[];
      if (typeof field !== "string" || !isOperator(op)) continue;
      if (value !== null && typeof value !== "string" && !Array.isArray(value)) continue;
      out.push({ field, op, value: value as Condition["value"] });
    }
    return out;
  } catch {
    return [];
  }
}

export function describeCondition(condition: Condition, fields: ConditionField[]): string {
  const field = fields.find((f) => f.key === condition.field);
  const label = field?.label ?? condition.field;
  const value = Array.isArray(condition.value) ? condition.value.join(", ") : (condition.value ?? "");
  const needsValue = condition.op !== "empty" && condition.op !== "not_empty";
  return needsValue
    ? `${label} ${OPERATOR_LABEL[condition.op]} ${value}`.trim()
    : `${label} ${OPERATOR_LABEL[condition.op]}`;
}
