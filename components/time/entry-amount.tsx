import { SignalPill } from "@/components/xms/signal-pill";
import { formatMoney } from "@/lib/time/budget";
import { cn } from "@/lib/utils";
import type { TimeEntry } from "@/redux/timeApi";

/**
 * The money an entry carries (TB-05): the amount to the cent and the rate
 * frozen when it was logged, small and right-aligned, nothing when the
 * entry saved unrated. The currency is the contract's and is not on the
 * row, so the figures stand alone here.
 */
export function EntryAmount({
  entry,
  className,
}: {
  entry: Pick<TimeEntry, "amount" | "rate_snapshot">;
  className?: string;
}) {
  if (entry.amount === null && entry.rate_snapshot === null) return null;
  return (
    <span
      className={cn("xms-mono inline-flex flex-col items-end text-[11px] leading-tight", className)}
      data-amount={entry.amount ?? ""}
    >
      <span className="text-xms-ink">{formatMoney(entry.amount) ?? "n/a"}</span>
      {entry.rate_snapshot !== null ? (
        <span className="text-xms-label" data-rate-snapshot={entry.rate_snapshot}>
          at {formatMoney(entry.rate_snapshot)}/h
        </span>
      ) : null}
    </span>
  );
}

/** The over-budget flag (TB-11) on an entry that took the period past its available minutes. */
export function OverBudgetPill({ entry }: { entry: Pick<TimeEntry, "over_budget"> }) {
  if (!entry.over_budget) return null;
  return <SignalPill tone="overdue" label="Over budget" title="This entry took the period past its budget" />;
}
