import type { BusinessCalendar, HolidayCalendar } from "@/redux/calendarsApi";

/** Constructed calendar fixtures, shared by every test that reads one. */

/** Constructed calendar fixtures shared by the calendar tests. */
export const CALENDAR_ID = "55555555-5555-4555-8555-555555555555";

export const HOLIDAY_LIBRARY_ID = "66666666-6666-4666-8666-666666666666";

export const ACCOUNT_ID = "77777777-7777-4777-8777-777777777777";

export function aHolidayCalendar(overrides: Partial<HolidayCalendar> = {}): HolidayCalendar {
  return {
    id: HOLIDAY_LIBRARY_ID,
    country: "GB",
    name: "England and Wales 2026",
    holidays: [
      { date: "2026-12-25", label: "Christmas Day" },
      { date: "2026-12-28", label: "Boxing Day (substitute)" },
    ],
    ...overrides,
  };
}

export function aCalendar(overrides: Partial<BusinessCalendar> = {}): BusinessCalendar {
  return {
    id: CALENDAR_ID,
    account_id: ACCOUNT_ID,
    name: "UK standard hours",
    time_zone: "Europe/London",
    effective_from: "2026-01-01",
    holiday_calendar_id: HOLIDAY_LIBRARY_ID,
    status: "active",
    version: 1,
    hours: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start_minute: 8 * 60, end_minute: 18 * 60 })),
    holidays: aHolidayCalendar().holidays,
    is_default: true,
    ...overrides,
  };
}
