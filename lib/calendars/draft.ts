import type { BusinessCalendar, CalendarHours, CreateCalendarBody, PatchCalendarBody } from "@/redux/calendarsApi";

/**
 * The calendar editor's fields (Accounts & Administration functional 5.7),
 * named as the API names them. The week grid is held beside them, because it
 * is sent as minutes rather than as typed.
 */
export interface CalendarDraft {
  name: string;
  time_zone: string;
  /** Empty for no holiday library. */
  holiday_calendar_id: string;
  /** Only a new calendar takes one; empty leaves it out of the body. */
  effective_from: string;
  make_default: boolean;
}

export function draftFromCalendar(calendar?: BusinessCalendar): CalendarDraft {
  return {
    name: calendar?.name ?? "",
    time_zone: calendar?.time_zone ?? "UTC",
    holiday_calendar_id: calendar?.holiday_calendar_id ?? "",
    effective_from: "",
    make_default: calendar?.is_default ?? false,
  };
}

function sameHours(a: CalendarHours[], b: CalendarHours[]): boolean {
  const key = (rows: CalendarHours[]) =>
    rows
      .map((row) => `${row.weekday}:${row.start_minute}-${row.end_minute}`)
      .sort()
      .join(",");
  return key(a) === key(b);
}

/** The PATCH body: only what changed against the loaded calendar, plus the version. */
export function calendarPatch(
  calendar: BusinessCalendar,
  draft: Omit<CalendarDraft, "effective_from">,
  hours: CalendarHours[],
): PatchCalendarBody {
  const body: PatchCalendarBody = { version: calendar.version };
  if (draft.name.trim() !== calendar.name && draft.name.trim() !== "") body.name = draft.name.trim();
  if (draft.time_zone.trim() !== calendar.time_zone && draft.time_zone.trim() !== "")
    body.time_zone = draft.time_zone.trim();
  if ((draft.holiday_calendar_id || null) !== calendar.holiday_calendar_id)
    body.holiday_calendar_id = draft.holiday_calendar_id || null;
  if (!sameHours(hours, calendar.hours)) body.hours = hours;
  if (draft.make_default && !calendar.is_default) body.make_default = true;
  return body;
}

/** The POST body for a new calendar: each optional field only when it is set. */
export function calendarBody(draft: CalendarDraft, hours: CalendarHours[]): CreateCalendarBody {
  return {
    name: draft.name.trim(),
    time_zone: draft.time_zone.trim(),
    holiday_calendar_id: draft.holiday_calendar_id || undefined,
    effective_from: draft.effective_from || undefined,
    hours,
    make_default: draft.make_default || undefined,
  };
}
