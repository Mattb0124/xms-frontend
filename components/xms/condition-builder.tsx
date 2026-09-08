"use client";

import { CloseIcon } from "@/components/xms/icons";
import {
  needsValue,
  OPERATOR_LABEL,
  OPERATORS_BY_KIND,
  type Condition,
  type ConditionField,
  type Operator,
} from "@/lib/conditions";
import { cn } from "@/lib/utils";

export interface ConditionBuilderProps {
  fields: ConditionField[];
  value: Condition[];
  onChange: (next: Condition[]) => void;
  className?: string;
}

/**
 * The controls are the same 32px, 4px-radius, 13px controls the tool strip
 * carries, drawn as native selects so the chevron is the platform's own: the
 * reference the reviewer sent draws them that way rather than as pills with a
 * glyph of their own.
 */
const CONTROL =
  "border-xms-control-line bg-xms-card text-xms-ink h-[var(--xms-header-pill-h)] rounded-[var(--xms-radius-control)] border px-2 text-[13px]";

function firstOperator(field: ConditionField | undefined): Operator {
  return field ? OPERATORS_BY_KIND[field.kind][0] : "eq";
}

/**
 * The filter builder the funnel opens (the reviewer's own reference,
 * `01-architecture/wireframes/v3/refs/filter-builder.png`): a "WHERE" label,
 * one row per condition of field, operator and value with a cross to remove
 * it, and "Add condition" and "Clear conditions" underneath.
 *
 * Rows join with AND, which is the `match: "all"` the server defaults to, so
 * the word does not need repeating down the column: "WHERE" says it once.
 * Fields, operators and value kinds all come from the server's own allowlist
 * through `lib/conditions.ts`, so a row that can be built is a row the list
 * route will accept.
 */
export function ConditionBuilder({ fields, value, onChange, className }: ConditionBuilderProps) {
  const update = (index: number, patch: Partial<Condition>) =>
    onChange(value.map((condition, i) => (i === index ? { ...condition, ...patch } : condition)));
  const remove = (index: number) => onChange(value.filter((_, i) => i !== index));
  const add = () => {
    const first = fields[0];
    if (!first) return;
    onChange([...value, { field: first.key, op: firstOperator(first), value: "" }]);
  };

  return (
    // The stack is capped: a condition row is three controls and a cross, and
    // stretching the value box across a 1460px desk turns a short phrase into
    // a runway.
    <div className={cn("flex max-w-[760px] items-start gap-3", className)} role="group" aria-label="Conditions">
      <span className="xms-caption pt-[11px]">Where</span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {value.map((condition, index) => {
          const field = fields.find((f) => f.key === condition.field) ?? fields[0];
          const operators = field ? OPERATORS_BY_KIND[field.kind] : [];
          const choices = field?.kind === "enum" || field?.kind === "uuid" ? field.options : undefined;
          const shown = Array.isArray(condition.value)
            ? (condition.value[0] ?? "")
            : typeof condition.value === "string"
              ? condition.value
              : "";
          return (
            <div key={index} className="flex items-center gap-2" data-condition-row>
              <select
                aria-label="Field"
                value={condition.field}
                onChange={(event) => {
                  const nextField = fields.find((f) => f.key === event.target.value);
                  update(index, { field: event.target.value, op: firstOperator(nextField), value: "" });
                }}
                className={cn(CONTROL, "min-w-[168px]")}
              >
                {fields.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Operator"
                value={condition.op}
                onChange={(event) => update(index, { op: event.target.value as Operator })}
                className={cn(CONTROL, "min-w-[140px]")}
              >
                {operators.map((op) => (
                  <option key={op} value={op}>
                    {OPERATOR_LABEL[op]}
                  </option>
                ))}
              </select>
              {needsValue(condition.op) ? (
                choices ? (
                  <select
                    aria-label="Value"
                    value={shown}
                    onChange={(event) => update(index, { value: event.target.value })}
                    className={cn(CONTROL, "min-w-[180px] flex-1")}
                  >
                    <option value="">Value</option>
                    {choices.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    aria-label="Value"
                    type={field?.kind === "timestamp" ? "date" : "text"}
                    placeholder="Value"
                    value={shown}
                    onChange={(event) => update(index, { value: event.target.value })}
                    className={cn(CONTROL, "min-w-[180px] flex-1")}
                  />
                )
              ) : (
                <span aria-hidden className="min-w-[180px] flex-1" />
              )}
              <button
                type="button"
                aria-label="Remove condition"
                onClick={() => remove(index)}
                className="text-xms-muted hover:text-xms-ink flex h-[var(--xms-header-pill-h)] w-6 shrink-0 items-center justify-center"
              >
                <CloseIcon size={15} />
              </button>
            </div>
          );
        })}
        <div className="flex items-center gap-5 pt-[2px]">
          <button type="button" onClick={add} className="text-xms-accent text-[13px] font-medium hover:underline">
            + Add condition
          </button>
          {value.length > 0 ? (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xms-accent text-[13px] font-medium hover:underline"
            >
              Clear conditions
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
