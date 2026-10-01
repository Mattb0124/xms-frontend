import { apiError, describeError } from "@/lib/admin/api-error";
import { AFTER_HOURS_HANDLING_LABEL, describeHandling } from "@/lib/time/after-hours";
import { describeOverage, describeRollover } from "@/lib/time/budget";
import type { AfterHoursHandling, Contract, OverageRule, PatchContractBody, RolloverRule } from "@/redux/ticketsApi";

/**
 * A contract's rule set (TB-09, TB-11, TB-13): what each rule means, the
 * words the Contracts list shows for it, the draft the inline editor holds,
 * the checks made before the PATCH, the body it sends, and the refusals in
 * the screen's words.
 */
export const HANDLING_HELP: Record<AfterHoursHandling, string> = {
  premium_rate: "After-hours, weekend and holiday entries carry this multiplier when logged.",
  comp_time: "Non-standard entries are counted for comp time on the account's comp-time report.",
  none: "Non-standard entries are badged but carry no premium and no comp time.",
};

export const OVERAGE_HELP: Record<OverageRule, string> = {
  block: "An entry that would take the period past its budget is refused.",
  allow_flag: "The entry saves and is flagged over budget.",
  allow_rate: "The entry saves at the overage rate and this multiplier.",
};

export const ROLLOVER_HELP: Record<RolloverRule, string> = {
  none: "Unused hours expire at period end.",
  carry_month: "Unused hours carry into the next period only, then expire.",
  carry_term: "Unused hours accumulate until the contract ends.",
  cap: "Unused hours accumulate, but the carried balance never exceeds the cap.",
};

/** "Premium 1.5x per contract", "Comp time" or "None" for the list cell. */
export function handlingCell(contract: Contract): string {
  return describeHandling(contract) ?? AFTER_HOURS_HANDLING_LABEL[contract.after_hours_handling];
}

/** "Overage blocked; carries a month; thresholds 50, 75, 90, 100%" for the list cell. */
export function rulesCell(contract: Contract): string {
  const rollover = describeRollover(contract.rollover_rule, contract.rollover_cap_hours);
  const thresholds =
    contract.threshold_percents.length > 0 ? `thresholds ${contract.threshold_percents.join(", ")}%` : "no thresholds";
  return `${describeOverage(contract.overage_rule, contract.overage_multiplier)}; ${rollover.charAt(0).toLowerCase()}${rollover.slice(1)}; ${thresholds}`;
}

/** Why the draft cannot be sent yet, in the screen's words; null when it can. */
export function validateHandling(handling: AfterHoursHandling, multiplier: string): string | null {
  if (handling !== "premium_rate") return null;
  const value = Number(multiplier);
  if (multiplier.trim() === "" || !Number.isFinite(value)) return "Premium rate needs a multiplier, for example 1.5.";
  if (value < 1) return "The multiplier must be 1 or more.";
  return null;
}

/** The rule set as the editor holds it; numbers stay text until they are sent. */
export interface RulesDraft {
  /** The engagement the contract is filed under; empty for none (technical 2.1). */
  engagementId: string;
  handling: AfterHoursHandling;
  multiplier: string;
  overageRule: OverageRule;
  overageMultiplier: string;
  rolloverRule: RolloverRule;
  capHours: string;
  /** The percentages as a comma list ("50, 75, 90, 100"). */
  thresholds: string;
  notifyClient: boolean;
  forecastWindow: string;
  /** The required technology codes as a comma list ("onestream, anaplan"). */
  technologies: string;
}

function numberText(value: string | null, fallback: string): string {
  return value ? String(Number(value)) : fallback;
}

export function draftFromContract(contract: Contract): RulesDraft {
  return {
    engagementId: contract.engagement_id ?? "",
    handling: contract.after_hours_handling,
    multiplier: numberText(contract.after_hours_multiplier, "1.5"),
    overageRule: contract.overage_rule,
    overageMultiplier: numberText(contract.overage_multiplier, "1.25"),
    rolloverRule: contract.rollover_rule,
    capHours: numberText(contract.rollover_cap_hours, ""),
    thresholds: contract.threshold_percents.join(", "),
    notifyClient: contract.threshold_notify_client,
    forecastWindow: String(contract.forecast_window_days),
    technologies: contract.technology_codes.join(", "),
  };
}

const TECHNOLOGIES_PROBLEM =
  "Technology codes are lower-case letters, digits, dots, dashes and underscores, up to fifty of them, separated by commas, for example onestream, anaplan.";

const TECHNOLOGY_CODE = /^[a-z0-9][a-z0-9_.-]{0,59}$/;

/** The comma list as lower-case codes, deduplicated in the order given; null when a part is not a code the server takes. */
export function parseTechnologyCodes(text: string): string[] | null {
  const codes: string[] = [];
  for (const part of text.split(",")) {
    const code = part.trim().toLowerCase();
    if (code === "") continue;
    if (!TECHNOLOGY_CODE.test(code)) return null;
    if (!codes.includes(code)) codes.push(code);
  }
  if (codes.length > 50) return null;
  return codes;
}

const THRESHOLDS_PROBLEM =
  "Thresholds are whole percentages from 1 to 1000, up to ten of them, separated by commas, for example 50, 75, 90, 100.";

/** The comma list as percentages, deduplicated and ascending; null when a part is not a usable whole percentage. */
export function parseThresholds(text: string): number[] | null {
  const parts = text
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");
  const values: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const value = Number(part);
    if (value < 1 || value > 1000) return null;
    if (!values.includes(value)) values.push(value);
  }
  if (values.length > 10) return null;
  return values.sort((a, b) => a - b);
}

/** Why the rules cannot be sent yet, in the screen's words; null when they can. */
export function validateRules(draft: RulesDraft): string | null {
  const handling = validateHandling(draft.handling, draft.multiplier);
  if (handling) return handling;
  if (parseThresholds(draft.thresholds) === null) return THRESHOLDS_PROBLEM;
  if (draft.overageRule === "allow_rate") {
    const value = Number(draft.overageMultiplier);
    if (draft.overageMultiplier.trim() === "" || !Number.isFinite(value))
      return "Allow at overage rate needs a multiplier, for example 1.25.";
    if (value < 1) return "The overage multiplier must be 1 or more.";
  }
  if (draft.rolloverRule === "cap") {
    const value = Number(draft.capHours);
    if (draft.capHours.trim() === "" || !Number.isFinite(value) || value < 0)
      return "Cap needs the carried hours limit, for example 20.";
  }
  const window = Number(draft.forecastWindow);
  if (!Number.isInteger(window) || window < 1 || window > 90)
    return "The forecast window is a whole number of business days from 1 to 90.";
  if (parseTechnologyCodes(draft.technologies) === null) return TECHNOLOGIES_PROBLEM;
  return null;
}

/**
 * The PATCH body (TB-09, TB-11, TB-13): the whole rule set with the
 * version the screen holds; a multiplier or a cap travels only under the
 * rule that needs it (the server nulls the rest).
 */
export function rulesBody(version: number, draft: RulesDraft): PatchContractBody {
  return {
    version,
    // Explicit null files the contract under no engagement; the server takes
    // undefined as "leave it alone", which is not what an emptied picker means.
    engagement_id: draft.engagementId === "" ? null : draft.engagementId,
    after_hours_handling: draft.handling,
    ...(draft.handling === "premium_rate" ? { after_hours_multiplier: Number(draft.multiplier) } : {}),
    threshold_percents: parseThresholds(draft.thresholds) ?? [],
    threshold_notify_client: draft.notifyClient,
    overage_rule: draft.overageRule,
    ...(draft.overageRule === "allow_rate" ? { overage_multiplier: Number(draft.overageMultiplier) } : {}),
    rollover_rule: draft.rolloverRule,
    ...(draft.rolloverRule === "cap" ? { rollover_cap_hours: Number(draft.capHours) } : {}),
    forecast_window_days: Number(draft.forecastWindow),
    technology_codes: parseTechnologyCodes(draft.technologies) ?? [],
  };
}

export function describeContractError(error: unknown): string {
  const parsed = apiError(error);
  if (parsed.code === "multiplier_required") {
    const handling =
      typeof error === "object" && error !== null && "data" in error
        ? (error as { data?: { handling?: unknown } }).data?.handling
        : undefined;
    return handling === "allow_rate"
      ? "Allow at overage rate needs a multiplier, for example 1.25."
      : "Premium rate needs a multiplier, for example 1.5.";
  }
  if (parsed.code === "cap_required") return "Cap needs the carried hours limit, for example 20.";
  if (parsed.code === "stale_version") return "Someone else changed this contract. It has been reloaded.";
  if (parsed.code === "not_found") return "This contract is not on this account any more.";
  return describeError(parsed);
}
