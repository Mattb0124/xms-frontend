import { xmsApi } from "@/redux/api";
import type { AfterHoursHandling, OverageRule, RolloverRule } from "@/redux/ticketsApi";

/**
 * Time, Contracts & Budget endpoints (technical spec section 4, day-30
 * cut): entries on tickets and buckets, adjustments, the timesheet, the
 * contract position the server computes, the comp-time report (TB-13), the
 * account's budget view with its drill-through (TB-07 to TB-09) and the
 * rate card versions (TB-05).
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
  /** The hourly rate frozen when the entry was logged (numeric string); null when no rate card entry covered the role. */
  rate_snapshot: string | null;
  /** minutes / 60 * rate * multiplier to the cent (numeric string); null without a rate. */
  amount: string | null;
  /** True when the entry took the period past its available minutes (TB-11). */
  over_budget: boolean;
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

/** The contract as the budget view names it (the rules that word the card). */
export interface BudgetContractSummary {
  id: string;
  key: string;
  name: string;
  model: string;
  currency: string;
  overage_rule: OverageRule;
  rollover_rule: RolloverRule;
  after_hours_handling: AfterHoursHandling;
}

export interface BudgetPeriod {
  id: string;
  starts_on: string;
  ends_on: string;
  locked: boolean;
}

/** The position the budget view carries: the burn math without the contract header the /position route adds. */
export type BudgetPosition = Omit<ContractPosition, "contract">;

/** TB-08: the run rate over the last N business days projected over the business days left. */
export interface BudgetForecast {
  business_days_total: number;
  business_days_elapsed: number;
  window_days: number;
  /** Consuming minutes per business day over the window. */
  run_rate_minutes: number;
  forecast_minutes: number;
  forecast_percent: number;
  /** Business days until the available minutes are gone at the run rate; null when they never are. */
  business_days_to_exhaustion: number | null;
}

export interface ThresholdEvent {
  id: string;
  contract_period_id: string;
  percent: number;
  consumed_minutes_at_fire: number;
  available_minutes: number;
  fired_at: string;
}

/** TB-09: the configured percents, the ones that fired this period, and the next one ahead. */
export interface BudgetThresholds {
  percents: number[];
  fired: number[];
  next_percent: number | null;
  next_at_minutes: number | null;
  events: ThresholdEvent[];
}

/** One contract on the account's Budget view (Time & Budget 5.5); every number is the server's. */
export interface BudgetContractCard {
  contract: BudgetContractSummary;
  /** Null when the contract has no period at all. */
  period: BudgetPeriod | null;
  position: BudgetPosition | null;
  forecast: BudgetForecast | null;
  thresholds: BudgetThresholds | null;
  /** Consuming minutes in the period that carried no rate. */
  unrated_minutes: number;
}

export interface AccountBudget {
  account_id: string;
  as_of: string;
  calendar_id: string;
  contracts: BudgetContractCard[];
}

/** The drill-through filter; the query parameter names are the API's (`contract`, `person`, `activity`, `class`). */
export interface BudgetEntriesFilter {
  accountId: string;
  contract?: string;
  person?: string;
  activity?: string;
  class?: string;
  from: string;
  to: string;
}

export interface BudgetEntry extends TimeEntry {
  ticket_number: string | null;
  bucket_label: string | null;
  contract_key: string;
}

export interface BudgetEntries {
  contractId?: string;
  personId?: string;
  activity?: string;
  billableClass?: string;
  from: string;
  to: string;
  entries: BudgetEntry[];
  total_minutes: number;
  /** The rated amounts summed to the cent; unrated entries count nothing. */
  total_amount: number;
}

export interface RateCardEntry {
  role: string;
  bill_rate: number;
  overage_rate: number | null;
}

/** One rate card version (TB-05): a contract's own when contract_id is set, else an account default. */
export interface RateCard {
  id: string;
  account_id: string;
  contract_id: string | null;
  effective_from: string;
  currency: string;
  note: string;
  created_by: string;
  created_at: string;
  entries: RateCardEntry[];
}

export interface CreateRateCardBody {
  contract_id?: string;
  effective_from: string;
  currency?: string;
  note?: string;
  entries: { role: string; bill_rate: number; overage_rate?: number }[];
}

function timeTag(ticketKey: string) {
  return { type: "Time" as const, id: ticketKey };
}

const COMP_TIME = timeTag("comp-time");

function budgetTag(accountId: string) {
  return { type: "Budget" as const, id: accountId };
}

function rateCardsTag(accountId: string) {
  return { type: "RateCards" as const, id: accountId };
}

/** The query string for the drill-through; absent filters are left off the URL. */
export function budgetEntriesParams(filter: BudgetEntriesFilter): Record<string, string> {
  const params: Record<string, string> = { from: filter.from, to: filter.to };
  if (filter.contract) params.contract = filter.contract;
  if (filter.person) params.person = filter.person;
  if (filter.activity) params.activity = filter.activity;
  if (filter.class) params.class = filter.class;
  return params;
}

export const timeApi = xmsApi.injectEndpoints({
  endpoints: (build) => ({
    ticketTime: build.query<TicketTime, string>({
      query: (ticketKey) => `/v1/tickets/${ticketKey}/time`,
      providesTags: (_result, _error, ticketKey) => [timeTag(ticketKey)],
    }),
    logTicketTime: build.mutation<TimeEntry, { ticketKey: string; body: LogTimeBody }>({
      query: ({ ticketKey, body }) => ({ url: `/v1/tickets/${ticketKey}/time`, method: "POST", body }),
      invalidatesTags: (_result, _error, { ticketKey }) => [
        timeTag(ticketKey),
        timeTag("mine"),
        COMP_TIME,
        "Position",
        "Budget",
      ],
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
      invalidatesTags: ["Time", "Position", "Budget"],
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
      invalidatesTags: [timeTag("mine"), COMP_TIME, "Position", "Budget"],
    }),
    accountBudget: build.query<AccountBudget, string>({
      query: (accountId) => `/v1/accounts/${accountId}/budget`,
      providesTags: (_result, _error, accountId) => [budgetTag(accountId)],
    }),
    budgetEntries: build.query<BudgetEntries, BudgetEntriesFilter>({
      query: (filter) => ({
        url: `/v1/accounts/${filter.accountId}/budget/entries`,
        params: budgetEntriesParams(filter),
      }),
      providesTags: (_result, _error, { accountId }) => [budgetTag(accountId)],
    }),
    rateCards: build.query<RateCard[], { accountId: string; contractId?: string }>({
      query: ({ accountId, contractId }) => ({
        url: `/v1/accounts/${accountId}/rate-cards`,
        params: contractId ? { contract_id: contractId } : undefined,
      }),
      providesTags: (_result, _error, { accountId }) => [rateCardsTag(accountId)],
    }),
    createRateCard: build.mutation<RateCard, { accountId: string; body: CreateRateCardBody }>({
      query: ({ accountId, body }) => ({ url: `/v1/accounts/${accountId}/rate-cards`, method: "PUT", body }),
      // A refused version (rate_card_exists, duplicate_role) changes nothing, so nothing reloads.
      invalidatesTags: (_result, error, { accountId }) => (error ? [] : [rateCardsTag(accountId)]),
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
  useAccountBudgetQuery,
  useBudgetEntriesQuery,
  useRateCardsQuery,
  useCreateRateCardMutation,
} = timeApi;
