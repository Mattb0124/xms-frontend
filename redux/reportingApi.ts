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

export interface SecurityDashboard {
  by_type: Array<{ event_type: string; outcome: string; n: number }>;
  signin_failures: Array<{ actor_id: string; ip_hash: string | null; n: number }>;
  isolation_probes: Array<{ actor_id: string; n: number }>;
}

export interface UsageCount {
  key: string;
  n: number;
}

export interface UsageDashboard {
  active_users?: UsageCount[];
  actions?: UsageCount[];
  screens?: UsageCount[];
  no_result_searches?: UsageCount[];
  api_errors?: UsageCount[];
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

export type AuditOperator = "eq" | "neq" | "in" | "contains" | "before" | "after";

export interface AuditCondition {
  field: AuditField;
  op: AuditOperator;
  value: string | string[];
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

export interface ReportPack {
  id: string;
  period_start: string;
  period_end: string;
  measures: Measures;
  notable: Notable[];
  narrative_versions: NarrativeVersion[];
  download: string | null;
}

export interface PortalDashboard {
  period: Period;
  measures: Partial<Measures>;
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
    reportPack: build.query<ReportPack, string>({
      query: (id) => `/v1/reports/packs/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Reports", id: `pack:${id}` }],
    }),
    portalDashboard: build.query<PortalDashboard, { days?: number } | void>({
      query: (params) => ({ url: "/v1/portal/dashboard", params: { days: params?.days ?? 30 } }),
      providesTags: [{ type: "Dashboards", id: "portal" }],
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
  usePortalDashboardQuery,
} = reportingApi;
