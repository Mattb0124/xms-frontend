import type { Priority } from "@/components/xms/priority-pill";
import type { Level } from "@/lib/tickets/vocab";

/**
 * The default priority matrix (Ticket Management functional 5.3), mirrored
 * from the backend seed so the New ticket form can preview the derived
 * priority before the server stamps it. The server remains the author: the
 * created ticket's priority is what the API returns, never this preview.
 */
export const PRIORITY_MATRIX: Record<Level, Record<Level, Priority>> = {
  high: { high: "p1", medium: "p2", low: "p3" },
  medium: { high: "p2", medium: "p3", low: "p4" },
  low: { high: "p3", medium: "p4", low: "p4" },
};

export const DEFAULT_PRIORITY: Priority = "p3";

export function derivePriority(
  impact: Level | "" | null | undefined,
  urgency: Level | "" | null | undefined,
): Priority {
  if (!impact || !urgency) return DEFAULT_PRIORITY;
  return PRIORITY_MATRIX[impact][urgency];
}
