"use client";

import { useMemo } from "react";
import { formatMinutes } from "@/components/tickets/time-tab";
import { KeyLink } from "@/components/xms/key-link";
import type { DeskCatalogs } from "@/lib/tickets/use-catalogs";
import type { TimeEntry } from "@/redux/timeApi";

export function ticketKeyOf(number: string | null | undefined): string | null {
  if (!number) return null;
  return `CS${String(number).padStart(7, "0")}`;
}

/** Monday to Sunday containing the date, as YYYY-MM-DD strings. */
export function weekOf(date: Date): { from: string; to: string; days: string[] } {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const offset = (day.getUTCDay() + 6) % 7;
  day.setUTCDate(day.getUTCDate() - offset);
  const days: string[] = [];
  for (let index = 0; index < 7; index += 1) {
    days.push(new Date(day.getTime() + index * 86_400_000).toISOString().slice(0, 10));
  }
  return { from: days[0], to: days[6], days };
}

export function shiftWeek(from: string, weeks: number): Date {
  return new Date(new Date(`${from}T00:00:00Z`).getTime() + weeks * 7 * 86_400_000);
}

export interface DayGroup {
  day: string;
  entries: TimeEntry[];
  minutes: number;
}

export function groupByDay(entries: TimeEntry[], days: string[]): DayGroup[] {
  return days.map((day) => {
    const rows = entries.filter((entry) => entry.performed_on === day);
    return { day, entries: rows, minutes: rows.reduce((sum, entry) => sum + (entry.adjusted_minutes ?? entry.minutes), 0) };
  });
}

const WEEKDAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** The personal timesheet (Time & Budget 5.8): the week grouped by day with day and week totals. */
export function Timesheet({ entries, days, catalogs }: { entries: TimeEntry[]; days: string[]; catalogs: DeskCatalogs }) {
  const groups = useMemo(() => groupByDay(entries, days), [entries, days]);
  const total = groups.reduce((sum, group) => sum + group.minutes, 0);
  return (
    <div className="xms-card overflow-auto" data-testid="timesheet">
      <table className="w-full border-collapse text-[13px]" aria-label="Timesheet">
        <thead className="bg-xms-card sticky top-0">
          <tr className="border-xms-line text-xms-ink border-b text-left text-[12px] font-semibold">
            <th className="px-3 py-2">Day</th>
            <th className="px-3 py-2">Ticket or bucket</th>
            <th className="px-3 py-2">Activity</th>
            <th className="px-3 py-2 text-right">Minutes</th>
            <th className="px-3 py-2">Description</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group, index) => (
            <GroupRows key={group.day} group={group} label={WEEKDAY[index]} catalogs={catalogs} />
          ))}
        </tbody>
        <tfoot>
          <tr className="text-xms-ink text-[12px] font-semibold">
            <td colSpan={3} className="px-3 py-2">
              Week total
            </td>
            <td className="xms-mono px-3 py-2 text-right" data-testid="week-total">
              {formatMinutes(total)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function GroupRows({ group, label, catalogs }: { group: DayGroup; label: string; catalogs: DeskCatalogs }) {
  return (
    <>
      <tr className="border-xms-line bg-xms-tint border-b" data-day={group.day}>
        <td className="text-xms-ink px-3 py-1.5 text-[12px] font-semibold" colSpan={3}>
          {label} <span className="xms-mono text-xms-label font-normal">{group.day}</span>
        </td>
        <td className="xms-mono text-xms-ink px-3 py-1.5 text-right text-[12px] font-semibold" data-day-total>
          {group.minutes > 0 ? formatMinutes(group.minutes) : ""}
        </td>
        <td className="text-xms-label px-3 text-[12px]">{group.minutes === 0 ? "Nothing logged" : ""}</td>
      </tr>
      {group.entries.map((entry) => {
        const key = ticketKeyOf(entry.ticket_number);
        const activity = catalogs.activityTypes.find((item) => item.key === entry.activity_type)?.label ?? entry.activity_type;
        return (
          <tr key={entry.id} className="border-xms-line hover:bg-xms-row-hover h-[38px] border-b" data-entry={entry.id}>
            <td />
            <td className="px-3">{key ? <KeyLink ticketKey={key} /> : <span className="text-xms-ink">{entry.bucket_label ?? "Bucket"}</span>}</td>
            <td className="text-xms-ink px-3">{activity}</td>
            <td className="xms-mono text-xms-ink px-3 text-right">{formatMinutes(entry.adjusted_minutes ?? entry.minutes)}</td>
            <td className="text-xms-body max-w-[320px] truncate px-3">{entry.description}</td>
          </tr>
        );
      })}
    </>
  );
}
