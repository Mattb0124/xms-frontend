import { xmsApi } from "@/redux/api";

/**
 * Time, Contracts & Budget endpoints (technical spec section 4, day-30
 * cut): entries on tickets and buckets, adjustments, the timesheet, and the
 * contract position the server computes.
 */
export interface TimeEntry {
  id: string;
  ticket_id?: string | null;
  bucket_id?: string | null;
  person_id?: string;
  person_name: string;
  performed_on: string;
  minutes: number;
  adjusted_minutes?: number;
  activity_type: string;
  billable_class: string;
  description: string;
  after_hours: boolean;
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
  after_hours?: boolean;
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

export interface Bucket {
  id: string;
  key: string;
  label: string;
  billable_class: string;
  status: string;
}

function timeTag(ticketKey: string) {
  return { type: "Time" as const, id: ticketKey };
}

export const timeApi = xmsApi.injectEndpoints({
  endpoints: (build) => ({
    ticketTime: build.query<TicketTime, string>({
      query: (ticketKey) => `/v1/tickets/${ticketKey}/time`,
      providesTags: (_result, _error, ticketKey) => [timeTag(ticketKey)],
    }),
    logTicketTime: build.mutation<TimeEntry, { ticketKey: string; body: LogTimeBody }>({
      query: ({ ticketKey, body }) => ({ url: `/v1/tickets/${ticketKey}/time`, method: "POST", body }),
      invalidatesTags: (_result, _error, { ticketKey }) => [timeTag(ticketKey), timeTag("mine"), "Position"],
    }),
    myTime: build.query<TimeEntry[], { from: string; to: string }>({
      query: ({ from, to }) => ({ url: "/v1/time/mine", params: { from, to } }),
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
    listBuckets: build.query<Bucket[], string>({
      query: (accountId) => `/v1/accounts/${accountId}/buckets`,
    }),
    logBucketTime: build.mutation<TimeEntry, { accountId: string; bucketId: string; body: LogTimeBody }>({
      query: ({ accountId, bucketId, body }) => ({
        url: `/v1/accounts/${accountId}/buckets/${bucketId}/time`,
        method: "POST",
        body,
      }),
      invalidatesTags: [timeTag("mine"), "Position"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useTicketTimeQuery,
  useLogTicketTimeMutation,
  useMyTimeQuery,
  useAdjustTimeMutation,
  useContractPositionQuery,
  useListBucketsQuery,
  useLogBucketTimeMutation,
} = timeApi;
