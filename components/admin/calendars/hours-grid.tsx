"use client";

import { INPUT } from "@/components/admin/primitives";
import { WEEKDAYS, type Interval, type WeekGrid } from "@/lib/calendars/hours";

export interface HoursGridProps {
  value: WeekGrid;
  onChange: (next: WeekGrid) => void;
  disabled?: boolean;
}

const TIME = `${INPUT} xms-mono h-[30px] w-[96px]`;

/**
 * The week grid: one row per weekday, Monday first, each with zero or more
 * HH:MM intervals. A day with no interval is not a working day. The
 * conversion to minutes lives in lib/calendars/hours.
 */
export function HoursGrid({ value, onChange, disabled }: HoursGridProps) {
  const update = (weekday: number, intervals: Interval[]) => onChange({ ...value, [weekday]: intervals });
  return (
    <table className="w-full border-collapse text-[14px]" aria-label="Working hours">
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
                <span className="xms-mono text-xms-muted ml-2 text-[14px]">{day.value}</span>
              </td>
              <td className="py-2">
                <div className="flex flex-wrap items-center gap-2">
                  {intervals.length === 0 ? (
                    <span className="text-xms-muted text-[14px]">Not a working day</span>
                  ) : null}
                  {intervals.map((interval, index) => (
                    <span key={index} className="inline-flex items-center gap-1">
                      <input
                        aria-label={`${day.label} interval ${index + 1} start`}
                        className={TIME}
                        placeholder="09:00"
                        value={interval.start}
                        disabled={disabled}
                        onChange={(event) =>
                          update(
                            day.value,
                            intervals.map((row, i) => (i === index ? { ...row, start: event.target.value } : row)),
                          )
                        }
                      />
                      <span className="text-xms-label text-[14px]">to</span>
                      <input
                        aria-label={`${day.label} interval ${index + 1} end`}
                        className={TIME}
                        placeholder="17:00"
                        value={interval.end}
                        disabled={disabled}
                        onChange={(event) =>
                          update(
                            day.value,
                            intervals.map((row, i) => (i === index ? { ...row, end: event.target.value } : row)),
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
                            intervals.filter((_, i) => i !== index),
                          )
                        }
                        className="text-xms-muted hover:text-xms-ink text-[14px] leading-none disabled:opacity-50"
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
                        last ? { start: last.end, end: "" } : { start: "09:00", end: "17:00" },
                      ]);
                    }}
                    className="text-xms-accent text-[14px] disabled:opacity-50"
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
