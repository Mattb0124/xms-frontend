import type { SignalTone } from "@/components/xms/signal-pill";
import type {
  BatchStatus,
  LineKind,
  LineStatus,
  MigrationBatch,
  RecordStatus,
  ReportScope,
  ReportStatus,
  SourceKind,
} from "@/redux/migrationApi";

/**
 * The migration vocabulary (Data Migration functional 5.1) and the tones
 * each value takes on the `--state-*` signal trios. Text carries the
 * meaning; colour only reinforces it. The server decides what a batch may
 * do; these helpers only mirror its rules for display.
 */
export const BATCH_STATUSES: { value: BatchStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "extracting", label: "Extracting" },
  { value: "extracted", label: "Extracted" },
  { value: "mapping", label: "Mapping" },
  { value: "mapped", label: "Mapped" },
  { value: "loading", label: "Loading" },
  { value: "loaded", label: "Loaded" },
  { value: "reconciling", label: "Reconciling" },
  { value: "reconciled", label: "Reconciled" },
  { value: "signed_off", label: "Signed off" },
  { value: "failed", label: "Failed" },
  { value: "superseded", label: "Superseded" },
];

/** Statuses the run holds while it is moving; the record polls on these. */
export const RUNNING_STATUSES: readonly BatchStatus[] = [
  "extracting",
  "extracted",
  "mapping",
  "mapped",
  "loading",
  "loaded",
  "reconciling",
];

/** The API runs a batch only from draft or failed (batch_not_runnable otherwise). */
export const RUNNABLE_STATUSES: readonly BatchStatus[] = ["draft", "failed"];

export function isRunning(status: BatchStatus): boolean {
  return RUNNING_STATUSES.includes(status);
}

export function isRunnable(status: BatchStatus): boolean {
  return RUNNABLE_STATUSES.includes(status);
}

/** Why the Run button is off, in the words the server would use. */
export function runBlockedReason(batch: Pick<MigrationBatch, "status">): string | null {
  if (isRunnable(batch.status)) return null;
  if (isRunning(batch.status)) return "This batch is running.";
  if (batch.status === "superseded") return "A later batch over the same range superseded this one.";
  if (batch.status === "signed_off") return "This batch is signed off; create a new batch to load again.";
  return "This batch has already run; create a new batch to run it again.";
}

export function batchStatusLabel(status: BatchStatus): string {
  return BATCH_STATUSES.find((entry) => entry.value === status)?.label ?? status;
}

export function batchStatusTone(status: BatchStatus): SignalTone {
  switch (status) {
    case "signed_off":
      return "complete";
    case "reconciled":
      return "ready";
    case "failed":
      return "overdue";
    case "draft":
      return "needs-input";
    case "superseded":
      return "blocked";
    default:
      return "ready";
  }
}

export const RECORD_STATUSES: { value: RecordStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "loaded", label: "Loaded" },
  { value: "updated", label: "Updated" },
  { value: "skipped", label: "Skipped" },
  { value: "unmatched", label: "Unmatched" },
  { value: "error", label: "Error" },
];

export function recordStatusLabel(status: RecordStatus): string {
  return RECORD_STATUSES.find((entry) => entry.value === status)?.label ?? status;
}

export function recordStatusTone(status: RecordStatus): SignalTone {
  switch (status) {
    case "loaded":
    case "updated":
      return "complete";
    case "skipped":
      return "blocked";
    case "unmatched":
      return "needs-input";
    case "error":
      return "overdue";
    default:
      return "ready";
  }
}

export const LINE_STATUS_LABEL: Record<LineStatus, string> = {
  matched: "Matched",
  delta_explained: "Delta explained",
  delta_open: "Delta open",
};

export function lineStatusTone(status: LineStatus): SignalTone {
  switch (status) {
    case "matched":
      return "complete";
    case "delta_explained":
      return "ready";
    default:
      return "overdue";
  }
}

export const LINE_KIND_LABEL: Record<LineKind, string> = {
  count_by_state: "Count by state",
  count_by_object: "Count by object",
  hours_by_contract_period: "Hours by contract period",
  balance_by_contract_period: "Balance by contract period",
};

export const REPORT_SCOPES: { value: ReportScope; label: string }[] = [
  { value: "batch", label: "Batch" },
  { value: "account", label: "Account" },
  { value: "delta", label: "Delta" },
];

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  pending: "Pending",
  open: "Open",
  signed_off: "Signed off",
};

export function reportStatusTone(status: ReportStatus): SignalTone {
  switch (status) {
    case "signed_off":
      return "complete";
    case "open":
      return "ready";
    default:
      return "needs-input";
  }
}

/** Object kinds the console offers; the API loads cases only in this cut. */
export const OBJECT_KINDS: { value: string; label: string; available: boolean }[] = [
  { value: "case", label: "Cases", available: true },
  { value: "contact", label: "Contacts", available: false },
  { value: "attachment", label: "Attachments", available: false },
  { value: "time_record", label: "Time records", available: false },
  { value: "contract_period_balance", label: "Contract period balances", available: false },
];

export function objectKindLabel(kind: string): string {
  return OBJECT_KINDS.find((entry) => entry.value === kind)?.label ?? kind;
}

export const SOURCE_KINDS: { value: SourceKind; label: string; available: boolean }[] = [
  { value: "servicenow_table_api", label: "ServiceNow table API", available: true },
  { value: "servicenow_export_files", label: "ServiceNow export files", available: false },
  { value: "finance_workbook", label: "Finance workbook", available: false },
];

export function sourceKindLabel(kind: SourceKind): string {
  return SOURCE_KINDS.find((entry) => entry.value === kind)?.label ?? kind;
}

/** "2025-01-01 to 2025-12-31" from the batch's source range. */
export function describeRange(range: Record<string, unknown>): string {
  const from = typeof range.opened_from === "string" ? range.opened_from : "";
  const to = typeof range.opened_to === "string" ? range.opened_to : "";
  if (!from && !to) return "";
  return `${from || "start"} to ${to || "now"}`;
}

/** The source instance name and table from the batch's source reference. */
export function describeSource(batch: Pick<MigrationBatch, "source_kind" | "source_ref">): string {
  const name = typeof batch.source_ref.instance_name === "string" ? batch.source_ref.instance_name : "";
  const table = typeof batch.source_ref.table_name === "string" ? batch.source_ref.table_name : "";
  if (!name) return sourceKindLabel(batch.source_kind);
  return table ? `${name} (${table})` : name;
}

/** Signed delta with its sign, so a zero reads as 0 and a shortfall as -2. */
export function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}
