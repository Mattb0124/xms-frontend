import { apiError, describeError, type ApiError } from "@/lib/admin/api-error";

/**
 * The typed error bodies of the migration routes (Data Migration technical
 * section 4, as built). Handlers branch on `code`; the copy lives here so
 * the console says the same thing everywhere. Two of them are the
 * reconciliation's rules: `signer_ran_batch` (403, four eyes) and
 * `delta_open` (409, every line must be matched or explained first).
 */
export type MigrationErrorCode =
  | "bad_range"
  | "no_active_field_map"
  | "batch_not_runnable"
  | "report_signed"
  | "signer_ran_batch"
  | "delta_open"
  | "stale_version"
  | "not_found";

export interface MigrationError extends ApiError {
  /** batch_not_runnable carries the batch status. */
  status_value?: string;
  /** not_found names the entity (connector_instance, import_batch, line, ...). */
  entity?: string;
}

export function migrationError(error: unknown): MigrationError {
  const parsed = apiError(error) as MigrationError;
  const data = (error as { data?: Record<string, unknown> })?.data;
  if (data && typeof data === "object") {
    if (typeof data.status === "string") parsed.status_value = data.status;
    if (typeof data.entity === "string") parsed.entity = data.entity;
  }
  return parsed;
}

export function describeMigrationError(error: MigrationError): string {
  switch (error.code) {
    case "bad_range":
      return "The range needs two ISO dates, and the end must not be before the start.";
    case "no_active_field_map":
      return "The instance has no active field map. Activate one on the connector record first.";
    case "batch_not_runnable":
      return error.status_value
        ? `This batch is ${error.status_value.replace(/_/g, " ")} and cannot be run again.`
        : "This batch cannot be run from its current status.";
    case "report_signed":
      return "This report is signed off and frozen.";
    case "signer_ran_batch":
      return "The person who ran the batch cannot sign its report. A second administrator must sign.";
    case "delta_open":
      return "Every line must be matched or have an explanation before the report can be signed.";
    case "not_found":
      if (error.entity === "connector_instance") return "That connector instance is not on the chosen account.";
      if (error.entity === "import_batch") return "This batch does not exist or is not on your accounts.";
      if (error.entity === "line") return "That line is no longer on the report.";
      return "Not found.";
    default:
      return describeError(error);
  }
}
