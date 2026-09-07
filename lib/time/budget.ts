import type { OverageRule, RolloverRule } from "@/redux/ticketsApi";
import type { BudgetContractCard, BudgetForecast, BudgetThresholds } from "@/redux/timeApi";

/**
 * The budget vocabulary (Time & Budget functional 5.4 to 5.6, TB-07 to
 * TB-09, TB-11). The server computes every number; this file only words
 * them and picks the tone.
 */

/** "1.5 h", "12 h", "0 h": hours with one decimal only where the minutes are not whole hours. */
export function formatHours(minutes: number): string {
  const hours = minutes / 60;
  if (Number.isInteger(hours)) return `${hours} h`;
  return `${(Math.round(hours * 10) / 10).toFixed(1)} h`;
}

/** "USD 1,225.00" from the API's numeric string or number; "n/a" without an amount. */
export function formatAmount(value: string | number | null | undefined, currency: string): string {
  if (value === null || value === undefined || value === "") return "n/a";
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return "n/a";
  return `${currency} ${number.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export type BudgetTone = "good" | "warn" | "breach";

/**
 * The burn bar tone (5.5): red once the server says the period is over
 * its budget, amber from the first fired threshold, the accent otherwise.
 */
export function budgetTone(card: Pick<BudgetContractCard, "position" | "thresholds">): BudgetTone {
  if (!card.position) return "good";
  if (card.position.status === "over") return "breach";
  if ((card.thresholds?.fired.length ?? 0) > 0) return "warn";
  return "good";
}

/** Consumed as a share of available, 0 when there is no budget; not clamped (the bar clamps, the text does not). */
export function consumedPercent(position: Pick<BudgetContractCard, "position">["position"]): number {
  if (!position || position.available_minutes <= 0) return 0;
  return (position.consumed_minutes / position.available_minutes) * 100;
}

/**
 * The forecast sentence (5.5, TB-08), fixed so the internal and the client
 * view agree: "At the current rate of N h per business day the period ends
 * at X% of the budget; the budget runs out in D business days."
 */
export function forecastSentence(forecast: BudgetForecast, availableMinutes: number): string {
  const rate = formatHours(forecast.run_rate_minutes);
  if (availableMinutes <= 0) {
    return `At the current rate of ${rate} per business day the period ends at ${formatHours(forecast.forecast_minutes)}; this period has no budget to measure against.`;
  }
  const head = `At the current rate of ${rate} per business day the period ends at ${forecast.forecast_percent}% of the budget`;
  const days = forecast.business_days_to_exhaustion;
  if (days === null) return `${head}; the budget lasts the period.`;
  if (days === 0) return `${head}; the budget is already used up.`;
  return `${head}; the budget runs out in ${days} business day${days === 1 ? "" : "s"}.`;
}

/** "Rate over the last 5 business days; 5 of 22 business days elapsed." */
export function forecastBasis(forecast: BudgetForecast): string {
  return `Rate over the last ${forecast.window_days} business day${forecast.window_days === 1 ? "" : "s"}; ${forecast.business_days_elapsed} of ${forecast.business_days_total} business days elapsed.`;
}

export interface ThresholdMarker {
  percent: number;
  fired: boolean;
  next: boolean;
  /** When the threshold fired this period (ISO), else null. */
  firedAt: string | null;
  /** The consumed minutes at which this threshold sits. */
  atMinutes: number;
}

/** The configured thresholds in order, each with whether it fired and whether it is the next one ahead. */
export function thresholdMarkers(thresholds: BudgetThresholds, availableMinutes: number): ThresholdMarker[] {
  return [...new Set(thresholds.percents)]
    .sort((a, b) => a - b)
    .map((percent) => ({
      percent,
      fired: thresholds.fired.includes(percent),
      next: thresholds.next_percent === percent,
      firedAt: thresholds.events.find((event) => event.percent === percent)?.fired_at ?? null,
      atMinutes: Math.round((availableMinutes * percent) / 100),
    }));
}

/** "50% fired 2026-09-04", "75% next, at 30 h", "90%". */
export function thresholdLabel(marker: ThresholdMarker): string {
  if (marker.fired) return marker.firedAt ? `${marker.percent}% fired ${marker.firedAt.slice(0, 10)}` : `${marker.percent}% fired`;
  if (marker.next) return `${marker.percent}% next, at ${formatHours(marker.atMinutes)}`;
  return `${marker.percent}%`;
}

/** The note under the bar when consuming minutes carried no rate (5.9). */
export function unratedNote(minutes: number): string | null {
  if (minutes <= 0) return null;
  return `${formatHours(minutes)} in this period carry no rate; add a rate card for the roles involved before the period locks.`;
}

export const OVERAGE_RULE_LABEL: Record<OverageRule, string> = {
  block: "Block",
  allow_flag: "Allow with flag",
  allow_rate: "Allow at overage rate",
};

export const OVERAGE_RULES: { value: OverageRule; label: string }[] = [
  { value: "block", label: OVERAGE_RULE_LABEL.block },
  { value: "allow_flag", label: OVERAGE_RULE_LABEL.allow_flag },
  { value: "allow_rate", label: OVERAGE_RULE_LABEL.allow_rate },
];

export const ROLLOVER_RULE_LABEL: Record<RolloverRule, string> = {
  none: "None",
  carry_month: "Carry month",
  carry_term: "Carry term",
  cap: "Cap",
};

export const ROLLOVER_RULES: { value: RolloverRule; label: string }[] = [
  { value: "none", label: ROLLOVER_RULE_LABEL.none },
  { value: "carry_month", label: ROLLOVER_RULE_LABEL.carry_month },
  { value: "carry_term", label: ROLLOVER_RULE_LABEL.carry_term },
  { value: "cap", label: ROLLOVER_RULE_LABEL.cap },
];

/** "Overage blocked", "Overage allowed with flag", "Overage at 1.25x". */
export function describeOverage(rule: OverageRule, multiplier?: string | number | null): string {
  switch (rule) {
    case "block":
      return "Overage blocked";
    case "allow_rate":
      return multiplier ? `Overage at ${Number(multiplier)}x` : "Overage at the overage rate";
    default:
      return "Overage allowed with flag";
  }
}

/** "No rollover", "Carries a month", "Carries to term", "Carries to term, capped at 20 h". */
export function describeRollover(rule: RolloverRule, capHours?: string | number | null): string {
  switch (rule) {
    case "carry_month":
      return "Carries a month";
    case "carry_term":
      return "Carries to term";
    case "cap":
      return capHours ? `Carries to term, capped at ${Number(capHours)} h` : "Carries to term, capped";
    default:
      return "No rollover";
  }
}

/**
 * The overage_blocked refusal (TB-11) in the screen's words, from the
 * typed 409 body; null for any other error.
 */
export function overageBlockedMessage(error: unknown): string | null {
  const data =
    typeof error === "object" && error !== null && "data" in error
      ? (error as { data?: { code?: unknown; available_minutes?: unknown; consumed_minutes?: unknown } }).data
      : undefined;
  if (!data || data.code !== "overage_blocked") return null;
  const available = typeof data.available_minutes === "number" ? data.available_minutes : 0;
  const consumed = typeof data.consumed_minutes === "number" ? data.consumed_minutes : 0;
  return `This entry would take the period over its ${formatHours(available)} budget (${formatHours(consumed)} used); the contract blocks overage.`;
}
