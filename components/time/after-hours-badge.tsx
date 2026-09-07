import { SignalPill, type SignalTone } from "@/components/xms/signal-pill";
import {
  AFTER_HOURS_CLASS_LABEL,
  describeHandling,
  formatMultiplier,
  hasPremium,
  type HandlingRule,
} from "@/lib/time/after-hours";
import type { TimeEntry } from "@/redux/timeApi";

const TONE: Record<Exclude<TimeEntry["after_hours_class"], "standard">, SignalTone> = {
  after_hours: "needs-input",
  weekend: "needs-input",
  holiday: "blocked",
};

export interface AfterHoursBadgeProps {
  entry: Pick<TimeEntry, "after_hours_class" | "rate_multiplier">;
  /** The contract's handling, when the screen knows the contract; the explanation is derived from it. */
  rule?: HandlingRule | null;
  className?: string;
}

/**
 * The after-hours badge on an entry (Time & Budget functional 5.2, TB-13):
 * the class the calendar derived (After hours, Weekend, Holiday), the
 * contract's handling in words ("Premium 1.5x per contract" or "Comp time",
 * nothing under `none`), and the multiplier the entry carried when it is
 * not 1. Renders nothing for a standard entry.
 */
export function AfterHoursBadge({ entry, rule, className }: AfterHoursBadgeProps) {
  if (entry.after_hours_class === "standard") return null;
  const explanation = describeHandling(rule);
  const premium = hasPremium(entry);
  return (
    <span
      className={className ?? "inline-flex items-center gap-1.5"}
      data-after-hours={entry.after_hours_class}
      data-multiplier={entry.rate_multiplier}
    >
      <SignalPill
        tone={TONE[entry.after_hours_class]}
        label={AFTER_HOURS_CLASS_LABEL[entry.after_hours_class]}
        title={explanation ?? undefined}
      />
      {explanation ? (
        <span className="text-xms-label text-[11px]" data-handling>
          {explanation}
        </span>
      ) : null}
      {premium ? (
        <span className="xms-mono text-xms-ink text-[11px]" data-rate>
          {formatMultiplier(entry.rate_multiplier)}
        </span>
      ) : null}
    </span>
  );
}
