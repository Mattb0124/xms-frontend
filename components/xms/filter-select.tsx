"use client";

import { ChevronDownIcon, CloseIcon } from "@/components/xms/icons";
import { cn } from "@/lib/utils";

export interface FilterSelectOption {
  value: string;
  label: string;
}

export interface FilterSelectProps {
  /** "Account", "State", "Priority", "Type" - the dimension, not the value. */
  label: string;
  /** The empty string means the dimension is unfiltered and the pill reads "all". */
  value: string;
  options: FilterSelectOption[];
  onChange: (value: string) => void;
  onClear: () => void;
  /** The primary "Show:" dimension is drawn in blue outline and never carries a clear mark. */
  primary?: boolean;
  className?: string;
}

/**
 * A standing filter pill (v3 render 01): the toolbar carries one per dimension
 * whether or not it is filtering, reading "Account: all" until a value is
 * chosen, with a chevron that opens the real menu and a clear mark that
 * appears only once the dimension is carrying a criterion.
 *
 * The URL is still the state: choosing a value writes the chip, and the clear
 * mark removes it. What changed is that an unfiltered dimension is drawn
 * rather than hidden, which is what the render shows and what makes the
 * toolbar the same shape on every visit.
 */
export function FilterSelect({ label, value, options, onChange, onClear, primary, className }: FilterSelectProps) {
  const active = value !== "";
  const shown = active ? (options.find((option) => option.value === value)?.label ?? value) : "all";
  return (
    <span
      data-testid={`filter-${label.toLowerCase()}`}
      data-active={active ? "true" : undefined}
      className={cn(
        // 4px, not a lozenge: every v3 render draws the toolbar dimensions as
        // square-cornered controls and keeps 999px for the state, priority
        // and count pills inside the list.
        "bg-xms-card inline-flex h-[var(--xms-header-pill-h)] shrink-0 items-center rounded-[var(--xms-radius-control)] border pr-1 pl-3",
        primary ? "border-xms-accent" : "border-xms-control-line",
        className,
      )}
    >
      <span className="relative inline-flex items-center">
        <span
          className={cn(
            "pointer-events-none flex items-center gap-1 pr-5 text-[13px] whitespace-nowrap",
            primary ? "text-xms-accent font-medium" : "text-xms-body",
          )}
        >
          <span className={primary ? undefined : "text-xms-label"}>{label}:</span>
          <span className="font-medium">{shown}</span>
        </span>
        <ChevronDownIcon
          size={13}
          className={cn("pointer-events-none absolute right-1", primary ? "text-xms-accent" : "text-xms-muted")}
        />
        <select
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          <option value="">{`${label}: all`}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </span>
      {/* The render draws the clear mark on every standing dimension, quiet
          while the dimension carries nothing and inked once it does, so the
          pill never changes width the moment it starts filtering. The primary
          "Show:" dimension is the one that never carries one. */}
      {primary ? (
        <span aria-hidden className="ml-1 h-[22px] w-[22px]" />
      ) : (
        <button
          type="button"
          aria-label={`Remove the ${label.toLowerCase()} filter`}
          onClick={onClear}
          disabled={!active}
          className={cn(
            "hover:bg-xms-tint ml-1 flex h-[22px] w-[22px] items-center justify-center rounded-[var(--xms-radius-control)]",
            active ? "text-xms-muted hover:text-xms-ink" : "text-xms-placeholder",
          )}
        >
          <CloseIcon size={12} />
        </button>
      )}
    </span>
  );
}
