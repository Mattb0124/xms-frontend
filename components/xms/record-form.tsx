"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface RecordOption {
  value: string;
  label: string;
}

export interface RecordField {
  key: string;
  label: string;
  value: string;
  kind?: "text" | "textarea" | "select";
  options?: RecordOption[];
  readOnly?: boolean;
  /** Mono rendering for keys, dates and external references. */
  mono?: boolean;
  /** A caption under the value, in sentence case: "Derived from the matrix". */
  hint?: string;
}

export interface RecordFormProps {
  fields: RecordField[];
  /** Commit on blur. Reject the promise to roll the field back. */
  onCommit: (key: string, value: string) => Promise<void>;
  /** Called with the restored value after a rejected commit (toast hook). */
  onRollback?: (key: string, restored: string, error: unknown) => void;
  columns?: 1 | 2;
  className?: string;
}

const CONTROL =
  "border-xms-line bg-xms-card text-xms-ink focus:border-xms-accent h-[34px] w-full rounded-[4px] border px-2 text-[13px] outline-none disabled:opacity-60";

// Label 104px, value takes the rest and may shrink below its content, which is
// what lets a long value wrap instead of being clipped (review finding 9).
const ROW = "grid grid-cols-[104px_minmax(0,1fr)] gap-x-3 gap-y-1";

/**
 * The words a read-only field shows: a select shows its option's label, not
 * the stored code, and nothing recorded reads as "Not set" rather than as an
 * empty box (frontend review finding 9).
 */
export function readOnlyText(field: RecordField): string {
  if (field.kind === "select") {
    const option = (field.options ?? []).find((entry) => entry.value === field.value);
    if (option) return option.label;
  }
  return field.value;
}

function Field({
  field,
  onCommit,
  onRollback,
}: {
  field: RecordField;
  onCommit: RecordFormProps["onCommit"];
  onRollback?: RecordFormProps["onRollback"];
}) {
  const [draft, setDraft] = useState(field.value);
  const [pending, setPending] = useState(false);
  // Reset the draft when the server value changes (derive state from props
  // during render; no effect needed).
  const [seenValue, setSeenValue] = useState(field.value);
  if (seenValue !== field.value) {
    setSeenValue(field.value);
    setDraft(field.value);
  }

  const commit = async (next: string) => {
    if (next === field.value) return;
    const previous = field.value;
    setDraft(next);
    setPending(true);
    try {
      await onCommit(field.key, next);
    } catch (error) {
      setDraft(previous);
      onRollback?.(field.key, previous, error);
    } finally {
      setPending(false);
    }
  };

  const id = `record-field-${field.key}`;
  // A value nobody can change is text, not a disabled input: an input-shaped
  // box reads as editable, and a fixed-height box clips "AUS - Austral Mining"
  // to "AUS - Austral M" with no ellipsis and no tooltip (review finding 9).
  if (field.readOnly) {
    const text = readOnlyText(field);
    return (
      <div className={cn(ROW, "items-baseline")} data-field={field.key}>
        <span className="text-xms-label text-[12px]">{field.label}</span>
        <span className="flex flex-col gap-[2px]">
          <span
            data-readonly-value
            title={text || undefined}
            className={cn("text-xms-ink text-[13px] break-words", field.mono && "xms-mono", !text && "text-xms-muted")}
          >
            {text || "Not set"}
          </span>
          {field.hint ? <span className="text-xms-label text-[12px]">{field.hint}</span> : null}
        </span>
      </div>
    );
  }
  const common = { id, disabled: pending, "aria-busy": pending || undefined };
  let control;
  if (field.kind === "select") {
    control = (
      <select {...common} value={draft} onChange={(event) => void commit(event.target.value)} className={CONTROL}>
        {(field.options ?? []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  } else if (field.kind === "textarea") {
    control = (
      <textarea
        {...common}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit(draft)}
        rows={3}
        className={cn(CONTROL, "h-auto py-2")}
      />
    );
  } else {
    control = (
      <input
        {...common}
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit(draft)}
        className={cn(CONTROL, field.mono && "xms-mono")}
      />
    );
  }
  return (
    <div className={cn(ROW, "items-center")} data-field={field.key}>
      <label htmlFor={id} className="text-xms-label text-[12px]">
        {field.label}
      </label>
      <span className="flex min-w-0 flex-col gap-[2px]">
        {control}
        {field.hint ? <span className="text-xms-label text-[12px]">{field.hint}</span> : null}
      </span>
    </div>
  );
}

/** Label-left record form; each field commits on blur and rolls back on rejection. */
export function RecordForm({ fields, onCommit, onRollback, columns = 2, className }: RecordFormProps) {
  return (
    <div
      className={cn("grid gap-x-8 gap-y-3", columns === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1", className)}
    >
      {fields.map((field) => (
        <Field key={field.key} field={field} onCommit={onCommit} onRollback={onRollback} />
      ))}
    </div>
  );
}
