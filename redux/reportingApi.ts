import { xmsApi } from "@/redux/api";

/**
 * Dashboards, audit search and report packs (Dashboards & Report Packs
 * technical spec, Audit & Analytics section 7). Every number arrives from
 * the API; the browser renders and never recomputes a measure.
 */
export interface Ratio {
  numerator: number;
  denominator: number;
  /** Percent for attainment, a plain ratio for reopen rate; null when the denominator is zero. */
  value: number | null;
}

export type AgeBucket = "0_1d" | "1_3d" | "3_7d" | "7_14d" | "14d_plus";

export interface Measures {
  open_tickets: number;
  open_by_priority: Record<string, number>;
  open_by_type: Record<string, number>;
  breached_now: number;
  at_risk_now: number;
  unassigned_now: number;
  backlog_by_age: Record<AgeBucket, number>;
  volume_created: number;
  volume_resolved: number;
  sla_response_attainment: Ratio;
  sla_resolution_attainment: Ratio;
  mttr_minutes: number | null;
  reopen_rate: Ratio;
  consumption_minutes: number;
  time_logged_minutes: number;
  oldest_open_days: number;
}

export interface Notable {
  key: string;
  title: string;
  state: string;
  priority: string;
  age_days: number;
  breached: boolean;
}

export interface Period {
  start: string;
  end: string;
}

export interface AccountStrip {
  account_id: string;
  key: string;
  name: string;
  measures: Pick<
    Measures,
    "open_tickets" | "breached_now" | "at_risk_now" | "unassigned_now" | "volume_created" | "volume_resolved"
  >;
}

export interface OperationsDashboard {
  period: Period;
  measures: Measures;
  notable: Notable[];
  per_account: AccountStrip[];
}

/** The internal view carries notable tickets; the client view is the portal subset only. */
export interface AccountDashboard {
  period: Period;
  measures: Partial<Measures>;
  notable?: Notable[];
}

/**
 * The Security dashboard (Audit & Analytics 7.1, XA-03). Every figure is
 * counted on the server from a table that exists and the browser only
 * renders it. The five later lists are optional because an API older than
 * the figure does not send them, and the screen leaves the tile and the
 * panel out rather than printing a zero it never read.
 *
 * Two of them read the present rather than the window, because neither
 * `acct.webhook_subscriptions` nor `acct.connector_instances` timestamps a
 * pause and `sys.dead_letters` is a backlog and not a rate. Their panels say
 * so, rather than letting the period pills imply otherwise.
 */
export interface SecurityDashboard {
  by_type: Array<{ event_type: string; outcome: string; n: number }>;
  signin_failures: Array<{ actor_id: string; ip_hash: string | null; n: number }>;
  isolation_probes: Array<{ actor_id: string; n: number }>;
  /** The `abuse.*` group: rate limits, bad webhook signatures, mail loops, rejected uploads, CSP reports. */
  abuse_by_kind?: Array<{ event_type: string; n: number }>;
  /** Who the rate limiter turned away, most often first. */
  rate_limited_clients?: Array<{ actor_id: string; principal_kind: string | null; n: number }>;
  /**
   * What is paused right now, one row per paused thing (backend 77745ef):
   * the `kind` says which screen opens it, the `id` says which record, and
   * the account says under which client. The counts the tiles read stay in
   * `paused_integrations_by_reason`.
   */
  paused_integrations?: PausedIntegration[];
  /** The same two tables counted by kind and reason: the figure on the tile. */
  paused_integrations_by_reason?: Array<{ kind: string; reason: string; n: number }>;
  /** Files the scanner held back in the window, by where they came from. */
  quarantined_attachments?: Array<{ origin: string; n: number }>;
  /**
   * Open dead letters split by queue, account and, where the queue is a
   * connector queue, the instance its payload names. Bound to the reader's
   * grants, since `sys.dead_letters` carries no policy of its own.
   */
  open_dead_letters?: OpenDeadLetter[];
  /** The portfolio depth per queue, operator wide: the figure on the tile. */
  open_dead_letters_by_queue?: Array<{ queue: string; n: number; oldest: string }>;
}

export type PausedKind = "webhook_subscription" | "connector_instance";

export interface PausedIntegration {
  kind: PausedKind;
  /** The subscription's or the instance's own id, which is the record to open. */
  id: string;
  account_id: string;
  account_key: string;
  /** The endpoint URL of a subscription, or the name of an instance. */
  name: string;
  /** The server's own word for a pause with no reason recorded is "unstated". */
  reason: string;
}

export interface OpenDeadLetter {
  queue: string;
  n: number;
  oldest: string;
  account_id: string | null;
  /** The connector instance the payload names, where the queue has one. */
  instance_id: string | null;
  instance_name: string | null;
}

export interface UsageCount {
  key: string;
  n: number;
}

/**
 * One account's slice of the same window, each figure counted from the table
 * that records it: `acct.tickets` for what was opened and closed,
 * `acct.time_entries` for the minutes logged, `sys.security_events` for the
 * portal sign-ins, `rpt.usage_events` for the API client calls and the
 * active users. No named-user drill-down: that needs
 * `analytics:read-individual`, and this route stands on `analytics:read`.
 */
export interface UsageAccountRow {
  account_id: string;
  key: string;
  name: string;
  tickets_created: number;
  tickets_closed: number;
  minutes_logged: number;
  portal_signins: number;
  api_calls: number;
  active_users: number;
}

export interface UsageDashboard {
  active_users?: UsageCount[];
  actions?: UsageCount[];
  screens?: UsageCount[];
  no_result_searches?: UsageCount[];
  api_errors?: UsageCount[];
  /** Optional for the API older than the strip; the screen leaves the table out rather than showing an empty one. */
  per_account?: UsageAccountRow[];
}

export type AuditField =
  | "stream"
  | "event_type"
  | "actor_id"
  | "actor_kind"
  | "principal_kind"
  | "account_id"
  | "entity_kind"
  | "entity_id"
  | "outcome"
  | "request_id"
  | "correlation_id"
  | "occurred_at";

/**
 * `is_null` and `is_not_null` ask about the column itself (backend
 * c16f7f0): they carry no value, take no bind parameter and are accepted
 * only on the columns of `rpt.events_v` that can actually be null. A value
 * sent with either is refused rather than ignored, so neither is written
 * with one here.
 */
export type AuditOperator = "eq" | "neq" | "in" | "contains" | "before" | "after" | "is_null" | "is_not_null";

export interface AuditCondition {
  field: AuditField;
  op: AuditOperator;
  /** Absent for `is_null` and `is_not_null`, and required by every other operator. */
  value?: string | string[];
}

export interface AuditQuery {
  conditions: AuditCondition[];
  limit?: number;
  cursor?: string;
}

export type AuditStream = "audit" | "security" | "usage";

export interface AuditEvent {
  id: string;
  stream: AuditStream;
  occurred_at: string;
  event_type: string;
  account_id: string | null;
  actor_kind: string | null;
  actor_id: string | null;
  actor_name: string | null;
  principal_kind: string | null;
  session_id: string | null;
  request_id: string | null;
  correlation_id: string | null;
  entity_kind: string | null;
  entity_id: string | null;
  outcome: string | null;
  attrs: Record<string, unknown> | null;
}

export interface AuditPage {
  items: AuditEvent[];
  next_cursor: string | null;
}

export interface ReportRun {
  id: string;
  pack_type: string;
  period_start: string;
  period_end: string;
  status: string;
  created_at: string;
  pack_id_resolved: string | null;
  pptx_key: string | null;
  error?: string | null;
}

export interface GeneratedReport {
  run_id: string;
  pack_id: string;
  /** Presigned URL minted by the API; opened directly, never rewritten. */
  download: string;
}

export interface NarrativeVersion {
  version: number;
  text: string;
  author_kind: string;
  at: string;
}

/**
 * The two renditions a run stores (Dashboards functional 5.6): the deck and
 * the PDF rendering of the same frozen numbers. `GET /v1/reports/packs/:id`
 * mints the download for the rendition asked for, so a caller that wants the
 * other asks the same route again rather than reading a second one.
 */
export type PackFormat = "pptx" | "pdf";

export interface ReportPack {
  id: string;
  period_start: string;
  period_end: string;
  measures: Measures;
  notable: Notable[];
  narrative_versions: NarrativeVersion[];
  /** The rendition this response minted the download for; the API echoes it. */
  format?: PackFormat;
  download: string | null;
}

export interface PortalDashboard {
  period: Period;
  measures: Partial<Measures>;
}

/**
 * CSAT per account (Client Portal functional 5.7, the operator view): the
 * summary the server computed over the responses in the range, the survey
 * counts for the whole account, and the individual responses with the
 * respondent unless the account keeps them anonymous.
 */
export type CsatScore = "1" | "2" | "3" | "4" | "5";

export interface CsatSummary {
  responses: number;
  /** Rounded to two decimals; null with no responses. */
  average: number | null;
  distribution: Record<CsatScore, number>;
  /** Scores of 1 or 2. */
  low: number;
}

export interface CsatResponse {
  id: string;
  survey_id: string;
  ticket_key: string | null;
  score: number;
  comment: string | null;
  contact_name: string | null;
  contact_email: string | null;
  created_at: string;
}

/**
 * The quarterly relationship survey per account (functional 5.7). It asks a
 * different question from the ticket-close survey, so the server keeps it
 * as its own block rather than averaging it into the same number: the
 * latest period answered, the mean per question in that period, and the
 * trend over the last four periods, oldest first so it reads left to right.
 *
 * The block is optional because an API older than the quarterly survey does
 * not send it; the Satisfaction tab renders it only when it arrives.
 */
export interface CsatPeriodSummary {
  period: string;
  responses: number;
  /** The mean of the five questions in that period; null with no answer. */
  average: number | null;
}

export interface CsatQuarterly {
  latest_period: string | null;
  responses: number;
  /** The mean per question in the latest period, keyed as the answers are. */
  averages: Record<string, number | null>;
  average: number | null;
  trend: CsatPeriodSummary[];
  /** The five questions, so the columns are named as the survey asked them. */
  questions?: { key: string; text: string }[];
}

export interface AccountCsat {
  account_id: string;
  from: string;
  to: string;
  summary: CsatSummary;
  quarterly?: CsatQuarterly;
  surveys: { sent: number; answered: number; suppressed: number };
  responses: CsatResponse[];
}

export interface CsatParams {
  accountId: string;
  from?: string;
  to?: string;
}

/**
 * Report schedules and distribution (Dashboards functional 5.7, DR-05):
 * one or more schedules per account; the worker builds and delivers the
 * pack, the per-recipient outcome lives on the run.
 */
export type Cadence = "weekly" | "monthly" | "quarterly";
export type PeriodKind = "previous_week" | "previous_month" | "previous_quarter";
export type RecipientKind = "internal" | "portal_user" | "contact";

export interface Recipient {
  kind: RecipientKind;
  id?: string;
  email?: string;
  name?: string;
}

export interface DeliveryOutcome {
  kind: RecipientKind;
  to: string;
  outcome: "notified" | "emailed" | "skipped";
  reason?: string;
}

export interface ReportSchedule {
  id: string;
  account_id: string;
  name: string;
  pack_type: "wsr" | "qbr" | "custom";
  cadence: Cadence;
  /** 1 to 7 for weekly (Monday first), 1 to 31 otherwise. */
  run_day: number;
  /** "HH:MM:SS" as the server stores it. */
  run_time: string;
  period_kind: PeriodKind;
  formats: string[];
  distribution: Recipient[];
  /** Functional 5.8: a run of this schedule is held for a reviewer, never sent on sight. */
  review_required: boolean;
  /** How long a held run waits before the deadline expires the hold; the server's default is 24. */
  review_grace_hours: number;
  enabled: boolean;
  next_run_at: string | null;
  last_run_id: string | null;
  version: number;
}

export interface ScheduleFields {
  name?: string;
  cadence?: Cadence;
  run_day?: number;
  /** "HH:MM". */
  run_time?: string;
  period_kind?: PeriodKind;
  distribution?: Recipient[];
  review_required?: boolean;
  enabled?: boolean;
}

export interface CreateScheduleBody extends ScheduleFields {
  account_id: string;
  name: string;
  cadence: Cadence;
  run_day: number;
}

export interface PatchScheduleBody extends ScheduleFields {
  version: number;
}

export interface RunNowBody {
  period_start?: string;
  period_end?: string;
}

/**
 * What a run answers when it is asked for by hand or approved. A schedule
 * with review required answers `ready_for_review` with the deadline instead
 * of a delivery: nothing was sent, and the run waits on the review screen.
 */
export interface RunNowResult {
  run_id: string;
  pack_id: string;
  period: { start: string; end: string };
  delivery: DeliveryOutcome[];
  status: "sent" | "failed" | "ready_for_review";
  review_due_at: string | null;
}

export interface ScheduleRun {
  id: string;
  account_id: string;
  schedule_id: string | null;
  pack_type: string;
  period_start: string;
  period_end: string;
  status: string;
  error: string | null;
  pack_id: string | null;
  pptx_key: string | null;
  delivery: DeliveryOutcome[] | null;
  /** A user id, or "system" for the worker. */
  requested_by: string;
  created_at: string;
}

export interface RunsFilter {
  account?: string;
  status?: string;
  schedule?: string;
}

/**
 * Review before send (Dashboards functional 5.8, DR-05). A run of a schedule
 * with `review_required` is rendered and then held: `ready_for_review` until
 * its deadline, `awaiting_review` after the sweep expires the hold. Both are
 * approvable, and neither has delivered anything. Approve sends the pack that
 * was held, so the deck the reviewer read is the deck the client receives;
 * cancel records the reason and the run takes the closed `skipped` status.
 */
export const HELD_RUN_STATUSES = ["ready_for_review", "awaiting_review"] as const;

/** The pack frozen behind a held run, as the run detail carries it. */
export interface HeldPack {
  id: string;
  period_start: string;
  period_end: string;
  measures: Measures;
  notable: Notable[];
  narrative_versions: NarrativeVersion[];
  pptx_key: string | null;
  pdf_key: string | null;
}

/** Presigned links to the two renditions, minted by the API and never rewritten. */
export interface PackLinks {
  pptx: string | null;
  pdf: string | null;
}

export interface ReviewRun extends ScheduleRun {
  /** Who decided, and when; both null while the run is still waiting. */
  reviewer_id: string | null;
  reviewed_at: string | null;
  /** The deadline frozen when the run was held; cleared once it is decided. */
  review_due_at: string | null;
  /** The reason a cancel recorded. */
  review_note: string | null;
  pack: HeldPack | null;
  files: PackLinks;
}

export interface CancelRunResult {
  run_id: string;
  status: string;
  reason: string;
}

function csatTag(accountId: string) {
  return { type: "Csat" as const, id: accountId };
}

function schedulesTag(accountId: string) {
  return { type: "ReportSchedules" as const, id: accountId };
}

function runsTag(accountId: string | undefined) {
  return { type: "ReportRuns" as const, id: accountId ?? "all" };
}

function runTag(runId: string) {
  return { type: "ReportRuns" as const, id: `run:${runId}` };
}

/**
 * A decision on a held run is reloaded whether the API took it or refused
 * it: a refusal means this view is behind the run (someone else approved or
 * cancelled it), which is exactly when the screen must read it again. The
 * account's runs, its Reports card and the Waiting rail all counted the held
 * run, so all three move with it.
 */
function reviewTags(runId: string, accountId: string | undefined) {
  return [
    runTag(runId),
    runsTag(accountId),
    runsTag(undefined),
    { type: "Reports" as const, id: accountId ?? "all" },
    "Waiting" as const,
  ];
}

export const reportingApi = xmsApi.injectEndpoints({
  endpoints: (build) => ({
    operationsDashboard: build.query<OperationsDashboard, { days: number }>({
      query: ({ days }) => ({ url: "/v1/dashboards/operations", params: { days } }),
      providesTags: [{ type: "Dashboards", id: "operations" }],
    }),
    accountDashboard: build.query<AccountDashboard, { id: string; days: number; asClient?: boolean }>({
      query: ({ id, days, asClient }) => ({
        url: `/v1/dashboards/accounts/${id}`,
        params: asClient ? { days, as_client: "true" } : { days },
      }),
      providesTags: (_result, _error, { id }) => [{ type: "Dashboards", id: `account:${id}` }],
    }),
    securityDashboard: build.query<SecurityDashboard, { days: number }>({
      query: ({ days }) => ({ url: "/v1/dashboards/security", params: { days } }),
      providesTags: [{ type: "Dashboards", id: "security" }],
    }),
    usageDashboard: build.query<UsageDashboard, { days: number }>({
      query: ({ days }) => ({ url: "/v1/dashboards/usage", params: { days } }),
      providesTags: [{ type: "Dashboards", id: "usage" }],
    }),
    /** Keyset search over rpt.events_v; the screen appends pages by passing the cursor back. */
    auditSearch: build.query<AuditPage, AuditQuery>({
      query: (body) => ({ url: "/v1/audit/search", method: "POST", body }),
    }),
    reportRuns: build.query<ReportRun[], string>({
      query: (accountId) => `/v1/accounts/${accountId}/reports`,
      providesTags: (_result, _error, accountId) => [{ type: "Reports", id: accountId }],
    }),
    generateWsr: build.mutation<GeneratedReport, string>({
      query: (accountId) => ({ url: `/v1/accounts/${accountId}/reports/wsr`, method: "POST" }),
      invalidatesTags: (_result, _error, accountId) => [{ type: "Reports", id: accountId }],
    }),
    /** `format` picks the rendition the download is minted for; the deck by default. */
    reportPack: build.query<ReportPack, { id: string; format?: PackFormat }>({
      query: ({ id, format }) => ({
        url: `/v1/reports/packs/${id}`,
        params: format === "pdf" ? { format: "pdf" } : undefined,
      }),
      providesTags: (_result, _error, { id, format }) => [{ type: "Reports", id: `pack:${id}:${format ?? "pptx"}` }],
    }),
    portalDashboard: build.query<PortalDashboard, { days?: number } | void>({
      query: (params) => ({ url: "/v1/portal/dashboard", params: { days: params?.days ?? 30 } }),
      providesTags: [{ type: "Dashboards", id: "portal" }],
    }),
    accountCsat: build.query<AccountCsat, CsatParams>({
      query: ({ accountId, from, to }) => ({
        url: `/v1/accounts/${accountId}/csat`,
        params: { ...(from ? { from } : {}), ...(to ? { to } : {}) },
      }),
      providesTags: (_result, _error, { accountId }) => [csatTag(accountId)],
    }),
    reportSchedules: build.query<ReportSchedule[], string>({
      query: (accountId) => ({ url: "/v1/reporting/schedules", params: { account: accountId } }),
      providesTags: (_result, _error, accountId) => [schedulesTag(accountId)],
    }),
    createReportSchedule: build.mutation<ReportSchedule, CreateScheduleBody>({
      query: (body) => ({ url: "/v1/reporting/schedules", method: "POST", body }),
      invalidatesTags: (_result, error, { account_id }) => (error ? [] : [schedulesTag(account_id)]),
    }),
    /** The version travels with every patch; a stale_version refusal reloads the list either way. */
    patchReportSchedule: build.mutation<ReportSchedule, { id: string; accountId: string; body: PatchScheduleBody }>({
      query: ({ id, body }) => ({ url: `/v1/reporting/schedules/${id}`, method: "PATCH", body }),
      invalidatesTags: (_result, _error, { accountId }) => [schedulesTag(accountId)],
    }),
    runScheduleNow: build.mutation<RunNowResult, { id: string; accountId: string; body: RunNowBody }>({
      query: ({ id, body }) => ({ url: `/v1/reporting/schedules/${id}/run-now`, method: "POST", body }),
      invalidatesTags: (_result, error, { accountId }) =>
        error
          ? []
          : [schedulesTag(accountId), runsTag(accountId), runsTag(undefined), { type: "Reports", id: accountId }],
    }),
    scheduleRuns: build.query<ScheduleRun[], RunsFilter>({
      query: (filter) => ({
        url: "/v1/reporting/runs",
        params: {
          ...(filter.account ? { account: filter.account } : {}),
          ...(filter.status ? { status: filter.status } : {}),
          ...(filter.schedule ? { schedule: filter.schedule } : {}),
        },
      }),
      providesTags: (_result, _error, filter) => [runsTag(filter.account)],
    }),
    /** One run with its frozen pack and a presigned link per rendition (functional 5.8). */
    reviewRun: build.query<ReviewRun, string>({
      query: (id) => `/v1/reporting/runs/${id}`,
      providesTags: (_result, _error, id) => [runTag(id)],
    }),
    /** Approve and send: the held pack goes out exactly as it was rendered. */
    approveReportRun: build.mutation<RunNowResult, { id: string; accountId?: string }>({
      query: ({ id }) => ({ url: `/v1/reporting/runs/${id}/approve`, method: "POST" }),
      invalidatesTags: (_result, _error, { id, accountId }) => reviewTags(id, accountId),
    }),
    /** Cancel with a reason: nothing is delivered and the reason stays on the run. */
    cancelReportRun: build.mutation<CancelRunResult, { id: string; accountId?: string; reason: string }>({
      query: ({ id, reason }) => ({ url: `/v1/reporting/runs/${id}/cancel`, method: "POST", body: { reason } }),
      invalidatesTags: (_result, _error, { id, accountId }) => reviewTags(id, accountId),
    }),
  }),
  overrideExisting: false,
});

export const {
  useOperationsDashboardQuery,
  useAccountDashboardQuery,
  useSecurityDashboardQuery,
  useUsageDashboardQuery,
  useAuditSearchQuery,
  useLazyAuditSearchQuery,
  useReportRunsQuery,
  useGenerateWsrMutation,
  useReportPackQuery,
  useLazyReportPackQuery,
  usePortalDashboardQuery,
  useAccountCsatQuery,
  useReportSchedulesQuery,
  useCreateReportScheduleMutation,
  usePatchReportScheduleMutation,
  useRunScheduleNowMutation,
  useScheduleRunsQuery,
  useReviewRunQuery,
  useApproveReportRunMutation,
  useCancelReportRunMutation,
} = reportingApi;
