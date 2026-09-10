import type { SignalTone } from "@/components/xms/signal-pill";
import type { HealthBand } from "@/redux/reportingApi";

/**
 * How a health band is worded and coloured, in one place, so a portfolio row
 * and the account record it opens never disagree about what a number means.
 *
 * The label is short because it stands in a table cell; the meaning is the
 * sentence the record has room for. Colour only reinforces the word, on the
 * same signal trios every other non-state pill in the product uses.
 */
export const HEALTH_TONE: Record<HealthBand, SignalTone> = {
  green: "complete",
  amber: "needs-input",
  red: "overdue",
  unrated: "ready",
};

export const HEALTH_LABEL: Record<HealthBand, string> = {
  green: "Healthy",
  amber: "Watch",
  red: "Escalate",
  unrated: "Not rated",
};

export const HEALTH_MEANING: Record<HealthBand, string> = {
  green: "Nothing here needs a conversation.",
  amber: "One factor is dragging; the table below says which.",
  red: "This account needs an owner and a plan this week.",
  unrated: "The window holds nothing to judge yet.",
};
