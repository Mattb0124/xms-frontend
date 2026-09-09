import { cn } from "@/lib/utils";

export type Priority = "p1" | "p2" | "p3" | "p4";

// P1 red, P2 to P4 quiet (Wireframes section 8.1): an amber P2 read as an
// at-risk clock in a row that also carries an amber state pill.
const TRIO: Record<Priority, string | undefined> = {
  p1: "overdue",
  p2: undefined,
  p3: undefined,
  p4: undefined,
};

export interface PriorityPillProps {
  priority: Priority;
  className?: string;
}

/** The word beside each number, so a priority reads without a legend. */
const PRIORITY_LABEL: Record<Priority, string> = {
  p1: "Critical",
  p2: "High",
  p3: "Moderate",
  p4: "Low",
};

/**
 * A coloured dot beside numbered text, the same grammar as the state mark:
 * only P1 earns red, P2 is slate and P3 and P4 stay quiet, so the column
 * reads by exception rather than as a wall of chips.
 */
export function PriorityPill({ priority, className }: PriorityPillProps) {
  const trio = TRIO[priority];
  return (
    <span className={cn("xms-priority-mark", className)} data-state={trio} data-priority={priority}>
      <span aria-hidden className="xms-priority-dot" />
      <span className="xms-priority-label">
        {priority.slice(1)} - {PRIORITY_LABEL[priority]}
      </span>
    </span>
  );
}
