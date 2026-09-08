/**
 * The words and widths of the core-loop funnel and the adoption table
 * (Audit & Analytics 7.1, backend c193b4b). Every figure arrives from the
 * API; nothing here recomputes one, and the drop-off in particular is the
 * server's own, never a subtraction done in the browser.
 */
import type { AdoptionRow, FunnelStep } from "@/redux/reportingApi";

/** The loop in the specification's order, with the closure the ticket row also records. */
export const FUNNEL_STEPS = [
  "opened",
  "first_response",
  "time_logged",
  "solution_linked",
  "resolved",
  "closed",
] as const;

const STEP_LABEL: Record<string, string> = {
  opened: "Opened",
  first_response: "First reply",
  time_logged: "Time logged",
  solution_linked: "Solution linked",
  resolved: "Resolved",
  closed: "Closed",
};

export function stepLabel(step: string): string {
  return STEP_LABEL[step] ?? step.replace(/_/g, " ");
}

/**
 * The drop-off under a step, in words.
 *
 * A negative drop-off is a real answer: a step is counted on its own rather
 * than as a subset of the one before, so a ticket resolved under a time
 * exemption reaches Resolved without ever reaching Time logged, and the later
 * step can hold more. Hiding that would misreport the loop, so it is said out
 * loud with the reason, and the first step has nothing before it to fall
 * from.
 */
export function dropOffLine(step: FunnelStep, index: number): string | null {
  if (index === 0) return null;
  if (step.drop_off === 0) return "None lost from the step before";
  if (step.drop_off > 0) return `${step.drop_off} fewer than the step before`;
  return `${Math.abs(step.drop_off)} more than the step before, since a ticket can reach this step without the one before it`;
}

/** The bar width for one step, against the largest step in the funnel. A zero step still shows its label. */
export function stepWidth(step: FunnelStep, steps: FunnelStep[]): number {
  const largest = Math.max(...steps.map((entry) => entry.n), 0);
  if (largest <= 0) return 0;
  return Math.round((step.n / largest) * 100);
}

/** One account's steps as a lookup, so a row can be drawn in the funnel's own order. */
export function stepsByKey(steps: FunnelStep[]): Record<string, number> {
  return Object.fromEntries(steps.map((step) => [step.step, step.n]));
}

/**
 * The role a row is reported under. The API says `unassigned` in the `none`
 * catalog for an actor holding no role, which is reported rather than dropped,
 * so the screen names it as what it is instead of printing the raw word.
 */
export function roleLabel(row: AdoptionRow): string {
  if (row.role === "unassigned") return "No role assigned";
  return row.catalog === "portal" ? `${row.role} (portal)` : row.role;
}

/** The day the role first used the action, which reaches past the window on purpose. */
export function firstUsedLabel(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}
