import type { ReactNode } from "react";
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
  /** The record bar puts its transition chevron inside the pill (render 02). */
  trailing?: ReactNode;
  className?: string;
}

/**
 * The mark a state is drawn with. A hollow circle has not started, a spinner
 * is running, a pause is waiting on someone else, a dotted circle waits on a
 * decision, and a tick is finished.
 */
const STATE_GLYPH: Record<RampState, string> = {
  new: "circle",
  "in-progress": "spinner",
  "awaiting-client": "pause",
  "awaiting-approval": "dot-circle",
  resolved: "check",
  closed: "check",
};

/**
 * Ticket state: a coloured mark beside plain dark text, never a filled pill.
 * The mark carries the colour and the label stays ink, so a list of thirty
 * rows reads as text rather than as thirty chips. Never used for SLA or
 * priority, which carry their own signals.
 */
export function StatePill({ state, label, trailing, className }: StatePillProps) {
  const ramp = rampFor(state);
  return (
    <span className={cn("xms-state-mark", className)} data-state={ramp}>
      <StateGlyph kind={STATE_GLYPH[ramp]} />
      <span className="xms-state-label">{label ?? stateLabel(state)}</span>
      {trailing}
    </span>
  );
}

/** The state marks, drawn on the one 24px canvas at the system's stroke. */
function StateGlyph({ kind }: { kind: string }) {
  const common = {
    width: 15,
    height: 15,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className: "shrink-0",
  };
  if (kind === "spinner")
    return (
      <svg {...common}>
        <path d="M21 12a9 9 0 1 1-6.2-8.56" />
      </svg>
    );
  if (kind === "pause")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M10 9v6M14 9v6" />
      </svg>
    );
  if (kind === "dot-circle")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
      </svg>
    );
  if (kind === "check")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="m8.5 12.2 2.4 2.4 4.6-4.9" />
      </svg>
    );
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}
