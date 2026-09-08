import type {
  BatchDetail,
  MigrationBatch,
  MigrationRecord,
  ReconciliationReport,
  ReportLine,
} from "@/redux/migrationApi";

/** Constructed migration console fixtures, shared by every test that reads one. */

/** Constructed migration fixtures shared by the console tests. */
export const ACCOUNT_ID = "77777777-7777-4777-8777-777777777777";

export const INSTANCE_ID = "11111111-1111-4111-8111-111111111111";

export const BATCH_ID = "88888888-8888-4888-8888-888888888888";

export const RECORD_ID = "99999999-9999-4999-8999-999999999999";

export const REPORT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

export function aBatch(overrides: Partial<MigrationBatch> = {}): MigrationBatch {
  return {
    id: BATCH_ID,
    account_id: ACCOUNT_ID,
    object_kind: "case",
    source_kind: "servicenow_table_api",
    source_ref: { instance_id: INSTANCE_ID, instance_name: "Brookfield CSM", table_name: "sn_customerservice_case" },
    source_range: { opened_from: "2025-01-01", opened_to: "2025-12-31" },
    map_versions: { field_map_id: "map-1", state_map_id: "map-2" },
    dry_run: true,
    status: "draft",
    counts: { extracted: 0, loaded: 0, updated: 0, skipped: 0, unmatched: 0, errors: 0 },
    checkpoint: null,
    supersedes_batch_id: null,
    lease_owner: null,
    lease_until: null,
    started_at: null,
    finished_at: null,
    run_by: "user-1",
    run_by_name: "Cara Lee",
    error: null,
    log: [],
    version: 1,
    created_at: "2026-09-07T09:00:00Z",
    updated_at: "2026-09-07T09:00:00Z",
    ...overrides,
  };
}

export function aBatchDetail(overrides: Partial<BatchDetail> = {}): BatchDetail {
  return { ...aBatch(), report: null, ...overrides };
}

export function aRecord(overrides: Partial<MigrationRecord> = {}): MigrationRecord {
  return {
    id: RECORD_ID,
    account_id: ACCOUNT_ID,
    batch_id: BATCH_ID,
    object_kind: "case",
    source_id: "sys-abc123",
    source_key: "CS0012345",
    target_table: null,
    target_id: null,
    status: "pending",
    message: "dry run: would load",
    source_payload_key: `accounts/${ACCOUNT_ID}/migration/${BATCH_ID}/raw/sys-abc123.json`,
    source_hash: "deadbeef",
    source_timestamp: "2025-03-11T10:00:00Z",
    created_at: "2026-09-07T09:05:00Z",
    ...overrides,
  };
}

export function aLine(overrides: Partial<ReportLine> = {}): ReportLine {
  return {
    kind: "count_by_state",
    subject: "closed",
    source_figure: 1,
    target_figure: 1,
    delta: 0,
    status: "matched",
    ...overrides,
  };
}

export function aReport(overrides: Partial<ReconciliationReport> = {}): ReconciliationReport {
  return {
    id: REPORT_ID,
    account_id: ACCOUNT_ID,
    scope: "batch",
    batch_id: BATCH_ID,
    status: "open",
    snapshot_key: null,
    signed_by: null,
    signed_by_name: null,
    signed_at: null,
    lines: [
      aLine(),
      aLine({ subject: "in_progress" }),
      aLine({ kind: "count_by_object", subject: "comments", source_figure: 3, target_figure: 3 }),
    ],
    can_sign: true,
    sign_blocker: null,
    version: 1,
    created_at: "2026-09-07T09:10:00Z",
    updated_at: "2026-09-07T09:10:00Z",
    ...overrides,
  };
}
