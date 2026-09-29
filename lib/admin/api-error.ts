/**
 * Reads the typed error body the API returns ({ code, requestId, ... }) out
 * of an RTK Query error. Every handler branches on `code`, never on text.
 */
export interface ApiError {
  status: number | string;
  code: string;
  details?: string[];
  permission?: string;
  requestId?: string;
  /** `range_too_wide` names the widest span the route will read. */
  maxDays?: number;
  /** `form_data_too_large` and its kin name the ceiling in bytes. */
  maxBytes?: number;
}

export function apiError(error: unknown): ApiError {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status: number | string }).status;
    const data = (error as { data?: unknown }).data;
    if (typeof data === "object" && data !== null) {
      const body = data as Partial<ApiError> & { code?: unknown };
      return {
        status,
        code: typeof body.code === "string" ? body.code : "error",
        details: Array.isArray(body.details) ? body.details.map(String) : undefined,
        permission: typeof body.permission === "string" ? body.permission : undefined,
        requestId: typeof body.requestId === "string" ? body.requestId : undefined,
        maxDays:
          typeof (body as { max_days?: unknown }).max_days === "number"
            ? (body as { max_days: number }).max_days
            : undefined,
        maxBytes:
          typeof (body as { max_bytes?: unknown }).max_bytes === "number"
            ? (body as { max_bytes: number }).max_bytes
            : undefined,
      };
    }
    return { status, code: status === "FETCH_ERROR" ? "network" : "error" };
  }
  return { status: "unknown", code: "error" };
}

/** Plain-language line for an error toast; codes map to fixed copy. */
export function describeError(error: ApiError): string {
  switch (error.code) {
    case "stale_version":
      return "Someone else changed this record. It has been reloaded.";
    case "last_administrator":
      return "The last active administrator cannot be removed or deactivated.";
    case "validation_failed":
      return error.details?.join("; ") ?? "The request was not valid.";
    case "forbidden":
      return error.permission ? `You need the ${error.permission} permission.` : "Not permitted.";
    case "email_in_use":
      return "A user with that email already exists.";
    case "invalid_transition":
      return "That status change is not allowed from the current status.";
    case "conflict":
      return "That value is already in use.";
    case "reason_required":
      return "This change is recorded, so it needs a reason.";
    case "range_too_wide":
      return error.maxDays
        ? `That is a wider span than this reads: ${error.maxDays} days at a time.`
        : "That is a wider span than this reads.";
    case "invalid_range":
      return "The end of that range is not after its start.";
    case "form_data_too_large":
      return error.maxBytes
        ? `There is more here than the form holds (${Math.round(error.maxBytes / 1024)} kB). Shorten the longest answers.`
        : "There is more here than the form holds. Shorten the longest answers.";
    case "upload_expired":
      return "The upload link had expired. Choose the file again.";
    case "network":
      return "The API could not be reached.";
    default:
      return `The request failed (${error.code}).`;
  }
}
