"use client";

import { useState } from "react";
import { INPUT } from "@/components/admin/primitives";
import { formatMinutes } from "@/components/tickets/time-tab";
import { localToday } from "@/components/time/time-today-card";
import { Panel } from "@/components/xms/panel";
import { Skeleton } from "@/components/xms/skeleton";
import { cn } from "@/lib/utils";
import { useMe } from "@/redux/me";
import { useCompTimeQuery } from "@/redux/timeApi";

/** `days` before the given local date, as YYYY-MM-DD. */
export function daysBefore(date: string, days: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() - days * 86_400_000).toISOString().slice(0, 10);
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The comp-time report on the account record (Time & Budget 5.2, TB-13):
 * per person, the minutes and entries the calendar classed non-standard on
 * comp-time contracts over a date range. Every number is the server's.
 * Renders nothing without tickets:view and never asks the API in that case.
 */
export function CompTimePanel({ accountId, today = localToday() }: { accountId: string; today?: string }) {
  const me = useMe();
  const allowed = me.hasPermission("tickets:view");
  const [from, setFrom] = useState(() => daysBefore(today, 30));
  const [to, setTo] = useState(today);
  const valid = DATE.test(from) && DATE.test(to) && from <= to;
  const { data, isLoading, isError } = useCompTimeQuery({ accountId, from, to }, { skip: !allowed || !valid });
  if (!allowed) return null;
  return (
    <Panel
      title="Comp time"
      caption="Non-standard entries on comp-time contracts, per person"
      actions={
        <div className="flex items-center gap-2 text-[12px]" role="group" aria-label="Comp time range">
          <label className="flex items-center gap-1">
            <span className="text-xms-label">From</span>
            <input
              aria-label="Comp time from"
              type="date"
              value={from}
              max={to}
              onChange={(event) => setFrom(event.target.value)}
              className={cn(INPUT, "xms-mono h-[28px] w-[140px] text-[12px]")}
            />
          </label>
          <label className="flex items-center gap-1">
            <span className="text-xms-label">To</span>
            <input
              aria-label="Comp time to"
              type="date"
              value={to}
              min={from}
              max={today}
              onChange={(event) => setTo(event.target.value)}
              className={cn(INPUT, "xms-mono h-[28px] w-[140px] text-[12px]")}
            />
          </label>
        </div>
      }
    >
      {!valid ? <p className="text-xms-label text-[12px]">Choose a range where From is not after To.</p> : null}
      {isLoading && !data ? <Skeleton lines={3} /> : null}
      {isError ? <p className="text-xms-muted text-[12px]">The comp-time report could not be loaded.</p> : null}
      {data ? (
        <table className="w-full border-collapse text-[13px]" aria-label="Comp time by person">
          <thead>
            <tr className="border-xms-line text-xms-ink border-b text-left text-[12px] font-semibold">
              <th className="px-3 py-2">Person</th>
              <th className="px-3 py-2 text-right">Entries</th>
              <th className="px-3 py-2 text-right">Comp time</th>
            </tr>
          </thead>
          <tbody>
            {data.by_person.map((row) => (
              <tr
                key={row.person_id}
                className="border-xms-line hover:bg-xms-row-hover h-[36px] border-b"
                data-person={row.person_id}
              >
                <td className="text-xms-ink px-3">{row.person_name}</td>
                <td className="xms-mono text-xms-body px-3 text-right">{row.entries}</td>
                <td className="xms-mono text-xms-ink px-3 text-right" data-person-minutes>
                  {formatMinutes(row.minutes)}
                </td>
              </tr>
            ))}
            {data.by_person.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-xms-label px-3 py-4 text-center">
                  No comp time in this range.
                </td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr className="text-xms-ink text-[12px] font-semibold">
              <td className="px-3 py-2">Total</td>
              <td className="xms-mono px-3 py-2 text-right" data-testid="comp-time-entries">
                {data.entries.length}
              </td>
              <td className="xms-mono px-3 py-2 text-right" data-testid="comp-time-total">
                {formatMinutes(data.total_minutes)}
              </td>
            </tr>
          </tfoot>
        </table>
      ) : null}
    </Panel>
  );
}
