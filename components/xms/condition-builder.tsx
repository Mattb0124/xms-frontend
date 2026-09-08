"use client";

import { StripSelect } from "@/components/xms/filter-select";
import { ICON, CloseIcon } from "@/components/xms/icons";
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
  const blank = (): Condition => ({
    field: fields[0]?.key ?? "",
    op: firstOperator(fields[0]),
    value: "",
  });
  /**
   * The builder is never empty: the reference opens on one row waiting to be
   * filled in, not on a link that has to be found first. The row is unfinished
   * until it has a value, so it stays out of the request and out of the URL
   * until the reader has said something with it.
   */
  const rows = value.length > 0 ? value : [blank()];
  const update = (index: number, patch: Partial<Condition>) =>
    onChange(rows.map((condition, i) => (i === index ? { ...condition, ...patch } : condition)));
  const remove = (index: number) => onChange(rows.filter((_, i) => i !== index));
  const add = () => {
    if (!fields[0]) return;
    onChange([...rows, blank()]);
  };

  return (
    <div className={cn("flex items-start gap-3", className)} role="group" aria-label="Conditions">
      <span className="xms-caption pt-[11px]">Where</span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {rows.map((condition, index) => {
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
              <StripSelect
                ariaLabel="Field"
                value={condition.field}
                display={field?.label ?? condition.field}
                onChange={(next) => {
                  const nextField = fields.find((f) => f.key === next);
                  update(index, { field: next, op: firstOperator(nextField), value: "" });
                }}
                className="w-[184px]"
              >
                {fields.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </StripSelect>
              <StripSelect
                ariaLabel="Operator"
                value={condition.op}
                display={OPERATOR_LABEL[condition.op]}
                onChange={(next) => update(index, { op: next as Operator })}
                className="w-[152px]"
              >
                {operators.map((op) => (
                  <option key={op} value={op}>
                    {OPERATOR_LABEL[op]}
                  </option>
                ))}
              </StripSelect>
              {needsValue(condition.op) ? (
                choices ? (
                  <StripSelect
                    ariaLabel="Value"
                    value={shown}
                    display={choices.find((option) => option.value === shown)?.label ?? "Value"}
                    onChange={(next) => update(index, { value: next })}
                    className="min-w-[200px] flex-1"
                  >
                    <option value="">Value</option>
                    {choices.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </StripSelect>
                ) : (
                  <input
                    aria-label="Value"
                    type={field?.kind === "timestamp" ? "date" : "text"}
                    placeholder="Value"
                    value={shown}
                    onChange={(event) => update(index, { value: event.target.value })}
                    className={cn(CONTROL, "min-w-[200px] flex-1")}
                  />
                )
              ) : (
                <span aria-hidden className="min-w-[200px] flex-1" />
              )}
              <button
                type="button"
                aria-label="Remove condition"
                onClick={() => remove(index)}
                className="text-xms-muted hover:text-xms-ink flex h-[var(--xms-header-pill-h)] w-6 shrink-0 items-center justify-center"
              >
                <CloseIcon size={ICON.action} />
              </button>
            </div>
          );
        })}
        {/* Both links sit under the rows, side by side, as the reference
            draws them: neither belongs on the Where line. */}
        <div className="flex items-center gap-5 pt-[2px]">
          <button type="button" onClick={add} className="text-xms-accent text-[13px] font-medium hover:underline">
            + Add condition
          </button>
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xms-accent text-[13px] font-medium hover:underline"
          >
            Clear conditions
          </button>
        </div>
      </div>
    </div>
  );
}
