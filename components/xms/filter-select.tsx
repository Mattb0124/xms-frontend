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
        "bg-xms-card inline-flex h-[30px] shrink-0 items-center rounded-[999px] border pr-1 pl-3",
        primary ? "border-xms-accent" : active ? "border-xms-accent-border" : "border-xms-line",
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
      {!primary && active ? (
        <button
          type="button"
          aria-label={`Remove the ${label.toLowerCase()} filter`}
          onClick={onClear}
          className="text-xms-muted hover:text-xms-ink hover:bg-xms-tint ml-1 flex h-[22px] w-[22px] items-center justify-center rounded-[999px]"
        >
          <CloseIcon size={12} />
        </button>
      ) : (
        // Reserved, so a pill does not change width the moment it starts
        // filtering and shove every pill beside it along the row.
        <span aria-hidden className="ml-1 h-[22px] w-[22px]" />
      )}
    </span>
  );
}
