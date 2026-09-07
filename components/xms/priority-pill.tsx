import { cn } from "@/lib/utils";

export type Priority = "p1" | "p2" | "p3" | "p4";

const TRIO: Record<Priority, string | undefined> = {
  p1: "overdue",
  p2: "needs-input",
  p3: undefined,
  p4: undefined,
};

export interface PriorityPillProps {
  priority: Priority;
  className?: string;
}

/** P1 and P2 light up on the signal trios; P3 and P4 stay quiet so the column reads by exception. */
export function PriorityPill({ priority, className }: PriorityPillProps) {
  const trio = TRIO[priority];
  return (
    <span className={cn("aix-state-pill xms-mono", className)} data-state={trio} data-priority={priority}>
      {priority.toUpperCase()}
    </span>
  );
}
