"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useMe } from "@/redux/me";
import { useMyUnloggedQuery, type TimesheetDay } from "@/redux/timeApi";

/** Today's date in the viewer's zone as YYYY-MM-DD; the calendar day the person is living in. */
export function localToday(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * "2.5" from 150 minutes: the render (08) reads the day in decimal hours
 * ("2.5 / 7.5 h") rather than as "2h 30m", because the two figures are read
 * as a fraction of one another and not as two durations.
 */
export function decimalHours(minutes: number): string {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

/** The share of the day's expectation that is logged, 0 to 100. */
export function loggedPercent(day: Pick<TimesheetDay, "expected_minutes" | "logged_minutes">): number {
  if (day.expected_minutes <= 0) return day.logged_minutes > 0 ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round((day.logged_minutes / day.expected_minutes) * 100)));
}

/**
 * "Time today" on My work (render 08, User Experience 3.1, P2.18.3): the
 * title with the day as a fraction in mono on the right, a meter under it,
 * and the unlogged nudge with Log now and Not now.
 *
 * The nudge says what the server counted and nothing more. The render's own
 * copy names a window and a likely ticket ("Unlogged 11:00 to 13:30, likely
 * CS0001204"); `/v1/timesheets/me/unlogged` answers in minutes per day with
 * no gaps and no candidate, so the sentence carries the minutes, and the
 * window and the suggestion arrive when the API does. Nothing here is
 * inferred in the browser.
 *
 * Renders nothing without time:log, and never asks the API in that case.
 */
export function TimeTodayCard({ today = localToday(), className }: { today?: string; className?: string }) {
  const me = useMe();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const allowed = me.hasPermission("time:log");
  const { data, isLoading } = useMyUnloggedQuery({ from: today, to: today }, { skip: !allowed });
  if (!allowed) return null;
  const day = data?.days.find((row) => row.date === today) ?? data?.days[0];
  const percent = day ? loggedPercent(day) : 0;
  const nudge = Boolean(day && day.unlogged_minutes > 0 && !dismissed);
  return (
    <section className={cn("xms-card p-4", className)} aria-label="Time today" aria-busy={isLoading || undefined}>
      <div className="flex items-baseline gap-2">
        <h2 className="text-xms-ink text-[14px] leading-[1.3] font-semibold">Time today</h2>
        <span className="xms-mono text-xms-label ml-auto text-[13px] leading-none font-medium" data-testid="time-today">
          {day ? `${decimalHours(day.logged_minutes)} / ${decimalHours(day.expected_minutes)} h` : "…"}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Logged against the day's expectation"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="bg-xms-line-row mt-3 mb-[14px] h-2 overflow-hidden rounded-[999px]"
      >
        <div className="bg-xms-accent h-2" style={{ width: `${percent}%` }} />
      </div>
      {nudge && day ? (
        <div className="xms-note p-[13px]" data-testid="unlogged-nudge">
          <p className="text-[13px] leading-[1.55]">
            {`${decimalHours(day.unlogged_minutes)} h is unlogged today, of ${decimalHours(day.expected_minutes)} h expected.`}
          </p>
          <div className="mt-[11px] flex gap-2">
            <button
              type="button"
              onClick={() => router.push("/time")}
              className="bg-xms-note-action rounded-[var(--xms-radius-control)] px-[13px] py-[9px] text-[12px] font-semibold whitespace-nowrap text-white"
            >
              Log now
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="border-xms-line-strong bg-xms-card text-xms-body rounded-[var(--xms-radius-control)] border px-[13px] py-[9px] text-[12px] font-medium whitespace-nowrap"
            >
              Not now
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xms-muted text-[13px] leading-[1.55]">
          {day
            ? day.expected_minutes === 0
              ? "Nothing is expected today."
              : "The day is fully logged."
            : "Reading today's time."}
        </p>
      )}
    </section>
  );
}
