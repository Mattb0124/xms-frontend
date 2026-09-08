"use client";

import { StripSelect } from "@/components/xms/filter-select";
import { monthLabel, monthOptions } from "@/lib/capacity/vocab";

/**
 * The month as a dimension on the grey strip.
 *
 * The four capacity screens each carried a `<input type="month">` in a row of
 * labelled controls standing in the page body, under a strip that showed the
 * month as a pill you could not click. This is the one control every other
 * dimension in the product is drawn with, over the window `monthOptions`
 * offers.
 */
export function MonthSelect({
  label = "Month",
  month,
  onChange,
  primary,
}: {
  label?: string;
  month: string;
  onChange: (month: string) => void;
  primary?: boolean;
}) {
  return (
    <StripSelect label={label} primary={primary} value={month} onChange={onChange} display={monthLabel(month)}>
      {monthOptions(month).map((option) => (
        <option key={option} value={option}>
          {`${label}: ${monthLabel(option)}`}
        </option>
      ))}
    </StripSelect>
  );
}
