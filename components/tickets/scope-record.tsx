"use client";

import { formatMoment } from "@/lib/format/date";
import { useScopeRecordQuery, type ScopeDecision } from "@/redux/ticketsApi";

/** What each event says, in the words a reader would use for it. */
export function scopeEventLine(row: ScopeDecision): string {
  switch (row.event) {
    case "flagged":
      return `${row.actor_name || "Somebody"} flagged this as out of scope`;
    case "withdrawn":
      return `${row.actor_name || "Somebody"} withdrew the flag`;
    case "approved":
      return row.allowance_minutes > 0
        ? `${row.actor_name || "Somebody"} approved it, with ${Math.round((row.allowance_minutes / 60) * 10) / 10} h added to the period`
        : `${row.actor_name || "Somebody"} approved it`;
    case "declined":
      return `${row.actor_name || "Somebody"} declined it`;
    default:
      return row.event;
  }
}

/**
 * The record behind the scope flag (TM-11): every raise, withdrawal and
 * decision, oldest first.
 *
 * The card above it says where the flag stands now, which is the one thing
 * the ticket row can tell you. This says how it got there, and it is worth
 * showing precisely because nothing in it can be edited: the rows are
 * append-only in the database, so a reader is looking at what happened
 * rather than at what somebody last wrote down.
 *
 * A ticket that was never flagged has no record, and the section is not
 * drawn rather than drawn empty.
 */
export function ScopeRecord({ ticketKey }: { ticketKey: string }) {
  const { data } = useScopeRecordQuery(ticketKey);
  if (!data || data.length === 0) return null;
  return (
    <div className="flex flex-col gap-2" data-testid="scope-record">
      <p className="xms-eyebrow">What happened</p>
      <ol className="flex flex-col gap-[6px]">
        {data.map((row) => (
          <li key={row.id} className="flex flex-col">
            <span className="text-xms-ink text-[14px] leading-[1.35]">{scopeEventLine(row)}</span>
            <span className="text-xms-label xms-mono text-[14px]">{formatMoment(row.at)}</span>
            {row.note ? <span className="text-xms-body text-[14px] leading-[1.35]">{row.note}</span> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
