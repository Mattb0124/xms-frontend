"use client";

import Link from "next/link";
import { formatMinutes } from "@/components/tickets/time-tab";
import { dayStatus, dayTone, type DayTone } from "@/components/time/timesheet";
import { cn } from "@/lib/utils";
import { useMe } from "@/redux/me";
import { useMyUnloggedQuery } from "@/redux/timeApi";

/** Today's date in the viewer's zone as YYYY-MM-DD; the calendar day the person is living in. */
export function localToday(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const TONE_VALUE: Record<DayTone, string> = {
  unlogged: "text-[color:var(--state-needs-input-text)]",
  complete: "text-[color:var(--state-complete-text)]",
  off: "text-xms-muted",
};

/**
 * "Time today" on My work (User Experience 3.1; P2.18.3): logged and
 * unlogged minutes for the current day from /v1/timesheets/me/unlogged,
 * with the way into the timesheet. Renders nothing without time:log, and
 * never asks the API in that case.
 */
export function TimeTodayCard({ today = localToday(), className }: { today?: string; className?: string }) {
  const me = useMe();
  const allowed = me.hasPermission("time:log");
  const { data, isLoading } = useMyUnloggedQuery({ from: today, to: today }, { skip: !allowed });
  if (!allowed) return null;
  const day = data?.days.find((row) => row.date === today) ?? data?.days[0];
  const tone: DayTone = day ? dayTone(day) : "off";
  return (
    <Link
      href="/time"
      className={cn(
        // The render (08) stacks this card: the caption and the figure on one
        // line, the sentence under them, the way in at the foot. It used to be
        // one row of three, which folded into four wrapping columns the moment
        // it stood in a 320px rail.
        "xms-card hover:border-xms-accent-border flex flex-col gap-2 p-4 hover:no-underline",
        className,
      )}
      data-testid="time-today"
      data-tone={day ? tone : undefined}
      aria-busy={isLoading || undefined}
    >
      <div className="flex items-baseline gap-3">
        <p className="xms-caption">Time today</p>
        <p
          className={cn(
            "xms-mono ml-auto text-[20px] leading-none font-semibold",
            day ? TONE_VALUE[tone] : "text-xms-ink",
          )}
        >
          {day ? formatMinutes(day.logged_minutes) : "…"}
        </p>
      </div>
      <div className="text-[13px]">
        {day ? (
          <>
            <p className="text-xms-ink">{dayStatus(day)}</p>
            <p className="text-xms-label text-[12px]">
              {day.unlogged_minutes > 0
                ? `${formatMinutes(day.unlogged_minutes)} still to log before the day closes.`
                : day.expected_minutes === 0
                  ? "Nothing expected today."
                  : "Nice, the day is fully logged."}
            </p>
          </>
        ) : (
          <p className="text-xms-label text-[12px]">Loading time for today.</p>
        )}
      </div>
      <span className="text-xms-accent text-[13px] font-medium">Open my timesheet</span>
    </Link>
  );
}
