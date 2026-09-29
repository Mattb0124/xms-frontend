import type { AgeBucket, Ratio } from "@/redux/reportingApi";

/** Display helpers for measures; the numbers themselves come from the API unchanged. */
export function formatPercent(ratio: Ratio | undefined, options: { fraction?: boolean } = {}): string {
  if (!ratio || ratio.value === null) return "n/a";
  const percent = options.fraction ? ratio.value * 100 : ratio.value;
  return `${Math.round(percent * 10) / 10}%`;
}

export function formatHours(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "n/a";
  return `${Math.round((minutes / 60) * 10) / 10}h`;
}

export function formatPeriod(period: { start: string; end: string } | undefined): string {
  if (!period) return "";
  const day = (value: string) => value.slice(0, 10);
  return `${day(period.start)} to ${day(period.end)}`;
}

export const AGE_BUCKETS: Array<{ key: AgeBucket; label: string }> = [
  { key: "0_1d", label: "0 to 1" },
  { key: "1_3d", label: "1 to 3" },
  { key: "3_7d", label: "3 to 7" },
  { key: "7_14d", label: "7 to 14" },
  { key: "14d_plus", label: "14+" },
];

export const PERIODS: Array<{ days: number; label: string }> = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

export function isPeriod(value: number): boolean {
  return PERIODS.some((period) => period.days === value);
}
