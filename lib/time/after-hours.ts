import type { AfterHoursHandling } from "@/redux/ticketsApi";
import type { AfterHoursClass, TimeEntry } from "@/redux/timeApi";

/**
 * The after-hours vocabulary (Time & Budget functional 5.2, TB-13). The
 * server derives the class from the account calendar and applies the
 * contract's rule when the entry is logged; the browser only words it.
 */
export const AFTER_HOURS_CLASS_LABEL: Record<AfterHoursClass, string> = {
  standard: "Standard",
  after_hours: "After hours",
  weekend: "Weekend",
  holiday: "Holiday",
};

export const AFTER_HOURS_HANDLING_LABEL: Record<AfterHoursHandling, string> = {
  none: "None",
  premium_rate: "Premium rate",
  comp_time: "Comp time",
};

export const AFTER_HOURS_HANDLINGS: { value: AfterHoursHandling; label: string }[] = [
  { value: "none", label: AFTER_HOURS_HANDLING_LABEL.none },
  { value: "premium_rate", label: AFTER_HOURS_HANDLING_LABEL.premium_rate },
  { value: "comp_time", label: AFTER_HOURS_HANDLING_LABEL.comp_time },
];

/** The handling a contract carries; the multiplier is the API's numeric string ("1.500") or null. */
export interface HandlingRule {
  after_hours_handling: AfterHoursHandling;
  after_hours_multiplier: string | null;
}

/** "1.500" or 1.5 as "1.5x"; whole numbers stay whole ("2x"). */
export function formatMultiplier(value: string | number): string {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return `${value}x`;
  return `${Number(number.toFixed(3))}x`;
}

/** True when the entry carried a premium (the multiplier is not 1). */
export function hasPremium(entry: Pick<TimeEntry, "rate_multiplier">): boolean {
  const number = Number(entry.rate_multiplier);
  return Number.isFinite(number) && number !== 1;
}

/**
 * The handling rule in the spec's words: "Premium 1.5x per contract" or
 * "Comp time"; null under `none` or when the contract is not known.
 */
export function describeHandling(rule: HandlingRule | null | undefined): string | null {
  if (!rule) return null;
  switch (rule.after_hours_handling) {
    case "premium_rate":
      return rule.after_hours_multiplier
        ? `Premium ${formatMultiplier(rule.after_hours_multiplier)} per contract`
        : "Premium rate per contract";
    case "comp_time":
      return "Comp time";
    default:
      return null;
  }
}

/** "19:30:00" from the API as "19:30"; null through. */
export function startTimeLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 5);
}

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The Log time form's start time must be HH:MM, 24-hour, or empty. */
export function isStartTime(value: string): boolean {
  return HH_MM.test(value);
}
