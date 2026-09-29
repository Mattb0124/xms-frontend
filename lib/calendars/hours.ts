import type { CalendarHours } from "@/redux/calendarsApi";
import { formatMoment } from "@/lib/format/date";

/**
 * The week grid's grammar (Accounts & Administration functional 5.7): per
 * weekday one or more HH:MM to HH:MM intervals, sent to the API as minutes
 * from midnight on the API's weekday numbering (0 Sunday to 6 Saturday).
 * The grid renders Monday first because that is how people read a week.
 */
export interface Interval {
  start: string;
  end: string;
}

export type WeekGrid = Record<number, Interval[]>;

export const WEEKDAYS: { value: number; label: string; short: string }[] = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
  { value: 0, label: "Sunday", short: "Sun" },
];

export function weekdayLabel(weekday: number): string {
  return WEEKDAYS.find((day) => day.value === weekday)?.label ?? `Weekday ${weekday}`;
}

/** "09:30" to 570; null when the text is not HH:MM or is out of the day. */
export function parseHHMM(text: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 24 || minutes > 59) return null;
  const total = hours * 60 + minutes;
  return total > 1440 ? null : total;
}

/** 570 to "09:30"; 1440 renders as "24:00" (the end of the day). */
export function formatHHMM(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export function emptyGrid(): WeekGrid {
  return Object.fromEntries(WEEKDAYS.map((day) => [day.value, []]));
}

/** The standard Monday to Friday 09:00 to 17:00 grid a new calendar starts from. */
export function standardGrid(start = "09:00", end = "17:00"): WeekGrid {
  const grid = emptyGrid();
  for (const weekday of [1, 2, 3, 4, 5]) grid[weekday] = [{ start, end }];
  return grid;
}

export function hoursToGrid(hours: readonly CalendarHours[]): WeekGrid {
  const grid = emptyGrid();
  for (const entry of [...hours].sort((a, b) => a.weekday - b.weekday || a.start_minute - b.start_minute)) {
    grid[entry.weekday] = [
      ...(grid[entry.weekday] ?? []),
      { start: formatHHMM(entry.start_minute), end: formatHHMM(entry.end_minute) },
    ];
  }
  return grid;
}

export interface GridConversion {
  hours: CalendarHours[];
  /** Local problems in the server's words, so the copy matches invalid_hours. */
  problems: string[];
}

/** Converts the grid to API hours and runs the same checks the server runs, so most mistakes never leave the browser. */
export function gridToHours(grid: WeekGrid): GridConversion {
  const hours: CalendarHours[] = [];
  const problems: string[] = [];
  for (const day of WEEKDAYS) {
    const intervals = grid[day.value] ?? [];
    const converted: CalendarHours[] = [];
    intervals.forEach((interval, index) => {
      const start = parseHHMM(interval.start);
      const end = parseHHMM(interval.end);
      const where = `${day.label} interval ${index + 1}`;
      if (start === null) problems.push(`${where}: start must be HH:MM`);
      if (end === null) problems.push(`${where}: end must be HH:MM`);
      if (start === null || end === null) return;
      if (end <= start) problems.push(`${where}: end must be after start`);
      converted.push({ weekday: day.value, start_minute: start, end_minute: end });
    });
    const sorted = [...converted].sort((a, b) => a.start_minute - b.start_minute);
    for (let index = 1; index < sorted.length; index += 1) {
      if (sorted[index].start_minute < sorted[index - 1].end_minute) problems.push(`${day.label}: intervals overlap`);
    }
    hours.push(...sorted);
  }
  if (hours.length === 0 && problems.length === 0) problems.push("at least one working interval is required");
  return { hours, problems };
}

/** Sums the working minutes across the week; display only. */
export function weeklyMinutes(hours: readonly CalendarHours[]): number {
  return hours.reduce((sum, entry) => sum + Math.max(0, entry.end_minute - entry.start_minute), 0);
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** The viewer's zone as the browser reports it; "UTC" when it cannot. */
export function viewerTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** "Mon 14 Sep 2026, 11:00" in the given zone; falls back to the ISO text for an unknown zone. */
export function formatInZone(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    return formatMoment(date.toISOString());
  }
}

/** A datetime-local value ("2026-09-11T16:00") to an ISO instant in the viewer's zone. */
export function localToIso(local: string): string | null {
  if (!local) return null;
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
