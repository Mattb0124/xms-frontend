import { cn } from "@/lib/utils";

export type RampState = "new" | "in-progress" | "awaiting-client" | "awaiting-approval" | "resolved" | "closed";

/** Maps a state machine state to the six-step v3 ramp. Unknown states fall to the closed grey. */
export function rampFor(state: string): RampState {
  const slug = state.toLowerCase().replace(/[\s_]+/g, "-");
  switch (slug) {
    case "new":
      return "new";
    case "assigned":
    case "triage":
    case "in-progress":
    case "investigating":
    case "implementing":
    case "planned":
    case "scheduled":
    case "validation":
      return "in-progress";
    case "awaiting-client":
    case "awaiting-third-party":
    case "blocked":
      return "awaiting-client";
    case "assessment":
    case "approved":
    case "awaiting-approval":
    case "known-error":
      return "awaiting-approval";
    case "resolved":
    case "fulfilled":
    case "completed":
    case "done":
      return "resolved";
    default:
      return "closed";
  }
}

export function stateLabel(state: string): string {
  const words = state.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
}

export interface StatePillProps {
  state: string;
  label?: string;
  className?: string;
}

/** Ticket state pill on the v3 state ramp; never used for SLA or priority. */
export function StatePill({ state, label, className }: StatePillProps) {
  return (
    <span className={cn("xms-state", className)} data-state={rampFor(state)}>
      {label ?? stateLabel(state)}
    </span>
  );
}
