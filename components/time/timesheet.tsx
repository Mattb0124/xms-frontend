"use client";

import { formatMinutes } from "@/components/tickets/time-tab";
import { KeyLink } from "@/components/xms/key-link";
import type { DeskCatalogs } from "@/lib/tickets/use-catalogs";
import { cn } from "@/lib/utils";
import type { TimeEntry, TimesheetDay, TimesheetWeek, TimesheetWeekDay } from "@/redux/timeApi";

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

export type DayTone = "unlogged" | "complete" | "off";

/**
 * The day highlight rule (P2.18.3): amber while a working day still has
 * unlogged minutes, muted for holidays and non-working days (nothing
 * expected), plain once the day is fully logged. The server owns the
 * numbers; this only picks the tone.
 */
export function dayTone(day: Pick<TimesheetDay, "expected_minutes" | "unlogged_minutes">): DayTone {
  if (day.expected_minutes === 0) return "off";
  return day.unlogged_minutes > 0 ? "unlogged" : "complete";
}

/** "6h of 8h" with the unlogged remainder, or the reason nothing is expected. */
export function dayStatus(day: TimesheetDay): string {
  if (day.holiday) return "Holiday";
  if (day.expected_minutes === 0) return "Not a working day";
  const base = `${formatMinutes(day.logged_minutes)} of ${formatMinutes(day.expected_minutes)}`;
  return day.unlogged_minutes > 0 ? `${base}, ${formatMinutes(day.unlogged_minutes)} unlogged` : `${base}, all logged`;
}

const WEEKDAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const TONE_ROW: Record<DayTone, string> = {
  unlogged: "bg-[color:var(--state-needs-input-bg)]",
  complete: "bg-xms-tint",
  off: "bg-xms-tint opacity-70",
};

const TONE_TEXT: Record<DayTone, string> = {
  unlogged: "text-[color:var(--state-needs-input-text)]",
  complete: "text-xms-label",
  off: "text-xms-muted",
};

/**
 * The personal timesheet (Time & Budget 5.8; P2.18.3): the week from
 * /v1/timesheets/me grouped by day with expected against logged per day,
 * the unlogged highlight, and the week total and unlogged in the header.
 */
export function Timesheet({ week, catalogs }: { week: TimesheetWeek; catalogs: DeskCatalogs }) {
  return (
    <div className="xms-card overflow-auto" data-testid="timesheet">
      <header className="border-xms-line flex h-[48px] items-center gap-3 border-b px-4">
        <span className="text-xms-ink text-[15px] font-semibold">Timesheet</span>
        <span className="xms-mono text-xms-label text-[12px]">
          {week.from} to {week.to}
        </span>
        <span className="ml-auto flex items-center gap-4 text-[12px]">
          <span className="text-xms-label">
            Week total{" "}
            <span className="xms-mono text-xms-ink font-semibold" data-testid="week-total">
              {formatMinutes(week.total_minutes)}
            </span>
          </span>
          <span className={week.unlogged_minutes > 0 ? TONE_TEXT.unlogged : TONE_TEXT.complete}>
            Unlogged{" "}
            <span className="xms-mono font-semibold" data-testid="week-unlogged">
              {formatMinutes(week.unlogged_minutes)}
            </span>
          </span>
        </span>
      </header>
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
          {week.days.map((day) => (
            <DayRows key={day.date} day={day} label={WEEKDAY[(day.weekday + 6) % 7]} catalogs={catalogs} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DayRows({ day, label, catalogs }: { day: TimesheetWeekDay; label: string; catalogs: DeskCatalogs }) {
  const tone = dayTone(day);
  return (
    <>
      <tr className={cn("border-xms-line border-b", TONE_ROW[tone])} data-day={day.date} data-tone={tone}>
        <td className="text-xms-ink px-3 py-1.5 text-[12px] font-semibold" colSpan={3}>
          {label} <span className="xms-mono text-xms-label font-normal">{day.date}</span>
        </td>
        <td className="xms-mono text-xms-ink px-3 py-1.5 text-right text-[12px] font-semibold" data-day-total>
          {day.logged_minutes > 0 ? formatMinutes(day.logged_minutes) : ""}
        </td>
        <td className={cn("px-3 text-[12px]", TONE_TEXT[tone])} data-day-status>
          {dayStatus(day)}
        </td>
      </tr>
      {day.entries.map((entry) => {
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
