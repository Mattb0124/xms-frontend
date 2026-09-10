"use client";

import { formatMinutes } from "@/components/tickets/time-tab";
import { AfterHoursBadge } from "@/components/time/after-hours-badge";
import { EntryAmount, OverBudgetPill } from "@/components/time/entry-amount";
import { KeyLink } from "@/components/xms/key-link";
import type { DeskCatalogs } from "@/lib/tickets/use-catalogs";
import { startTimeLabel } from "@/lib/time/after-hours";
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
    return {
      day,
      entries: rows,
      minutes: rows.reduce((sum, entry) => sum + (entry.adjusted_minutes ?? entry.minutes), 0),
    };
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

/**
 * The tone is an 8px signal dot and the words beside it, never a fill across
 * the row. Five amber rows and two blue ones over seven days read as banding,
 * which is the one thing the list grammar forbids; My work's clock column set
 * the house treatment for a signal carried on a value.
 */
const TONE_DOT: Record<DayTone, string> = {
  unlogged: "bg-[color:var(--state-needs-input-text)]",
  complete: "bg-[color:var(--state-complete-text)]",
  off: "bg-xms-quiet-line",
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
    <section className="xms-card flex min-w-0 flex-col" data-testid="timesheet" aria-label="Timesheet">
      {/* The card header every list screen carries: the title at 17px, the
          line that says what the card holds beside it, and the numbers on
          the right. */}
      <header className="border-xms-line flex min-h-[48px] flex-wrap items-center gap-[14px] border-b px-5 py-3">
        <span className="text-xms-ink text-[17px] leading-[1.3] font-semibold">Timesheet</span>
        <span className="xms-mono text-xms-muted -ml-[6px] text-[14px]">
          {week.from} to {week.to}
        </span>
        <span className="ml-auto flex items-center gap-4 text-[14px]">
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
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[14px]">
          <thead className="bg-xms-card sticky top-0 z-10">
            <tr className="border-xms-line-head text-xms-ink border-b text-left text-[14px] font-semibold">
              <th className="px-[14px] py-[11px]">Day</th>
              <th className="px-[14px] py-[11px]">Ticket or bucket</th>
              <th className="px-[14px] py-[11px]">Activity</th>
              <th className="px-[14px] py-[11px] text-right">Minutes</th>
              <th className="px-[14px] py-[11px] text-right">Amount</th>
              <th className="px-[14px] py-[11px]">Description</th>
            </tr>
          </thead>
          <tbody>
            {week.days.map((day) => (
              <DayRows key={day.date} day={day} label={WEEKDAY[(day.weekday + 6) % 7]} catalogs={catalogs} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DayRows({ day, label, catalogs }: { day: TimesheetWeekDay; label: string; catalogs: DeskCatalogs }) {
  const tone = dayTone(day);
  return (
    <>
      {/* Every day group stands on the same quiet ground; only the dot and
          the words beside it carry the day's signal. */}
      <tr className="border-xms-line-row bg-xms-quiet-bg border-b" data-day={day.date} data-tone={tone}>
        <td className="text-xms-ink px-[14px] py-[9px] text-[14px] font-semibold" colSpan={3}>
          {label} <span className="xms-mono text-xms-label font-normal">{day.date}</span>
        </td>
        <td className="xms-mono text-xms-ink px-[14px] py-[9px] text-right text-[14px] font-semibold" data-day-total>
          {day.logged_minutes > 0 ? formatMinutes(day.logged_minutes) : ""}
        </td>
        <td />
        <td className="px-[14px] py-[9px] text-[14px]" data-day-status>
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", TONE_DOT[tone])} />
            <span className={TONE_TEXT[tone]}>{dayStatus(day)}</span>
          </span>
        </td>
      </tr>
      {day.entries.map((entry) => {
        const key = ticketKeyOf(entry.ticket_number);
        const activity =
          catalogs.activityTypes.find((item) => item.key === entry.activity_type)?.label ?? entry.activity_type;
        const start = startTimeLabel(entry.performed_start);
        return (
          <tr key={entry.id} className="border-xms-line-row hover:bg-xms-row-hover border-b" data-entry={entry.id}>
            <td className="xms-mono text-xms-label px-[14px] py-[13px] text-right text-[14px]" data-start>
              {start ?? ""}
            </td>
            <td className="px-[14px] py-[13px]">
              {key ? (
                <KeyLink ticketKey={key} />
              ) : (
                // Non-ticket time (TB-12) is named by its bucket. An entry the
                // API answered without a label still says what it is rather
                // than reading as a bare word.
                <span className="text-xms-ink" data-bucket>
                  {entry.bucket_label ?? "Non-ticket time"}
                </span>
              )}
            </td>
            <td className="text-xms-ink px-[14px] py-[13px]">{activity}</td>
            <td className="xms-mono text-xms-ink px-[14px] py-[13px] text-right">
              {formatMinutes(entry.adjusted_minutes ?? entry.minutes)}
            </td>
            <td className="px-[14px] py-[13px] text-right">
              <EntryAmount entry={entry} />
            </td>
            <td className="text-xms-body max-w-[320px] truncate px-[14px] py-[13px]">
              <AfterHoursBadge entry={entry} className="mr-2 inline-flex items-center gap-1.5" />
              {entry.over_budget ? (
                <span className="mr-2 inline-flex" data-over-budget>
                  <OverBudgetPill entry={entry} />
                </span>
              ) : null}
              {entry.description}
            </td>
          </tr>
        );
      })}
    </>
  );
}
