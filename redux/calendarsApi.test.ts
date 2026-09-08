import { afterEach, describe, expect, it, vi } from "vitest";
import { calendarError, describeCalendarError } from "@/lib/calendars/errors";
import { calendarsApi } from "@/redux/calendarsApi";
import { makeStore } from "@/redux/store";
import { json, stubFetch } from "@/test-kit/portal";
import { aCalendar, ACCOUNT_ID, aHolidayCalendar, CALENDAR_ID, HOLIDAY_LIBRARY_ID } from "@/test-kit/calendars";

describe("calendarsApi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads the account list, one calendar and the holiday libraries", async () => {
    const calls = stubFetch({
      [`GET /v1/accounts/${ACCOUNT_ID}/calendars`]: () => json([aCalendar()]),
      [`GET /v1/calendars/${CALENDAR_ID}`]: () => json(aCalendar()),
      "GET /v1/holiday-calendars": () => json([aHolidayCalendar()]),
    });
    const store = makeStore();
    await store.dispatch(calendarsApi.endpoints.listAccountCalendars.initiate(ACCOUNT_ID)).unwrap();
    await store.dispatch(calendarsApi.endpoints.getCalendar.initiate(CALENDAR_ID)).unwrap();
    await store.dispatch(calendarsApi.endpoints.listHolidayCalendars.initiate()).unwrap();
    expect(calls.map((call) => call.key)).toEqual([
      `GET /v1/accounts/${ACCOUNT_ID}/calendars`,
      `GET /v1/calendars/${CALENDAR_ID}`,
      "GET /v1/holiday-calendars",
    ]);
  });

  it("sends create, patch, preview and the holiday library with the contract bodies", async () => {
    const calls = stubFetch({
      [`POST /v1/accounts/${ACCOUNT_ID}/calendars`]: () => json(aCalendar(), 201),
      [`PATCH /v1/calendars/${CALENDAR_ID}`]: () => json(aCalendar({ version: 2, status: "retired" })),
      [`POST /v1/calendars/${CALENDAR_ID}/preview`]: () =>
        json({
          start: "2026-09-11T16:00:00.000Z",
          minutes: 240,
          due_at: "2026-09-14T11:00:00.000Z",
          working_minutes_between: 240,
          wall_minutes_between: 4020,
          starts_in_working_time: true,
        }),
      "POST /v1/holiday-calendars": () => json(aHolidayCalendar(), 201),
    });
    const store = makeStore();
    const hours = [{ weekday: 1, start_minute: 540, end_minute: 1050 }];
    await store
      .dispatch(
        calendarsApi.endpoints.createCalendar.initiate({
          accountId: ACCOUNT_ID,
          body: {
            name: "UK standard hours",
            time_zone: "Europe/London",
            holiday_calendar_id: HOLIDAY_LIBRARY_ID,
            hours,
            make_default: true,
          },
        }),
      )
      .unwrap();
    await store
      .dispatch(
        calendarsApi.endpoints.patchCalendar.initiate({ id: CALENDAR_ID, body: { version: 1, status: "retired" } }),
      )
      .unwrap();
    await store
      .dispatch(
        calendarsApi.endpoints.previewCalendar.initiate({
          id: CALENDAR_ID,
          body: { start: "2026-09-11T16:00:00.000Z", minutes: 240 },
        }),
      )
      .unwrap();
    await store
      .dispatch(
        calendarsApi.endpoints.createHolidayCalendar.initiate({
          country: "GB",
          name: "England and Wales 2026",
          holidays: [{ date: "2026-12-25", label: "Christmas Day" }],
        }),
      )
      .unwrap();
    expect(calls.map((call) => [call.key, call.body])).toEqual([
      [
        `POST /v1/accounts/${ACCOUNT_ID}/calendars`,
        {
          name: "UK standard hours",
          time_zone: "Europe/London",
          holiday_calendar_id: HOLIDAY_LIBRARY_ID,
          hours,
          make_default: true,
        },
      ],
      [`PATCH /v1/calendars/${CALENDAR_ID}`, { version: 1, status: "retired" }],
      [`POST /v1/calendars/${CALENDAR_ID}/preview`, { start: "2026-09-11T16:00:00.000Z", minutes: 240 }],
      [
        "POST /v1/holiday-calendars",
        { country: "GB", name: "England and Wales 2026", holidays: [{ date: "2026-12-25", label: "Christmas Day" }] },
      ],
    ]);
  });

  it("refreshes the account list after a patch, because the default may have moved", async () => {
    let lists = 0;
    stubFetch({
      [`GET /v1/accounts/${ACCOUNT_ID}/calendars`]: () => {
        lists += 1;
        return json([aCalendar()]);
      },
      [`PATCH /v1/calendars/${CALENDAR_ID}`]: () => json(aCalendar({ version: 2 })),
    });
    const store = makeStore();
    const subscription = store.dispatch(calendarsApi.endpoints.listAccountCalendars.initiate(ACCOUNT_ID));
    await subscription.unwrap();
    await store
      .dispatch(
        calendarsApi.endpoints.patchCalendar.initiate({ id: CALENDAR_ID, body: { version: 1, make_default: true } }),
      )
      .unwrap();
    await vi.waitFor(() => expect(lists).toBe(2));
    subscription.unsubscribe();
  });
});

describe("calendar errors", () => {
  it("parses the typed 400 bodies into fixed copy, listing the hour problems", () => {
    const zone = calendarError({ status: 400, data: { code: "invalid_time_zone", time_zone: "Mars/Olympus" } });
    expect(zone.time_zone).toBe("Mars/Olympus");
    expect(describeCalendarError(zone)).toBe("Mars/Olympus is not an IANA time zone.");
    const hours = calendarError({
      status: 400,
      data: { code: "invalid_hours", problems: ["entry 0: end must be after start", "weekday 1: intervals overlap"] },
    });
    expect(hours.problems).toHaveLength(2);
    expect(describeCalendarError(hours)).toBe(
      "The working hours are not valid: entry 0: end must be after start; weekday 1: intervals overlap.",
    );
    expect(describeCalendarError(calendarError({ status: 400, data: { code: "bad_start" } }))).toBe(
      "The preview start must be a valid date and time.",
    );
    expect(
      describeCalendarError(calendarError({ status: 404, data: { code: "not_found", entity: "holiday_calendar" } })),
    ).toBe("That holiday library does not exist.");
    expect(describeCalendarError(calendarError({ status: 409, data: { code: "stale_version" } }))).toBe(
      "Someone else changed this record. It has been reloaded.",
    );
  });
});
