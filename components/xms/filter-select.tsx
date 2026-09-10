"use client";

import type { ReactNode } from "react";
import { ICON, ChevronDownIcon } from "@/components/xms/icons";
import { cn } from "@/lib/utils";

export interface FilterSelectOption {
  value: string;
  label: string;
}

/**
 * The one control every dimension on the grey strip is drawn with, and the
 * one the filter builder's rows use too.
 *
 * A bare `<select>` takes the platform's own height, padding and chevron, so
 * the strip read as a row of browser widgets rather than as the reference's
 * 32px controls. This draws the control and lays a transparent native select
 * over it, which keeps the real menu, the keyboard and the form semantics and
 * gives the render's geometry: 32px tall, the 4px control radius, a 1px
 * `--xms-control-line` edge, 13px text with the label in `--xms-label` and
 * the value in ink, and a 13px chevron. The primary one (Show) inks its
 * value, its chevron and its edge in the link colour.
 *
 * A card toolbar takes `size="lg"`, which is the hand-off's 38px.
 */
export function StripSelect({
  label,
  ariaLabel,
  value,
  onChange,
  primary,
  size = "sm",
  display,
  className,
  children,
}: {
  /** The dimension, spoken before the value: "Account:". Omitted on a bare control. */
  label?: string;
  /** Names the control for assistive technology where no label is drawn. */
  ariaLabel?: string;
  value: string;
  onChange: (value: string) => void;
  primary?: boolean;
  size?: "sm" | "lg";
  /** What the closed control reads; defaults to the selected option's own text. */
  display: string;
  className?: string;
  /** The `<option>` and `<optgroup>` elements of the real menu. */
  children: ReactNode;
}) {
  const active = Boolean(primary) || value !== "";
  return (
    <span
      data-testid={label ? `filter-${label.toLowerCase()}` : undefined}
      data-active={active ? "true" : undefined}
      className={cn(
        "xms-field bg-xms-card relative inline-flex shrink-0 items-center gap-[7px] rounded-[var(--xms-radius-control)] border pr-[9px] pl-[11px] text-[13px] whitespace-nowrap",
        size === "lg" ? "h-[var(--xms-control-h-lg)]" : "h-[var(--xms-header-pill-h)]",
        // One ink per control: the quiet one is ink on an ink edge, the
        // active one is blue on a blue edge, the label and the chevron with
        // it. It read as a grey label over an ink value on a grey edge, which
        // is three inks saying one thing.
        active ? "border-xms-accent" : "border-xms-ink",
        className,
      )}
    >
      <span
        className={cn(
          "pointer-events-none flex min-w-0 items-center gap-1",
          primary && "font-medium",
          active ? "text-xms-accent" : "text-xms-ink",
        )}
      >
        {label ? <span>{label}:</span> : null}
        <span className="truncate">{display}</span>
      </span>
      <ChevronDownIcon
        size={ICON.glyph}
        className={cn("pointer-events-none shrink-0", active ? "text-xms-accent" : "text-xms-ink")}
      />
      <select
        aria-label={ariaLabel ?? label ?? display}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {children}
      </select>
    </span>
  );
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
  /** Appended to the primary value in brackets: "Show: All open (26)". */
  count?: number;
  className?: string;
}

/**
 * A standing dimension on the grey tool strip.
 *
 * The reviewer's own reference for the filter row
 * (`01-architecture/wireframes/v3/refs/filter-builder.png`) draws these as
 * controls with a value and a chevron and no clear mark: the dimension reads
 * "Account: all" until it carries a value and "Account: all" again the moment
 * it is set back, so setting it back to all is what removes the criterion.
 * That replaces the pill-with-a-cross render 01 draws.
 */
export function FilterSelect({ label, value, options, onChange, primary, count, className }: FilterSelectProps) {
  const chosen = options.find((option) => option.value === value);
  const suffix = count === undefined ? "" : ` (${count})`;
  return (
    <StripSelect
      label={label}
      value={value}
      onChange={onChange}
      primary={primary}
      display={`${chosen?.label ?? "all"}${suffix}`}
      className={className}
    >
      <option value="">{`${label}: all`}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {`${label}: ${option.label}`}
        </option>
      ))}
    </StripSelect>
  );
}
