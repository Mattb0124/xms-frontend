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
    case "network":
      return "The API could not be reached.";
    default:
      return `The request failed (${error.code}).`;
  }
}
