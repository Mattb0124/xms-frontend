import type { SignalTone } from "@/components/xms/signal-pill";
import { apiError, describeError, type ApiError } from "@/lib/admin/api-error";
import { monthEnd, monthLabel, monthStart } from "@/lib/capacity/vocab";
import type { BillingAction, BillingPeriod, BillingStatus, CreateBillingPeriodBody } from "@/redux/timeApi";

/**
 * The billing period vocabulary (Time & Budget functional 5.7, TB-14): the
 * five states, the four moves the desk can make with the permission each
 * needs (the server holds the same table), and the refusals in words.
 */
export const BILLING_STATUS: Record<BillingStatus, { label: string; tone: SignalTone }> = {
  open: { label: "Open", tone: "ready" },
  submitted: { label: "Submitted", tone: "needs-input" },
  approved: { label: "Approved", tone: "complete" },
  locked: { label: "Locked", tone: "blocked" },
  exported: { label: "Exported", tone: "complete" },
};

export interface BillingTransition {
  from: BillingStatus[];
  to: BillingStatus;
  permission: string;
  label: string;
}

export const BILLING_TRANSITIONS: Record<BillingAction, BillingTransition> = {
  submit: { from: ["open"], to: "submitted", permission: "contracts:manage", label: "Submit" },
  reopen: { from: ["submitted"], to: "open", permission: "contracts:manage", label: "Reopen" },
  approve: { from: ["submitted"], to: "approved", permission: "time:lock-period", label: "Approve" },
  lock: { from: ["open", "submitted", "approved"], to: "locked", permission: "time:lock-period", label: "Lock" },
};

export const BILLING_ACTIONS: BillingAction[] = ["submit", "reopen", "approve", "lock"];

/** The moves this status allows that the viewer may make, in the table's order. */
export function allowedActions(status: BillingStatus, hasPermission: (key: string) => boolean): BillingAction[] {
  return BILLING_ACTIONS.filter(
    (action) => BILLING_TRANSITIONS[action].from.includes(status) && hasPermission(BILLING_TRANSITIONS[action].permission),
  );
}

/** The finance file exists for a locked or exported period only. */
export function canExport(status: BillingStatus): boolean {
  return status === "locked" || status === "exported";
}

/** One billing period per calendar month: the month's first and last day. */
export function billingPeriodBody(month: string): CreateBillingPeriodBody {
  return { starts_on: monthStart(month), ends_on: monthEnd(month) };
}

/** "September 2026" for a whole month, else the range. */
export function periodLabel(period: Pick<BillingPeriod, "starts_on" | "ends_on">): string {
  const month = period.starts_on.slice(0, 7);
  if (period.starts_on === monthStart(month) && period.ends_on === monthEnd(month)) return monthLabel(month);
  return `${period.starts_on} to ${period.ends_on}`;
}

/** The first twelve characters of a SHA-256, enough to compare by eye. */
export function checksumPrefix(checksum: string | null): string {
  return checksum ? checksum.slice(0, 12) : "";
}

export interface BillingError extends ApiError {
  /** invalid_transition and period_not_locked carry the period's status. */
  periodStatus?: BillingStatus;
  /** invalid_transition carries the actions the status allows. */
  allowed?: string[];
}

export function billingError(error: unknown): BillingError {
  const parsed = apiError(error) as BillingError;
  const data = (error as { data?: Record<string, unknown> })?.data;
  if (data && typeof data === "object") {
    if (typeof data.status === "string") parsed.periodStatus = data.status as BillingStatus;
    if (Array.isArray(data.allowed)) parsed.allowed = data.allowed.map(String);
  }
  return parsed;
}

function joinOr(words: string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} or ${words[words.length - 1]}`;
}

export function describeBillingError(error: BillingError): string {
  switch (error.code) {
    case "invalid_transition": {
      const status = error.periodStatus ? BILLING_STATUS[error.periodStatus]?.label.toLowerCase() : undefined;
      const moves = (error.allowed ?? [])
        .filter((action): action is BillingAction => action in BILLING_TRANSITIONS)
        .map((action) => BILLING_TRANSITIONS[action].label.toLowerCase());
      const head = status ? `This period is ${status}` : "This period has moved on";
      return moves.length > 0
        ? `${head}; from here it can only be ${joinOr(moves)}. The list has been reloaded.`
        : `${head} and cannot be moved from here. The list has been reloaded.`;
    }
    case "stale_version":
      return "Someone else changed this period. It has been reloaded.";
    case "period_not_locked":
      return "The finance file is produced once the period is locked.";
    default:
      return describeError(error);
  }
}
