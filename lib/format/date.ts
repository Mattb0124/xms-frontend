/**
 * How XMS writes a date, in one place.
 *
 * `09/09/2026 05:30:29 PM`: month, day, year, then a twelve-hour clock with
 * seconds. It is what the consultants read in ServiceNow today, and the point
 * of fixing it here is that every screen writes it the same way. Before this
 * there were four spellings in the product at once: an ISO day, an ISO day
 * with a space instead of the T, a locale long month, and a bare slice.
 *
 * Two rules keep it honest:
 *
 * - A value with no time of day is written without one. A contract period
 *   starts on a day, not at a moment, and printing "12:00:00 AM" against it
 *   would be inventing precision the record does not have.
 * - It is written in the reader's own zone, because a timestamp a person is
 *   asked to recognize ("did I reply before five?") is only useful in the
 *   zone they were standing in. The zone is a parameter so tests can pin one.
 *
 * Nothing here is for computing with. An ISO day is still the right thing to
 * put in a query, a form value or a date input, and those uses are left
 * alone.
 */

/** A date with no time: "2026-09-09", or the date half of an instant. */
const DAY_ONLY = /^\d{4}-\d{2}-\d{2}$/;

interface Parts {
  month: string;
  day: string;
  year: string;
  hour: string;
  minute: string;
  second: string;
  dayPeriod: string;
}

function partsOf(date: Date, timeZone: string | undefined): Parts {
  const format = new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    ...(timeZone ? { timeZone } : {}),
  });
  const found: Record<string, string> = {};
  for (const part of format.formatToParts(date)) found[part.type] = part.value;
  return {
    month: found.month ?? "",
    day: found.day ?? "",
    year: found.year ?? "",
    hour: found.hour ?? "",
    minute: found.minute ?? "",
    second: found.second ?? "",
    // Intl gives "AM"/"PM" here, but some runtimes use a narrow no-break
    // space or a dotted form; upper-casing keeps one spelling.
    dayPeriod: (found.dayPeriod ?? "").toUpperCase().replace(/\./g, ""),
  };
}

/**
 * "09/09/2026 05:30:29 PM" from an instant, or "09/09/2026" from a value
 * that names a day and no time.
 *
 * An empty or unparseable value comes back as it went in, so a screen shows
 * whatever the server actually sent rather than "Invalid Date".
 */
export function formatMoment(value: string | null | undefined, timeZone?: string): string {
  if (!value) return "";
  if (DAY_ONLY.test(value)) return formatDay(value, timeZone);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = partsOf(date, timeZone);
  return `${parts.month}/${parts.day}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second} ${parts.dayPeriod}`;
}

/**
 * "09/09/2026" from a day, with no time invented for it.
 *
 * A bare day is read as a day rather than as midnight UTC: "2026-09-09" is
 * the ninth wherever the reader is standing, and turning it into an instant
 * first would make it the eighth for everyone west of Greenwich.
 */
export function formatDay(value: string | null | undefined, timeZone?: string): string {
  if (!value) return "";
  if (DAY_ONLY.test(value)) {
    const [year, month, day] = value.split("-");
    return `${month}/${day}/${year}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = partsOf(date, timeZone);
  return `${parts.month}/${parts.day}/${parts.year}`;
}

/** The clock alone, "05:30:29 PM", where the day is already on the row. */
export function formatTime(value: string | null | undefined, timeZone?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = partsOf(date, timeZone);
  return `${parts.hour}:${parts.minute}:${parts.second} ${parts.dayPeriod}`;
}
