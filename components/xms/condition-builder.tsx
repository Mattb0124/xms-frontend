"use client";

import {
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

const CONTROL = "border-xms-line bg-xms-card text-xms-ink h-[32px] rounded-[4px] border px-2 text-[13px]";

function needsValue(op: Operator): boolean {
  return op !== "empty" && op !== "not_empty";
}

/** AND-stacked field, operator, value rows (Queue grammar, User Experience section 3.2). */
export function ConditionBuilder({ fields, value, onChange, className }: ConditionBuilderProps) {
  const update = (index: number, patch: Partial<Condition>) => {
    const next = value.map((condition, i) => (i === index ? { ...condition, ...patch } : condition));
    onChange(next);
  };
  const remove = (index: number) => onChange(value.filter((_, i) => i !== index));
  const add = () => {
    const first = fields[0];
    if (!first) return;
    onChange([...value, { field: first.key, op: OPERATORS_BY_KIND[first.kind][0], value: "" }]);
  };

  return (
    <div className={cn("flex flex-col gap-2", className)} role="group" aria-label="Conditions">
      {value.map((condition, index) => {
        const field = fields.find((f) => f.key === condition.field) ?? fields[0];
        const operators = field ? OPERATORS_BY_KIND[field.kind] : [];
        return (
          <div key={index} className="flex items-center gap-2" data-condition-row>
            <span className="xms-mono text-xms-muted w-8 text-[11px]">{index === 0 ? "" : "AND"}</span>
            <select
              aria-label="Field"
              value={condition.field}
              onChange={(event) => {
                const nextField = fields.find((f) => f.key === event.target.value);
                update(index, {
                  field: event.target.value,
                  op: nextField ? OPERATORS_BY_KIND[nextField.kind][0] : condition.op,
                  value: "",
                });
              }}
              className={CONTROL}
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
              className={CONTROL}
            >
              {operators.map((op) => (
                <option key={op} value={op}>
                  {OPERATOR_LABEL[op]}
                </option>
              ))}
            </select>
            {needsValue(condition.op) ? (
              field?.kind === "enum" && field.options ? (
                <select
                  aria-label="Value"
                  value={Array.isArray(condition.value) ? (condition.value[0] ?? "") : (condition.value ?? "")}
                  onChange={(event) => update(index, { value: event.target.value })}
                  className={CONTROL}
                >
                  <option value="">Choose</option>
                  {field.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  aria-label="Value"
                  type={field?.kind === "date" ? "date" : field?.kind === "number" ? "number" : "text"}
                  value={Array.isArray(condition.value) ? condition.value.join(",") : (condition.value ?? "")}
                  onChange={(event) => update(index, { value: event.target.value })}
                  className={cn(CONTROL, "min-w-[160px]")}
                />
              )
            ) : null}
            <button
              type="button"
              aria-label="Remove condition"
              onClick={() => remove(index)}
              className="text-xms-muted hover:text-xms-ink text-[14px]"
            >
              ×
            </button>
          </div>
        );
      })}
      <button type="button" onClick={add} className="text-xms-accent self-start text-[12px] hover:underline">
        + Add condition
      </button>
    </div>
  );
}
