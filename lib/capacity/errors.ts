import { apiError, describeError, type ApiError } from "@/lib/admin/api-error";

/**
 * The typed error bodies of the capacity routes (Capacity & Allocation
 * technical section 4). Handlers branch on `code`; the copy lives here so
 * the PTO tab, the grid and the picker say the same thing.
 */
export type CapacityErrorCode =
  | "invalid_range"
  | "bad_month"
  | "person_ids_required"
  | "stale_version"
  | "forbidden"
  | "not_found";

export interface CapacityError extends ApiError {
  /** stale_version carries the version the server holds. */
  current?: number;
  /** forbidden on a cell carries the account the principal is not granted. */
  accountId?: string;
  /** not_found names the entity (pto, person, allocation). */
  entity?: string;
}

export function capacityError(error: unknown): CapacityError {
  const parsed = apiError(error) as CapacityError;
  const data = (error as { data?: Record<string, unknown> })?.data;
  if (data && typeof data === "object") {
    if (typeof data.current === "number") parsed.current = data.current;
    if (typeof data.account_id === "string") parsed.accountId = data.account_id;
    if (typeof data.entity === "string") parsed.entity = data.entity;
  }
  return parsed;
}

export function describeCapacityError(error: CapacityError): string {
  switch (error.code) {
    case "invalid_range":
      return "The time off must end on or after it starts.";
    case "bad_month":
      return "The month must be written as YYYY-MM.";
    case "person_ids_required":
      return "Pick at least one person to check.";
    case "stale_version":
      return "Someone else changed the allocations. They have been reloaded.";
    case "forbidden":
      if (error.accountId) return "You are not granted that account, so its cells cannot be written.";
      if (error.permission === "capacity:manage") return "Only the person themselves or a capacity manager may change this.";
      return describeError(error);
    case "not_found":
      if (error.entity === "pto") return "That time off has already been removed.";
      if (error.entity === "person") return "This person is not on the roster.";
      return "Not found.";
    default:
      return describeError(error);
  }
}
