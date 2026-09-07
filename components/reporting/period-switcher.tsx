"use client";

import { PERIODS } from "@/components/reporting/format";
import { cn } from "@/lib/utils";

export interface PeriodSwitcherProps {
  value: number;
  onChange: (days: number) => void;
  className?: string;
}

/** Pill group for the dashboard window: 7, 30 or 90 days (snapshot measures follow the window). */
export function PeriodSwitcher({ value, onChange, className }: PeriodSwitcherProps) {
  return (
    <div role="radiogroup" aria-label="Period" className={cn("inline-flex items-center gap-1", className)}>
      {PERIODS.map((period) => {
        const active = period.days === value;
        return (
          <button
            key={period.days}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(period.days)}
            className={cn(
              "h-[28px] rounded-[999px] border px-3 text-[12px] font-medium",
              active
                ? "border-xms-accent text-xms-accent bg-xms-tint"
                : "border-xms-line text-xms-body bg-xms-card hover:bg-xms-tint",
            )}
          >
            {period.label}
          </button>
        );
      })}
    </div>
  );
}
