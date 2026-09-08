/**
 * The condition set grammar the Queue's filter builder, the saved views and
 * the export all speak.
 *
 * The operators and the operator-per-kind map are the server's own
 * (`src/modules/tickets/conditions.ts`: `Operator`, `FIELDS`,
 * `OPERATORS_BY_KIND`), not a second vocabulary that has to be translated on
 * the way out. The set that was here before ("is", "is_not", "gt", "lt",
 * "empty") named operators the API does not have, so a condition built with
 * it could never have been sent; the export already spoke the server's
 * grammar, and now one grammar serves all three.
 *
 * The URL carries the set as compact JSON in `c=`, so a criterion is readable
 * in the address bar and removable one at a time; `encodeConditions` in
 * `lib/tickets/export-conditions.ts` is what turns it into the base64url the
 * list and export routes decode.
 */

export const OPERATORS = [
  "eq",
  "neq",
  "in",
  "not_in",
  "contains",
  "before",
  "after",
  "is_null",
  "is_not_null",
  /** The signed-in person, resolved on the server; never a client-side id. */
  "is_me",
  /** The signed-in person's assignment groups, resolved on the server (TM-08). */
  "is_mine",
] as const;
export type Operator = (typeof OPERATORS)[number];

export interface Condition {
  field: string;
  op: Operator;
  value: string | string[] | boolean | null;
}

/** The server's own field kinds, which decide the operators and the value control. */
export type FieldKind = "text" | "enum" | "uuid" | "actor" | "group" | "timestamp" | "boolean";

export interface ConditionField {
  key: string;
  label: string;
  kind: FieldKind;
  options?: Array<{ value: string; label: string }>;
}

export const OPERATORS_BY_KIND: Record<FieldKind, Operator[]> = {
  text: ["contains", "eq", "neq", "is_null", "is_not_null"],
  enum: ["eq", "neq", "in", "not_in", "is_null", "is_not_null"],
  uuid: ["eq", "neq", "in", "not_in", "is_null", "is_not_null"],
  actor: ["eq", "neq", "in", "not_in", "is_me", "is_null", "is_not_null"],
  group: ["eq", "neq", "in", "not_in", "is_mine", "is_null", "is_not_null"],
  timestamp: ["before", "after", "is_null", "is_not_null"],
  boolean: ["eq"],
};

export const OPERATOR_LABEL: Record<Operator, string> = {
  eq: "is",
  neq: "is not",
  in: "is any of",
  not_in: "is none of",
  contains: "contains",
  before: "before",
  after: "after",
  is_null: "is empty",
  is_not_null: "is not empty",
  is_me: "is me",
  is_mine: "is mine",
};

/** The operators that stand alone: the row draws no value control for them. */
const VALUELESS: Operator[] = ["is_null", "is_not_null", "is_me", "is_mine"];

export function needsValue(op: Operator): boolean {
  return !VALUELESS.includes(op);
}

export function isOperator(value: unknown): value is Operator {
  return typeof value === "string" && (OPERATORS as readonly string[]).includes(value);
}

export function serializeConditions(conditions: Condition[]): string {
  return JSON.stringify(conditions.map((c) => [c.field, c.op, c.value]));
}

/** Parses a serialized set; malformed input yields an empty set instead of throwing. */
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
      if (value !== null && typeof value !== "string" && typeof value !== "boolean" && !Array.isArray(value)) continue;
      out.push({ field, op, value: value as Condition["value"] });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * A condition the API would refuse is worse than no condition: a row whose
 * value has not been given yet stays in the URL but is left out of the
 * request, so the list is the list until the reader finishes the row.
 */
export function isComplete(condition: Condition): boolean {
  if (!needsValue(condition.op)) return true;
  if (Array.isArray(condition.value)) return condition.value.length > 0;
  if (typeof condition.value === "boolean") return true;
  return typeof condition.value === "string" && condition.value.trim() !== "";
}

export function describeCondition(condition: Condition, fields: ConditionField[]): string {
  const field = fields.find((f) => f.key === condition.field);
  const label = field?.label ?? condition.field;
  const raw = Array.isArray(condition.value) ? condition.value : [condition.value];
  const named = raw
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => field?.options?.find((option) => option.value === entry)?.label ?? entry);
  const value = named.length > 0 ? named.join(", ") : String(condition.value ?? "");
  return needsValue(condition.op)
    ? `${label} ${OPERATOR_LABEL[condition.op]} ${value}`.trim()
    : `${label} ${OPERATOR_LABEL[condition.op]}`;
}
