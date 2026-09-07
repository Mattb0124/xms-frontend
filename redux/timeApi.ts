import { xmsApi } from "@/redux/api";

/**
 * Time, Contracts & Budget endpoints (technical spec section 4, day-30
 * cut): entries on tickets and buckets, adjustments, the timesheet, the
 * contract position the server computes, and the comp-time report (TB-13).
 */

/** The after-hours class the account calendar derives for an entry (TB-13). */
export type AfterHoursClass = "standard" | "after_hours" | "weekend" | "holiday";

export interface TimeEntry {
  id: string;
  ticket_id?: string | null;
  bucket_id?: string | null;
  person_id?: string;
  person_name: string;
  performed_on: string;
  /** Local start time as the API stores it ("19:30:00"), or null when the person gave none. */
  performed_start: string | null;
  minutes: number;
  adjusted_minutes?: number;
  activity_type: string;
  billable_class: string;
  description: string;
  /** True whenever `after_hours_class` is not standard. */
  after_hours: boolean;
  after_hours_class: AfterHoursClass;
  /** Numeric as a string, e.g. "1.500"; "1.000" when no premium applied. */
  rate_multiplier: string;
  created_at: string;
  ticket_number?: string | null;
  bucket_label?: string | null;
}

export interface TicketTime {
  entries: TimeEntry[];
  total_minutes: number;
}

export interface LogTimeBody {
  performed_on: string;
  minutes: number;
  activity_type: string;
  billable_class?: string;
  description?: string;
  /** The person's own word that the work was after hours; only counts when no start time lets the calendar judge. */
  after_hours?: boolean;
  /** Local start time, HH:MM 24-hour in the account calendar's zone (TB-13). */
  performed_start?: string;
}

export interface AdjustTimeBody {
  entry_id: string;
  delta_minutes: number;
  kind: "correction" | "write_off" | "reclass";
  new_billable_class?: string;
  reason: string;
}

export type PositionStatus = "on_track" | "watch" | "over";

export interface ContractPosition {
  contract: { id: string; key: string; name: string; model: string };
  period: { starts_on: string; ends_on: string; days_total: number; days_elapsed: number };
  contracted_minutes: number;
  carried_over_minutes: number;
  available_minutes: number;
  consumed_minutes: number;
  non_consuming_minutes: number;
  remaining_minutes: number;
  percent_consumed: number;
  percent_elapsed: number;
  projected_minutes: number;
  status: PositionStatus;
  by_class: Record<string, number>;
  by_activity: Record<string, number>;
}

/** One day of my week (P2.18.3): what the working calendar expects against what was logged; the server computes both. */
export interface TimesheetDay {
  date: string;
  /** ISO weekday, 1 Monday to 7 Sunday. */
  weekday: number;
  expected_minutes: number;
  logged_minutes: number;
  unlogged_minutes: number;
  holiday: boolean;
}

export interface TimesheetWeekDay extends TimesheetDay {
  entries: TimeEntry[];
}

export interface TimesheetWeek {
  from: string;
  to: string;
  days: TimesheetWeekDay[];
  total_minutes: number;
  unlogged_minutes: number;
}

export interface UnloggedSummary {
  from: string;
  to: string;
  days: TimesheetDay[];
  unlogged_minutes: number;
}

export interface Bucket {
  id: string;
  key: string;
  label: string;
  billable_class: string;
  status: string;
}

/** One person's comp-time line: non-standard entries on comp-time contracts that carried no premium. */
export interface CompTimePerson {
  person_id: string;
  person_name: string;
  minutes: number;
  entries: number;
}

/** The comp-time report for an account over a date range (TB-13); every number is the server's. */
export interface CompTimeReport {
  from: string;
  to: string;
  entries: TimeEntry[];
  total_minutes: number;
  by_person: CompTimePerson[];
}

function timeTag(ticketKey: string) {
  return { type: "Time" as const, id: ticketKey };
}

const COMP_TIME = timeTag("comp-time");

export const timeApi = xmsApi.injectEndpoints({
  endpoints: (build) => ({
    ticketTime: build.query<TicketTime, string>({
      query: (ticketKey) => `/v1/tickets/${ticketKey}/time`,
      providesTags: (_result, _error, ticketKey) => [timeTag(ticketKey)],
    }),
    logTicketTime: build.mutation<TimeEntry, { ticketKey: string; body: LogTimeBody }>({
      query: ({ ticketKey, body }) => ({ url: `/v1/tickets/${ticketKey}/time`, method: "POST", body }),
      invalidatesTags: (_result, _error, { ticketKey }) => [timeTag(ticketKey), timeTag("mine"), COMP_TIME, "Position"],
    }),
    myTime: build.query<TimeEntry[], { from: string; to: string }>({
      query: ({ from, to }) => ({ url: "/v1/time/mine", params: { from, to } }),
      providesTags: [timeTag("mine")],
    }),
    myWeek: build.query<TimesheetWeek, { week?: string } | void>({
      query: (options) => ({ url: "/v1/timesheets/me", params: options?.week ? { week: options.week } : undefined }),
      providesTags: [timeTag("mine")],
    }),
    myUnlogged: build.query<UnloggedSummary, { from: string; to: string }>({
      query: ({ from, to }) => ({ url: "/v1/timesheets/me/unlogged", params: { from, to } }),
      providesTags: [timeTag("mine")],
    }),
    adjustTime: build.mutation<unknown, AdjustTimeBody>({
      query: (body) => ({ url: "/v1/time/adjustments", method: "POST", body }),
      invalidatesTags: ["Time", "Position"],
    }),
    contractPosition: build.query<ContractPosition, { accountId: string; contractId: string }>({
      query: ({ accountId, contractId }) => `/v1/accounts/${accountId}/contracts/${contractId}/position`,
      providesTags: (_result, _error, { contractId }) => [{ type: "Position", id: contractId }],
    }),
    compTime: build.query<CompTimeReport, { accountId: string; from: string; to: string }>({
      query: ({ accountId, from, to }) => ({ url: `/v1/accounts/${accountId}/time/comp-time`, params: { from, to } }),
      providesTags: [COMP_TIME],
    }),
    listBuckets: build.query<Bucket[], string>({
      query: (accountId) => `/v1/accounts/${accountId}/buckets`,
    }),
    logBucketTime: build.mutation<TimeEntry, { accountId: string; bucketId: string; body: LogTimeBody }>({
      query: ({ accountId, bucketId, body }) => ({
        url: `/v1/accounts/${accountId}/buckets/${bucketId}/time`,
        method: "POST",
        body,
      }),
      invalidatesTags: [timeTag("mine"), COMP_TIME, "Position"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useTicketTimeQuery,
  useLogTicketTimeMutation,
  useMyTimeQuery,
  useMyWeekQuery,
  useMyUnloggedQuery,
  useAdjustTimeMutation,
  useContractPositionQuery,
  useCompTimeQuery,
  useListBucketsQuery,
  useLogBucketTimeMutation,
} = timeApi;
