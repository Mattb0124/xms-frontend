import { xmsApi } from "@/redux/api";

/**
 * The change calendar as a feed a calendar client subscribes to (INT-05).
 *
 * The address carries a secret, so the server returns it once and keeps only
 * its hash: there is no route that reads a token back. A reader who loses the
 * address makes a new one, which revokes the old.
 */
export interface CalendarFeedToken {
  id: string;
  token: string;
  url: string;
  created_at: string;
}

export const calendarFeedApi = xmsApi.injectEndpoints({
  endpoints: (build) => ({
    createCalendarToken: build.mutation<CalendarFeedToken, void>({
      query: () => ({ url: "/v1/me/calendar-token", method: "POST" }),
    }),
    revokeCalendarToken: build.mutation<void, void>({
      query: () => ({ url: "/v1/me/calendar-token", method: "DELETE" }),
    }),
  }),
});

export const { useCreateCalendarTokenMutation, useRevokeCalendarTokenMutation } = calendarFeedApi;
