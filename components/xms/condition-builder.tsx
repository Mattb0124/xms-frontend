"use client";

import { useState } from "react";
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
  "xms-field border-xms-control-line bg-xms-card text-xms-ink h-[var(--xms-header-pill-h)] rounded-control border px-2 text-body";

function firstOperator(field: ConditionField | undefined): Operator {
  return field ? OPERATORS_BY_KIND[field.kind][0] : "eq";
}

/** What a single control shows of a condition's value: the first of a list, a string, or nothing. */
function shownValue(value: Condition["value"]): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return typeof value === "string" ? value : "";
}

interface RowIds {
  ids: number[];
  next: number;
}

/** One id per row: rows added at the end get fresh ids, and rows gone from the end take theirs. */
function fitted(state: RowIds, length: number): RowIds {
  if (state.ids.length === length) return state;
  if (state.ids.length > length) return { ids: state.ids.slice(0, length), next: state.next };
  const fresh = Array.from({ length: length - state.ids.length }, (_, offset) => state.next + offset);
  return { ids: [...state.ids, ...fresh], next: state.next + fresh.length };
}

/**
 * A key per row that survives the removal of a row above it. The ids live
 * here and not on the conditions, which go to the list route and the URL as
 * they are.
 */
function useRowIds(length: number) {
  const [state, setState] = useState<RowIds>(() => fitted({ ids: [], next: 0 }, length));
  const current = fitted(state, length);
  if (current !== state) setState(current);
  const removed = (index: number) =>
    setState((prev) => ({ ids: prev.ids.filter((_, i) => i !== index), next: prev.next }));
  return { ids: current.ids, removed };
}

export interface ValueControlProps {
  field: ConditionField | undefined;
  op: Operator;
  value: string;
  onChange: (next: string) => void;
}

function ValueControl({ field, op, value, onChange }: ValueControlProps) {
  if (!needsValue(op)) return <span aria-hidden className="min-w-[200px] flex-1" />;
  const choices = field?.kind === "enum" || field?.kind === "uuid" ? field.options : undefined;
  if (choices) {
    return (
      <StripSelect
        ariaLabel="Value"
        value={value}
        display={choices.find((option) => option.value === value)?.label ?? "Value"}
        onChange={onChange}
        className="min-w-[200px] flex-1"
      >
        <option value="">Value</option>
        {choices.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </StripSelect>
    );
  }
  return (
    <input
      aria-label="Value"
      type={field?.kind === "timestamp" ? "date" : "text"}
      placeholder="Value"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn(CONTROL, "min-w-[200px] flex-1")}
    />
  );
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
  const rowIds = useRowIds(rows.length);
  const update = (index: number, patch: Partial<Condition>) =>
    onChange(rows.map((condition, i) => (i === index ? { ...condition, ...patch } : condition)));
  const remove = (index: number) => {
    rowIds.removed(index);
    onChange(rows.filter((_, i) => i !== index));
  };
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
          return (
            <div key={rowIds.ids[index]} className="flex items-center gap-2" data-condition-row>
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
              <ValueControl
                field={field}
                op={condition.op}
                value={shownValue(condition.value)}
                onChange={(next) => update(index, { value: next })}
              />
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
          <button type="button" onClick={add} className="text-xms-accent text-body font-medium hover:underline">
            + Add condition
          </button>
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xms-accent text-body font-medium hover:underline"
          >
            Clear conditions
          </button>
        </div>
      </div>
    </div>
  );
}
