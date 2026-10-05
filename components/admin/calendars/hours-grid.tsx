"use client";

import { INPUT } from "@/components/admin/primitives";
import { keyed, type Keyed } from "@/lib/draft-rows";
import { WEEKDAYS, type DraftWeekGrid, type Interval } from "@/lib/calendars/hours";

export interface HoursGridProps {
  value: DraftWeekGrid;
  onChange: (next: DraftWeekGrid) => void;
  disabled?: boolean;
}

const TIME = `${INPUT} xms-mono h-[30px] w-[96px]`;

/**
 * The week grid: one row per weekday, Monday first, each with zero or more
 * HH:MM intervals. A day with no interval is not a working day. The
 * conversion to minutes lives in lib/calendars/hours.
 */
export function HoursGrid({ value, onChange, disabled }: HoursGridProps) {
  const update = (weekday: number, intervals: Keyed<Interval>[]) => onChange({ ...value, [weekday]: intervals });
  return (
    <table className="w-full border-collapse text-body" aria-label="Working hours">
      <thead>
        <tr className="border-xms-line border-b">
          <th className="text-xms-ink w-[120px] py-2 text-left font-semibold">Day</th>
          <th className="text-xms-ink py-2 text-left font-semibold">Working intervals</th>
        </tr>
      </thead>
      <tbody>
        {WEEKDAYS.map((day) => {
          const intervals = value[day.value] ?? [];
          return (
            <tr key={day.value} className="border-xms-line border-b align-top" data-weekday={day.value}>
              <td className="py-2">
                <span className="text-xms-ink">{day.label}</span>
                <span className="xms-mono text-xms-muted ml-2 text-body">{day.value}</span>
              </td>
              <td className="py-2">
                <div className="flex flex-wrap items-center gap-2">
                  {intervals.length === 0 ? <span className="text-xms-muted text-body">Not a working day</span> : null}
                  {intervals.map((interval, index) => (
                    <span key={interval.id} className="inline-flex items-center gap-1">
                      <input
                        aria-label={`${day.label} interval ${index + 1} start`}
                        className={TIME}
                        placeholder="09:00"
                        value={interval.start}
                        disabled={disabled}
                        onChange={(event) =>
                          update(
                            day.value,
                            intervals.map((row) =>
                              row.id === interval.id ? { ...row, start: event.target.value } : row,
                            ),
                          )
                        }
                      />
                      <span className="text-xms-label text-body">to</span>
                      <input
                        aria-label={`${day.label} interval ${index + 1} end`}
                        className={TIME}
                        placeholder="17:00"
                        value={interval.end}
                        disabled={disabled}
                        onChange={(event) =>
                          update(
                            day.value,
                            intervals.map((row) =>
                              row.id === interval.id ? { ...row, end: event.target.value } : row,
                            ),
                          )
                        }
                      />
                      <button
                        type="button"
                        aria-label={`Remove ${day.label} interval ${index + 1}`}
                        disabled={disabled}
                        onClick={() =>
                          update(
                            day.value,
                            intervals.filter((row) => row.id !== interval.id),
                          )
                        }
                        className="text-xms-muted hover:text-xms-ink text-body leading-none disabled:opacity-50"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      const last = intervals[intervals.length - 1];
                      update(day.value, [
                        ...intervals,
                        keyed(last ? { start: last.end, end: "" } : { start: "09:00", end: "17:00" }),
                      ]);
                    }}
                    className="text-xms-accent text-body disabled:opacity-50"
                  >
                    + {intervals.length === 0 ? "Add hours" : "Add interval"}
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
