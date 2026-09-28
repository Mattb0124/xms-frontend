/**
 * Reopen window after Resolved or Closed (Email Intake functional §5.3).
 * The server owns the dates; this module only words what it sent.
 */
export type WindowSource = "account" | "type_override";

export interface ReopenWindowView {
  readonly days: number;
  readonly source: WindowSource;
  readonly started_on: string | null;
  readonly deadline: string | null;
  readonly allowed: boolean;
  readonly reason?: string;
}

export type ReopenCause = "reply" | "transition";

export function reopenSentence(view: ReopenWindowView, cause: ReopenCause = "transition"): string {
  if (view.reason) return view.reason;
  if (view.started_on === null) return "The ticket has no resolved or closed time.";
  if (view.days <= 0) return "The reopen window is set to never.";
  if (view.allowed) {
    if (cause === "reply") {
      return `reply inside reopen window (${view.days} working days, deadline ${view.deadline}).`;
    }
    return `Reopened inside the ${view.days} working-day window (deadline ${view.deadline}).`;
  }
  return `The ${view.days} working-day reopen window ended on ${view.deadline}.`;
}

export function elapsedWindowCopy(view: Pick<ReopenWindowView, "days" | "deadline">): string {
  if (view.deadline) return `The ${view.days} working-day reopen window ended on ${view.deadline}.`;
  if (view.days <= 0) return "The reopen window is set to never.";
  return "The reopen window has ended. Open a new request if you still need help.";
}
