import { xmsApi } from "@/redux/api";

/**
 * Business calendars (Accounts & Administration functional 5.7, technical
 * 2.4 and 3.2; TM-06; P3.26.1): one document per calendar with its weekly
 * hours and the holiday library it follows, the account default, and the
 * preview route that answers "when is this due". Reading needs
 * `tickets:view`; every write and the preview need `admin:config`. Making a
 * calendar the default changes `is_default` on its siblings, so a patch
 * invalidates the whole account list, not just the one record.
 */
export interface CalendarHours {
  /** 0 Sunday to 6 Saturday (the API's convention, not ISO). */
  weekday: number;
  start_minute: number;
  end_minute: number;
}

export interface Holiday {
  date: string;
  label: string;
}

export type CalendarStatus = "active" | "retired";

export interface BusinessCalendar {
  id: string;
  account_id: string;
  name: string;
  time_zone: string;
  effective_from: string;
  holiday_calendar_id: string | null;
  status: CalendarStatus;
  version: number;
  hours: CalendarHours[];
  /** The holiday library's dates, read only here. */
  holidays: Holiday[];
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateCalendarBody {
  name: string;
  time_zone: string;
  holiday_calendar_id?: string | null;
  effective_from?: string;
  hours: CalendarHours[];
  make_default?: boolean;
}

export interface PatchCalendarBody {
  version: number;
  name?: string;
  time_zone?: string;
  holiday_calendar_id?: string | null;
  status?: CalendarStatus;
  hours?: CalendarHours[];
  make_default?: boolean;
}

export interface PreviewBody {
  /** ISO instant. */
  start: string;
  minutes: number;
}

export interface PreviewResult {
  start: string;
  minutes: number;
  due_at: string;
  working_minutes_between: number;
  wall_minutes_between: number;
  starts_in_working_time: boolean;
}

export interface HolidayCalendar {
  id: string;
  country: string;
  name: string;
  holidays: Holiday[];
}

export interface CreateHolidayCalendarBody {
  /** Two-letter country code. */
  country: string;
  name: string;
  holidays: Holiday[];
}

export const calendarsApi = xmsApi.injectEndpoints({
  endpoints: (build) => ({
    listAccountCalendars: build.query<BusinessCalendar[], string>({
      query: (accountId) => `/v1/accounts/${accountId}/calendars`,
      providesTags: (result, _error, accountId) => [
        "Calendars",
        { type: "Calendars", id: `account:${accountId}` },
        ...(result ?? []).map((row) => ({ type: "Calendar" as const, id: row.id })),
      ],
    }),
    getCalendar: build.query<BusinessCalendar, string>({
      query: (id) => `/v1/calendars/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Calendar", id }],
    }),
    createCalendar: build.mutation<BusinessCalendar, { accountId: string; body: CreateCalendarBody }>({
      query: ({ accountId, body }) => ({ url: `/v1/accounts/${accountId}/calendars`, method: "POST", body }),
      invalidatesTags: (_result, _error, { accountId }) => [{ type: "Calendars", id: `account:${accountId}` }],
    }),
    patchCalendar: build.mutation<BusinessCalendar, { id: string; body: PatchCalendarBody }>({
      query: ({ id, body }) => ({ url: `/v1/calendars/${id}`, method: "PATCH", body }),
      invalidatesTags: (_result, _error, { id }) => [{ type: "Calendar", id }, "Calendars"],
    }),
    previewCalendar: build.mutation<PreviewResult, { id: string; body: PreviewBody }>({
      query: ({ id, body }) => ({ url: `/v1/calendars/${id}/preview`, method: "POST", body }),
    }),
    listHolidayCalendars: build.query<HolidayCalendar[], void>({
      query: () => "/v1/holiday-calendars",
      providesTags: ["HolidayCalendars"],
    }),
    createHolidayCalendar: build.mutation<HolidayCalendar, CreateHolidayCalendarBody>({
      query: (body) => ({ url: "/v1/holiday-calendars", method: "POST", body }),
      invalidatesTags: ["HolidayCalendars"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListAccountCalendarsQuery,
  useGetCalendarQuery,
  useCreateCalendarMutation,
  usePatchCalendarMutation,
  usePreviewCalendarMutation,
  useListHolidayCalendarsQuery,
  useCreateHolidayCalendarMutation,
} = calendarsApi;
