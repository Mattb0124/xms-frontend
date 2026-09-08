"use client";

import { PERIODS } from "@/components/reporting/format";
import { StripSelect } from "@/components/xms/filter-select";

export interface PeriodSwitcherProps {
  value: number;
  onChange: (days: number) => void;
  className?: string;
}

/**
 * The dashboard window on the grey tool strip: 7, 30 or 90 days (the snapshot
 * measures follow the window).
 *
 * Render 10 draws it as the strip's primary dimension, a 32px control in the
 * link colour with a chevron ("This month v"), which is the control every
 * other screen's primary dimension takes. It had been a group of three 28px
 * radio pills, so the four screens with a period carried a control shape no
 * other screen has.
 */
export function PeriodSwitcher({ value, onChange, className }: PeriodSwitcherProps) {
  const chosen = PERIODS.find((period) => period.days === value);
  return (
    <StripSelect
      primary
      ariaLabel="Period"
      value={String(value)}
      display={chosen?.label ?? `${value} days`}
      onChange={(next) => onChange(Number(next))}
      className={className}
    >
      {PERIODS.map((period) => (
        <option key={period.days} value={String(period.days)}>
          {period.label}
        </option>
      ))}
    </StripSelect>
  );
}
