"use client";

import { cn } from "@/lib/utils";

export interface FilterSelectOption {
  value: string;
  label: string;
}

export interface FilterSelectProps {
  /** "Account", "State", "Priority", "Type" - the dimension, not the value. */
  label: string;
  /** The empty string means the dimension is unfiltered and the control reads "all". */
  value: string;
  options: FilterSelectOption[];
  onChange: (value: string) => void;
  /**
   * The primary dimension, drawn in the link colour. It is the one the reader
   * always has ("Show: All open"), so it is never removable and never quiet.
   */
  primary?: boolean;
  /** Appended to the primary label in brackets: "Show: All open (26)". */
  count?: number;
  /** Extra groups under the plain options: the server's saved views, in practice. */
  groups?: Array<{ label: string; options: FilterSelectOption[] }>;
  className?: string;
}

/**
 * The look of a select standing on the grey tool strip: 32px on the 4px
 * control radius with the strip's own edge, 13px, the platform's chevron.
 * `primary` is the link-coloured one the reader always has.
 *
 * Exported because the Queue's own "Show:" control is a select over the
 * system views and the server's saved views at once, which is more than one
 * dimension of options; it wears this rather than a class of its own.
 */
export function stripSelectClass(primary?: boolean): string {
  return cn(
    // The width is capped so a long option value cannot set it: without that
    // "State: awaiting third party" made the State control 195px wide and
    // pushed Type off the end of the strip.
    "bg-xms-card h-[var(--xms-header-pill-h)] shrink-0 cursor-pointer rounded-[var(--xms-radius-control)] border px-[9px] text-[13px]",
    primary
      ? "max-w-[220px] border-xms-accent text-xms-accent font-medium"
      : "max-w-[150px] border-xms-control-line text-xms-body hover:border-xms-accent-border",
  );
}

/**
 * A standing dimension on the grey tool strip.
 *
 * The reviewer's own reference for the filter row
 * (`01-architecture/wireframes/v3/refs/filter-builder.png`) draws these as
 * real select controls with the platform's chevron, 32px tall on the 4px
 * control radius with the strip's own edge, and with no clear mark: the
 * dimension reads "Account: all" until it carries a value and "Account: all"
 * again the moment it is set back. That replaces the pill-with-a-cross the
 * v3 render draws, and it is the reference that wins here.
 *
 * The label lives inside the option text so the control is one thing to read
 * and one thing to operate; the URL is still the state.
 */
export function FilterSelect({
  label,
  value,
  options,
  onChange,
  primary,
  count,
  groups,
  className,
}: FilterSelectProps) {
  const active = value !== "";
  const suffix = primary && count !== undefined ? ` (${count})` : "";
  return (
    <select
      data-testid={`filter-${label.toLowerCase()}`}
      data-active={active ? "true" : undefined}
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn(stripSelectClass(primary), className)}
    >
      <option value="">{`${label}: all${suffix}`}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {`${label}: ${option.label}${suffix}`}
        </option>
      ))}
      {groups?.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
