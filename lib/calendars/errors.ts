import { apiError, describeError, type ApiError } from "@/lib/admin/api-error";

/**
 * The typed error bodies of the calendar routes (Accounts & Administration
 * technical 3.2). `invalid_hours` carries the server's problem list, one
 * line per interval, which the editor shows under the week grid.
 */
export type CalendarErrorCode = "invalid_time_zone" | "invalid_hours" | "bad_start" | "stale_version" | "not_found";

export interface CalendarError extends ApiError {
  /** invalid_time_zone echoes the rejected zone. */
  time_zone?: string;
  /** invalid_hours lists what is wrong, in the server's words. */
  problems?: string[];
  entity?: string;
}

export function calendarError(error: unknown): CalendarError {
  const parsed = apiError(error) as CalendarError;
  const data = (error as { data?: Record<string, unknown> })?.data;
  if (data && typeof data === "object") {
    if (typeof data.time_zone === "string") parsed.time_zone = data.time_zone;
    if (Array.isArray(data.problems)) parsed.problems = data.problems.map(String);
    if (typeof data.entity === "string") parsed.entity = data.entity;
  }
  return parsed;
}

export function describeCalendarError(error: CalendarError): string {
  switch (error.code) {
    case "invalid_time_zone":
      return error.time_zone
        ? `${error.time_zone} is not an IANA time zone.`
        : "The time zone must be an IANA zone such as Europe/London.";
    case "invalid_hours":
      return error.problems && error.problems.length > 0
        ? `The working hours are not valid: ${error.problems.join("; ")}.`
        : "The working hours are not valid.";
    case "bad_start":
      return "The preview start must be a valid date and time.";
    case "not_found":
      if (error.entity === "holiday_calendar") return "That holiday library does not exist.";
      if (error.entity === "calendar") return "This calendar does not exist.";
      return "Not found.";
    default:
      return describeError(error);
  }
}
