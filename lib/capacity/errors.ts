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
  | "not_found"
  | "bad_lens"
  | "subject_required"
  | "invalid_import"
  | "unknown_account";

export interface ImportProblem {
  line: number;
  problem: string;
}

export interface CapacityError extends ApiError {
  /** stale_version carries the version the server holds. */
  current?: number;
  /** forbidden on a cell carries the account the principal is not granted. */
  accountId?: string;
  /** not_found names the entity (pto, person, allocation, demand, account). */
  entity?: string;
  /** invalid_import lists every problem with its line; nothing imported. */
  problems?: ImportProblem[];
  /** unknown_account lists the keys the file named that are unknown or not granted. */
  keys?: string[];
}

export function capacityError(error: unknown): CapacityError {
  const parsed = apiError(error) as CapacityError;
  const data = (error as { data?: Record<string, unknown> })?.data;
  if (data && typeof data === "object") {
    if (typeof data.current === "number") parsed.current = data.current;
    if (typeof data.account_id === "string") parsed.accountId = data.account_id;
    if (typeof data.entity === "string") parsed.entity = data.entity;
    if (Array.isArray(data.problems))
      parsed.problems = data.problems
        .filter((row): row is ImportProblem => typeof row === "object" && row !== null && "problem" in row)
        .map((row) => ({ line: Number(row.line), problem: String(row.problem) }));
    if (Array.isArray(data.keys)) parsed.keys = data.keys.map(String);
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
      if (error.permission === "capacity:manage")
        return "Only the person themselves or a capacity manager may change this.";
      return describeError(error);
    case "not_found":
      if (error.entity === "pto") return "That time off has already been removed.";
      if (error.entity === "person") return "This person is not on the roster.";
      if (error.entity === "account") return "That account is not granted to you.";
      if (error.entity === "demand") return "That demand line has already been removed.";
      return "Not found.";
    case "bad_lens":
      return "The lens must be people or account.";
    case "subject_required":
      return "Name an account or a prospect.";
    case "invalid_import":
      return `The file has ${error.problems?.length ?? 0} problem${error.problems?.length === 1 ? "" : "s"}; nothing was imported.`;
    case "unknown_account":
      return error.keys && error.keys.length > 0
        ? `Unknown or not granted account key${error.keys.length === 1 ? "" : "s"}: ${error.keys.join(", ")}. Nothing was imported.`
        : "The file names an account that is unknown or not granted. Nothing was imported.";
    default:
      return describeError(error);
  }
}
