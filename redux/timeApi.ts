import { xmsApi } from "@/redux/api";
import type { AfterHoursHandling, OverageRule, RolloverRule } from "@/redux/ticketsApi";

/**
 * Time, Contracts & Budget endpoints (technical spec section 4, day-30
 * cut): entries on tickets and buckets, adjustments, the timesheet, the
 * contract position the server computes, the comp-time report (TB-13), the
 * account's budget view with its drill-through (TB-07 to TB-09), the
 * rate card versions (TB-05) and the billing periods with their finance
 * exports (functional 5.7, TB-14).
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

/**
 * The non-ticket taxonomy (TB-12, technical 2.7): governance, QBR
 * preparation, account management and escalation handling are the buckets
 * the workbook names, and `custom` is anything an operator adds for one
 * account, so reporting groups the same kind of work across accounts
 * whatever a client's own bucket is called.
 */
export const BUCKET_CODES = ["governance", "qbr_prep", "account_mgmt", "escalation", "custom"] as const;
export type BucketCode = (typeof BUCKET_CODES)[number];

export const BUCKET_CODE_LABEL: Record<BucketCode, string> = {
  governance: "Governance",
  qbr_prep: "QBR preparation",
  account_mgmt: "Account management",
  escalation: "Escalation handling",
  custom: "Custom",
};

export function bucketCodeLabel(code: string): string {
  return BUCKET_CODE_LABEL[code as BucketCode] ?? code.replace(/_/g, " ");
}

/**
 * A bucket work is logged against without a ticket (TB-12). The billable
 * class decides whether the entry burns the contract exactly as a ticket
 * entry does: an internal or non-billable class does not consume the
 * period, and a bucket that named no class took the account's first
 * non-consuming one when it was created.
 */
export interface Bucket {
  id: string;
  account_id?: string;
  key: string;
  label: string;
  /** The shared taxonomy; absent on an older API. */
  code?: string;
  billable_class: string;
  /** The contract this bucket's time belongs to; null falls back to the account's active one. */
  contract_id?: string | null;
  status: string;
  version?: number;
}

/** PATCH body: rename a bucket, move its class or code, or retire it (contracts:manage). */
export interface PatchBucketBody {
  version: number;
  label?: string;
  code?: BucketCode;
  billable_class?: string;
  status?: "active" | "retired";
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

/** The billing period's state (functional 5.7): open, submitted, approved, locked, exported. */
export type BillingStatus = "open" | "submitted" | "approved" | "locked" | "exported";

/** The moves the desk can make; `mark_exported` belongs to the finance connector. */
export type BillingAction = "submit" | "reopen" | "approve" | "lock";

/** The figures kept on the period at submit and lock; the finance file matches them to the cent (TB-14). */
export interface BillingSummary {
  entries: number;
  adjustments: number;
  minutes: number;
  amount: number;
  unrated_minutes: number;
  by_class: Record<string, { minutes: number; amount: number }>;
  by_contract: Record<string, { minutes: number; amount: number }>;
}

export interface BillingPeriod {
  id: string;
  account_id: string;
  starts_on: string;
  ends_on: string;
  status: BillingStatus;
  submitted_at: string | null;
  submitted_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
  locked_at: string | null;
  locked_by: string | null;
  /** The people behind the ids, resolved by the server; "System" for the automatic lock. */
  submitted_by_name: string | null;
  approved_by_name: string | null;
  locked_by_name: string | null;
  /** Set on approve: the lock the server applies on its own after N days. */
  auto_lock_at: string | null;
  summary: BillingSummary | null;
  /** SHA-256 of the last finance file produced; null before any export. */
  checksum: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export type BillingExportFormat = "xlsx" | "csv";

/** One finance file produced for a period, append-only. */
export interface BillingExport {
  id: string;
  account_id: string;
  billing_period_id: string;
  format: BillingExportFormat;
  template_version: string;
  object_key: string;
  checksum: string;
  row_count: number;
  produced_by: string;
  produced_at: string;
  delivered_at: string | null;
  delivery_ref: string | null;
}

export interface CreateBillingPeriodBody {
  starts_on: string;
  ends_on: string;
}

/** The path the finance file streams from; fetched with the bearer through lib/exports/download. */
export function billingExportPath(accountId: string, periodId: string, format: BillingExportFormat): string {
  return `/v1/accounts/${accountId}/billing-periods/${periodId}/export?format=${format}`;
}

function timeTag(ticketKey: string) {
  return { type: "Time" as const, id: ticketKey };
}

function billingTag(accountId: string) {
  return { type: "BillingPeriods" as const, id: accountId };
}

function billingExportsTag(periodId: string) {
  return { type: "BillingExports" as const, id: periodId };
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
    /** The account's buckets; the API answers the read to `time:log`, since logging is what needs it. */
    listBuckets: build.query<Bucket[], string>({
      query: (accountId) => `/v1/accounts/${accountId}/buckets`,
      providesTags: (_result, _error, accountId) => [{ type: "Account", id: `${accountId}:buckets` }],
    }),
    /** Rename, reclass or retire a bucket (TB-12), under contracts:manage. */
    patchBucket: build.mutation<Bucket, { accountId: string; bucketId: string; body: PatchBucketBody }>({
      query: ({ accountId, bucketId, body }) => ({
        url: `/v1/accounts/${accountId}/buckets/${bucketId}`,
        method: "PATCH",
        body,
      }),
      // A stale version means the list is behind, so it is read again either way.
      invalidatesTags: (_result, _error, { accountId }) => [{ type: "Account", id: `${accountId}:buckets` }],
    }),
    /**
     * Non-ticket time on a bucket (TB-12). The route is
     * `.../buckets/{bucketId}/time-entries`, where technical 4 puts it: the
     * backend renamed it from `/time` and checks the account in the path, so
     * the old address is a 404 and logging bucket time stopped working.
     */
    logBucketTime: build.mutation<TimeEntry, { accountId: string; bucketId: string; body: LogTimeBody }>({
      query: ({ accountId, bucketId, body }) => ({
        url: `/v1/accounts/${accountId}/buckets/${bucketId}/time-entries`,
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
    billingPeriods: build.query<BillingPeriod[], string>({
      query: (accountId) => `/v1/accounts/${accountId}/billing-periods`,
      providesTags: (_result, _error, accountId) => [billingTag(accountId)],
    }),
    createBillingPeriod: build.mutation<BillingPeriod, { accountId: string; body: CreateBillingPeriodBody }>({
      query: ({ accountId, body }) => ({ url: `/v1/accounts/${accountId}/billing-periods`, method: "POST", body }),
      invalidatesTags: (_result, error, { accountId }) => (error ? [] : [billingTag(accountId)]),
    }),
    transitionBillingPeriod: build.mutation<
      BillingPeriod,
      { accountId: string; periodId: string; action: BillingAction; version: number }
    >({
      query: ({ accountId, periodId, action, version }) => ({
        url: `/v1/accounts/${accountId}/billing-periods/${periodId}/${action}`,
        method: "POST",
        body: { version },
      }),
      // A stale_version or invalid_transition refusal means the list is behind: reload it either way.
      invalidatesTags: (_result, _error, { accountId }) => [billingTag(accountId)],
    }),
    billingExports: build.query<BillingExport[], { accountId: string; periodId: string }>({
      query: ({ accountId, periodId }) => `/v1/accounts/${accountId}/billing-periods/${periodId}/exports`,
      providesTags: (_result, _error, { periodId }) => [billingExportsTag(periodId)],
    }),
  }),
  overrideExisting: false,
});

/** The tags a produced finance file makes stale: the period's checksum and its export records. */
export function billingExportTags(accountId: string, periodId: string) {
  return [billingTag(accountId), billingExportsTag(periodId)];
}

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
  usePatchBucketMutation,
  useLogBucketTimeMutation,
  useAccountBudgetQuery,
  useBudgetEntriesQuery,
  useRateCardsQuery,
  useCreateRateCardMutation,
  useBillingPeriodsQuery,
  useCreateBillingPeriodMutation,
  useTransitionBillingPeriodMutation,
  useBillingExportsQuery,
} = timeApi;
