"use client";

import { INPUT, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { cn } from "@/lib/utils";

export interface PairsEditorProps {
  label: string;
  leftLabel: string;
  rightLabel: string;
  pairs: Record<string, string>;
  onChange: (pairs: Record<string, string>) => void;
  readOnly?: boolean;
  /** Suggestions for the right-hand value (a datalist). */
  rightOptions?: string[];
  className?: string;
}

/**
 * Key to value rows (lookup tables, inbound and outbound state maps). Keys
 * are kept in insertion order; a renamed key keeps its value.
 */
export function PairsEditor({
  label,
  leftLabel,
  rightLabel,
  pairs,
  onChange,
  readOnly,
  rightOptions,
  className,
}: PairsEditorProps) {
  const rows = Object.entries(pairs);
  const listId = rightOptions ? `${label.replace(/\s+/g, "-").toLowerCase()}-options` : undefined;
  const update = (index: number, key: string, value: string) => {
    const next = rows.map(([k, v], i) => (i === index ? [key, value] : [k, v]));
    onChange(Object.fromEntries(next));
  };
  return (
    <div className={cn("flex flex-col gap-1", className)} data-pairs={label}>
      <table className="w-full text-[12px]" aria-label={label}>
        <thead>
          <tr className="text-xms-label text-left">
            <th className="py-1 pr-2 font-medium">{leftLabel}</th>
            <th className="py-1 pr-2 font-medium">{rightLabel}</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {rows.map(([key, value], index) => (
            <tr key={index}>
              <td className="py-1 pr-2">
                <input
                  aria-label={`${label} ${leftLabel} ${index + 1}`}
                  className={cn(INPUT, "h-[28px]")}
                  value={key}
                  disabled={readOnly}
                  onChange={(event) => update(index, event.target.value, value)}
                />
              </td>
              <td className="py-1 pr-2">
                <input
                  aria-label={`${label} ${rightLabel} ${index + 1}`}
                  className={cn(INPUT, "h-[28px]")}
                  value={value}
                  list={listId}
                  disabled={readOnly}
                  onChange={(event) => update(index, key, event.target.value)}
                />
              </td>
              <td>
                {readOnly ? null : (
                  <button
                    type="button"
                    aria-label={`Remove ${label} row ${index + 1}`}
                    className="text-xms-muted hover:text-xms-ink text-[14px] leading-none"
                    onClick={() => onChange(Object.fromEntries(rows.filter((_, i) => i !== index)))}
                  >
                    ×
                  </button>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={3} className="text-xms-muted py-1">
                No rows.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      {listId && rightOptions ? (
        <datalist id={listId}>
          {rightOptions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      ) : null}
      {readOnly ? null : (
        <div>
          <button
            type="button"
            className={cn(SECONDARY_BUTTON, "h-[26px] text-[12px]")}
            onClick={() => onChange({ ...pairs, [rows.some(([k]) => k === "") ? `key${rows.length + 1}` : ""]: "" })}
          >
            Add row
          </button>
        </div>
      )}
    </div>
  );
}
