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
  /**
   * "rows" is the label-left grid the admin forms use. "stacked" is the v3
   * ticket record's Properties list (render 02): a small grey label above the
   * value, a hairline between rows, and no bordered box at rest. An editable
   * field there is text until it is clicked and text again on blur, which is
   * the shape the render shows and the built panel had lost.
   */
  layout?: "rows" | "stacked";
  className?: string;
}

const CONTROL =
  "border-xms-line bg-xms-card text-xms-ink h-[34px] w-full rounded-[4px] border px-2 text-[13px] outline-none disabled:opacity-60";

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
  layout = "rows",
}: {
  field: RecordField;
  onCommit: RecordFormProps["onCommit"];
  onRollback?: RecordFormProps["onRollback"];
  layout?: "rows" | "stacked";
}) {
  const [draft, setDraft] = useState(field.value);
  const [pending, setPending] = useState(false);
  // A stacked field opens its control on click and closes it again on blur, so
  // the panel reads as a list of values rather than a wall of empty boxes.
  const [editing, setEditing] = useState(false);
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
  const stacked = layout === "stacked";
  const STACK_ROW = "border-xms-line flex flex-col gap-[3px] border-b px-4 py-[10px] last:border-b-0";
  // A value nobody can change is text, not a disabled input: an input-shaped
  // box reads as editable, and a fixed-height box clips "AUS - Austral Mining"
  // to "AUS - Austral M" with no ellipsis and no tooltip (review finding 9).
  if (field.readOnly) {
    const text = readOnlyText(field);
    const value = (
      <>
        <span
          data-readonly-value
          title={text || undefined}
          className={cn(
            "text-xms-ink text-[13px] break-words",
            stacked && "font-medium",
            field.mono && "xms-mono",
            !text && "text-xms-muted font-normal",
          )}
        >
          {text || "Not set"}
        </span>
        {field.hint ? <span className="text-xms-label text-[12px]">{field.hint}</span> : null}
      </>
    );
    if (stacked) {
      return (
        <div className={STACK_ROW} data-field={field.key}>
          <span className="text-xms-label text-[12px]">{field.label}</span>
          {value}
        </div>
      );
    }
    return (
      <div className={cn(ROW, "items-baseline")} data-field={field.key}>
        <span className="text-xms-label text-[12px]">{field.label}</span>
        <span className="flex flex-col gap-[2px]">{value}</span>
      </div>
    );
  }
  const common = {
    id,
    disabled: pending,
    "aria-busy": pending || undefined,
    autoFocus: stacked && editing ? true : undefined,
  };
  let control;
  if (field.kind === "select") {
    control = (
      <select
        {...common}
        value={draft}
        onChange={(event) => void commit(event.target.value)}
        onBlur={() => setEditing(false)}
        className={CONTROL}
      >
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
        onBlur={() => {
          setEditing(false);
          void commit(draft);
        }}
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
        onBlur={() => {
          setEditing(false);
          void commit(draft);
        }}
        className={cn(CONTROL, field.mono && "xms-mono")}
      />
    );
  }
  if (stacked) {
    const text = readOnlyText(field);
    return (
      <div className={STACK_ROW} data-field={field.key}>
        <label htmlFor={id} className="text-xms-label text-[12px]">
          {field.label}
        </label>
        {editing ? (
          control
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={cn(
              "hover:bg-xms-row-hover -mx-1 rounded-[4px] px-1 py-[1px] text-left text-[13px] font-medium",
              text ? "text-xms-ink" : "text-xms-muted font-normal",
              field.mono && "xms-mono",
            )}
          >
            {text || "Not set"}
          </button>
        )}
        {field.hint ? <span className="text-xms-label text-[12px]">{field.hint}</span> : null}
      </div>
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
export function RecordForm({ fields, onCommit, onRollback, columns = 2, layout = "rows", className }: RecordFormProps) {
  if (layout === "stacked") {
    return (
      <div className={cn("flex flex-col", className)}>
        {fields.map((field) => (
          <Field key={field.key} field={field} onCommit={onCommit} onRollback={onRollback} layout="stacked" />
        ))}
      </div>
    );
  }
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
