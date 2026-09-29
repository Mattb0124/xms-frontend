"use client";

import { useEffect, useState } from "react";
import { MeterBar } from "@/components/xms/meter-bar";
import { clockDisplay, formatMinutes, localRemainingMinutes, type ClockView, type TicketSla } from "@/lib/tickets/sla";
import { cn } from "@/lib/utils";

export type SlaStage = "In progress" | "Paused" | "Breached" | "Met";

/** One row of the SLAs related list: one clock, read the way ServiceNow's SLA list reads its rows. */
export interface SlaRow {
  kind: ClockView["kind"];
  definition: string;
  stage: SlaStage;
  elapsedMinutes: number;
  /**
   * Elapsed over target, not clamped: ServiceNow prints "1,483.72%" on a clock
   * long past due, and a reader looking for how far past due is answered by
   * the number rather than by a bar stuck at full.
   */
  percent: number;
  leftMinutes: number;
  pausedMinutes: number;
  breached: boolean;
  met: boolean;
  paused: boolean;
  dueAt: string;
  metAt: string | null;
}

/**
 * The rows for a ticket's clocks. Every due time, pause and target is the
 * server's; the only thing counted here is the minutes since the record was
 * fetched, the same countdown the chips and the meters run (the server is the
 * only author of SLA truth; the browser renders and counts down).
 */
export function slaRows(
  sla: TicketSla,
  fetchedAt: Date,
  now: Date,
  metAt?: { response?: string | null; resolution?: string | null },
): SlaRow[] {
  const clocks = [sla.response, sla.resolution].filter((clock): clock is ClockView => Boolean(clock));
  return clocks.map((clock) => {
    const remaining = localRemainingMinutes(clock, fetchedAt, now);
    const elapsed = clock.targetMinutes - remaining;
    // The same signal the record bar's chip uses: the server's latch, or a
    // due time now behind us. `clock.breached` alone is not set on every
    // clock that is past due, since the sweep that latches it runs behind.
    const breached = clock.breached || clockDisplay(clock, now).tone === "breach";
    const stage: SlaStage = clock.met ? "Met" : breached ? "Breached" : clock.paused ? "Paused" : "In progress";
    return {
      kind: clock.kind,
      definition: clock.kind === "response" ? "Response" : "Resolution",
      stage,
      elapsedMinutes: Math.max(0, elapsed),
      percent: clock.targetMinutes > 0 ? (Math.max(0, elapsed) / clock.targetMinutes) * 100 : 0,
      leftMinutes: Math.max(0, remaining),
      pausedMinutes: clock.pausedTotalMinutes,
      breached: !clock.met && breached,
      met: clock.met,
      paused: clock.paused,
      dueAt: clock.dueAt,
      metAt: metAt?.[clock.kind] ?? null,
    };
  });
}

/**
 * The due instant with its date: a clock sixty days past due is not told by
 * a wall time alone, and the record bar already says how far past it is.
 */
export function dueLabel(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return at.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

const percentLabel = (percent: number): string => `${percent.toLocaleString(undefined, { maximumFractionDigits: 0 })}%`;

const HEAD = "text-xms-label px-2 py-[9px] text-left text-body font-medium";
const CELL = "px-2 py-[9px] align-middle";

/**
 * The SLAs related list, the first tab under the case as it is in ServiceNow:
 * one row per clock with its definition, stage, elapsed time and share, time
 * left, pause total, whether it breached and when it is due. A 30 s tick
 * moves the countdown, as the meters did in the rail.
 */
export function SlaTable({
  sla,
  fetchedAt,
  pausedReason,
  metAt,
}: {
  sla: TicketSla;
  fetchedAt?: Date;
  /** The ticket's own paused state, named in the Paused stage. */
  pausedReason?: string;
  /** When each clock stopped: the ticket's first_response_at and resolved_at. */
  metAt?: { response?: string | null; resolution?: string | null };
}) {
  const [now, setNow] = useState(() => new Date());
  const base = fetchedAt ?? now;
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const rows = slaRows(sla, base, now, metAt);
  if (rows.length === 0) return <p className="text-xms-muted text-body">No SLA on this ticket.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-body" aria-label="Service levels">
        <thead>
          <tr className="border-xms-line border-b">
            <th className={HEAD}>SLA definition</th>
            <th className={HEAD}>Stage</th>
            <th className={HEAD}>Elapsed</th>
            <th className={HEAD}>Elapsed percentage</th>
            <th className={HEAD}>Time left</th>
            <th className={HEAD}>Paused</th>
            <th className={HEAD}>Breached</th>
            <th className={HEAD}>Due</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.kind} className="border-xms-line-row hover:bg-xms-row-hover border-b" data-clock={row.kind}>
              <td className={cn(CELL, "text-xms-ink font-medium")}>{row.definition}</td>
              <td
                className={cn(
                  CELL,
                  row.stage === "Breached" && "font-semibold text-[color:var(--state-overdue-text)]",
                  row.stage === "Met" && "text-[color:var(--state-complete-text)]",
                )}
                data-stage={row.stage}
              >
                {row.stage}
                {row.stage === "Paused" && pausedReason ? (
                  <span className="text-xms-label"> · {pausedReason.toLowerCase()}</span>
                ) : null}
                {row.stage === "Met" && row.metAt ? (
                  <span className="text-xms-label"> · {dueLabel(row.metAt)}</span>
                ) : null}
              </td>
              <td className={cn(CELL, "xms-mono")}>{formatMinutes(row.elapsedMinutes)}</td>
              <td className={CELL}>
                <span className="flex items-center gap-2">
                  <span className="xms-mono w-[56px] shrink-0 text-right">{percentLabel(row.percent)}</span>
                  <span className="w-[120px] shrink-0">
                    <MeterBar
                      percent={Math.min(100, row.percent)}
                      met={row.met}
                      breached={row.breached}
                      paused={row.paused}
                    />
                  </span>
                </span>
              </td>
              <td className={cn(CELL, "xms-mono")}>{row.met ? "" : formatMinutes(row.leftMinutes)}</td>
              <td className={cn(CELL, "xms-mono")}>{formatMinutes(row.pausedMinutes)}</td>
              <td className={CELL}>{row.breached ? "Yes" : "No"}</td>
              <td className={cn(CELL, "xms-mono")}>{dueLabel(row.dueAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
