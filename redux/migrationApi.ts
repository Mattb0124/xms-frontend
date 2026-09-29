import { xmsApi } from "@/redux/api";

/**
 * The migration console (Data Migration technical section 4; P2.22.1 cut):
 * batches, their per-record results, and the reconciliation reports with
 * explain and sign-off. Every route needs `admin:migration`. A run happens
 * inside the request and answers with the finished batch, so the record
 * only polls while a status says it is still moving. Sign-off and explain
 * carry the report's `version` (optimistic concurrency).
 */
export type BatchStatus =
  | "draft"
  | "extracting"
  | "extracted"
  | "mapping"
  | "mapped"
  | "loading"
  | "loaded"
  | "reconciling"
  | "reconciled"
  | "signed_off"
  | "failed"
  | "superseded";

export type SourceKind = "servicenow_table_api" | "servicenow_export_files" | "finance_workbook";

export type RecordStatus = "pending" | "loaded" | "updated" | "skipped" | "unmatched" | "error";

export type LineKind = "count_by_state" | "count_by_object" | "hours_by_contract_period" | "balance_by_contract_period";

export type LineStatus = "matched" | "delta_explained" | "delta_open";

export type ReportScope = "batch" | "account" | "delta";

export type ReportStatus = "pending" | "open" | "signed_off";

export interface BatchCounts {
  extracted: number;
  loaded: number;
  updated: number;
  skipped: number;
  unmatched: number;
  errors: number;
}

export interface BatchLogEntry {
  at: string;
  message: string;
}

export interface MigrationBatch {
  id: string;
  account_id: string;
  object_kind: string;
  source_kind: SourceKind;
  /** For the table API: instance_id, instance_name, table_name. */
  source_ref: Record<string, unknown>;
  /** For cases: opened_from, opened_to (ISO dates). */
  source_range: Record<string, unknown>;
  /** field_map_id and state_map_id used by the run. */
  map_versions: Record<string, unknown>;
  dry_run: boolean;
  status: BatchStatus;
  counts: BatchCounts;
  checkpoint: Record<string, unknown> | null;
  supersedes_batch_id: string | null;
  lease_owner: string | null;
  lease_until: string | null;
  started_at: string | null;
  finished_at: string | null;
  run_by: string | null;
  /** The runner's display name, resolved by the server; null when unknown. */
  run_by_name: string | null;
  error: string | null;
  log: BatchLogEntry[];
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ReportLine {
  kind: LineKind;
  subject: string;
  source_figure: number;
  target_figure: number;
  delta: number;
  status: LineStatus;
  explanation?: string | null;
  explained_by?: string | null;
  /** The explainer's display name, resolved by the server; null when unknown. */
  explained_by_name?: string | null;
  explained_at?: string | null;
}

/**
 * Why the reader cannot sign this report, decided by the server up front:
 * it is signed already, the reader ran the batch (four eyes), or a delta is
 * still open. Null when the reader may sign.
 */
export type SignBlocker = "report_signed" | "signer_ran_batch" | "delta_open";

export interface ReconciliationReport {
  id: string;
  account_id: string;
  scope: ReportScope;
  batch_id: string | null;
  status: ReportStatus;
  snapshot_key: string | null;
  signed_by: string | null;
  /** The signer's display name, resolved by the server; null when unsigned or unknown. */
  signed_by_name: string | null;
  signed_at: string | null;
  lines: ReportLine[];
  can_sign: boolean;
  sign_blocker: SignBlocker | null;
  version: number;
  created_at: string;
  updated_at: string;
}

/** The batch record: the row plus its latest reconciliation report, when one exists. */
export interface BatchDetail extends MigrationBatch {
  report: ReconciliationReport | null;
}

export interface MigrationRecord {
  id: string;
  account_id: string;
  batch_id: string;
  object_kind: string;
  source_id: string;
  source_key: string | null;
  target_table: string | null;
  target_id: string | null;
  status: RecordStatus;
  message: string | null;
  source_payload_key: string | null;
  source_hash: string;
  source_timestamp: string | null;
  created_at: string;
}

/** One record with its raw source payload read back from the object store (null when missing). */
export interface RecordDetail extends MigrationRecord {
  payload: unknown;
}

export interface BatchFilter {
  account_id?: string;
  object_kind?: string;
  status?: string;
}

export interface CreateBatchBody {
  account_id: string;
  instance_id: string;
  object_kind?: "case";
  /** ISO dates, inclusive. */
  opened_from: string;
  opened_to: string;
  dry_run?: boolean;
  supersedes_batch_id?: string;
}

export interface RecordsFilter {
  id: string;
  status?: RecordStatus | string;
  q?: string;
}

export interface ReportsFilter {
  account_id: string;
  scope?: ReportScope | string;
}

export interface ExplainBody {
  id: string;
  line: number;
  explanation: string;
  version: number;
}

function definedParams(params: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(params).filter((entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== ""),
  );
}

function reportTags(report: ReconciliationReport | undefined) {
  return [
    { type: "Reconciliation" as const, id: report ? `account:${report.account_id}` : "LIST" },
    ...(report?.batch_id ? [{ type: "MigrationBatch" as const, id: report.batch_id }] : []),
  ];
}

export const migrationApi = xmsApi.injectEndpoints({
  endpoints: (build) => ({
    listBatches: build.query<MigrationBatch[], BatchFilter | void>({
      query: (filter) => ({ url: "/v1/migration/batches", params: definedParams({ ...(filter ?? {}) }) }),
      providesTags: (result) => [
        "MigrationBatches",
        ...(result ?? []).map((row) => ({ type: "MigrationBatch" as const, id: row.id })),
      ],
    }),
    createBatch: build.mutation<MigrationBatch, CreateBatchBody>({
      query: (body) => ({ url: "/v1/migration/batches", method: "POST", body }),
      invalidatesTags: ["MigrationBatches"],
    }),
    getBatch: build.query<BatchDetail, string>({
      query: (id) => `/v1/migration/batches/${id}`,
      providesTags: (_result, _error, id) => [{ type: "MigrationBatch", id }],
    }),
    runBatch: build.mutation<BatchDetail, string>({
      query: (id) => ({ url: `/v1/migration/batches/${id}/run`, method: "POST" }),
      invalidatesTags: (result, _error, id) => [
        { type: "MigrationBatch", id },
        "MigrationBatches",
        { type: "MigrationRecords", id },
        { type: "Reconciliation", id: result ? `account:${result.account_id}` : "LIST" },
      ],
    }),
    listRecords: build.query<MigrationRecord[], RecordsFilter>({
      query: ({ id, ...filter }) => ({ url: `/v1/migration/batches/${id}/records`, params: definedParams(filter) }),
      providesTags: (_result, _error, { id }) => [{ type: "MigrationRecords", id }],
    }),
    getRecord: build.query<RecordDetail, { id: string; recordId: string }>({
      query: ({ id, recordId }) => `/v1/migration/batches/${id}/records/${recordId}`,
      providesTags: (_result, _error, { id, recordId }) => [{ type: "MigrationRecords", id: `${id}:${recordId}` }],
    }),
    listReports: build.query<ReconciliationReport[], ReportsFilter>({
      query: (filter) => ({ url: "/v1/migration/reconciliation", params: definedParams({ ...filter }) }),
      providesTags: (_result, _error, { account_id }) => [
        { type: "Reconciliation", id: `account:${account_id}` },
        { type: "Reconciliation", id: "LIST" },
      ],
    }),
    explainLine: build.mutation<ReconciliationReport, ExplainBody>({
      query: ({ id, line, explanation, version }) => ({
        url: `/v1/migration/reconciliation/${id}/lines/${line}/explain`,
        method: "POST",
        body: { explanation, version },
      }),
      invalidatesTags: (result) => reportTags(result),
    }),
    signOffReport: build.mutation<ReconciliationReport, { id: string; version: number }>({
      query: ({ id, version }) => ({
        url: `/v1/migration/reconciliation/${id}/sign-off`,
        method: "POST",
        body: { version },
      }),
      invalidatesTags: (result) => [...reportTags(result), "MigrationBatches"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListBatchesQuery,
  useCreateBatchMutation,
  useGetBatchQuery,
  useRunBatchMutation,
  useListRecordsQuery,
  useGetRecordQuery,
  useListReportsQuery,
  useExplainLineMutation,
  useSignOffReportMutation,
} = migrationApi;
