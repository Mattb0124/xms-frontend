import { apiError, describeError, type ApiError } from "@/lib/admin/api-error";

/**
 * The typed error bodies of the configuration routes (Accounts &
 * Administration technical 3.4). `invalid_config` carries the server's
 * problem list in its own words, which the editor shows under the body.
 */
export type ConfigErrorCode = "invalid_config" | "unknown_config_kind" | "config_missing" | "not_found";

export interface ConfigError extends ApiError {
  /** invalid_config lists what is wrong, one line each, in the server's words. */
  problems?: string[];
  kind?: string;
  entity?: string;
}

export function configError(error: unknown): ConfigError {
  const parsed = apiError(error) as ConfigError;
  const data = (error as { data?: Record<string, unknown> })?.data;
  if (data && typeof data === "object") {
    if (Array.isArray(data.problems)) parsed.problems = data.problems.map(String);
    if (typeof data.kind === "string") parsed.kind = data.kind;
    if (typeof data.entity === "string") parsed.entity = data.entity;
  }
  return parsed;
}

export function describeConfigError(error: ConfigError): string {
  switch (error.code) {
    case "invalid_config":
      return error.problems && error.problems.length > 0
        ? `The body was refused: ${error.problems.join("; ")}.`
        : "The body was refused by the server's validation.";
    case "unknown_config_kind":
      return error.kind ? `${error.kind} is not a configuration kind.` : "Unknown configuration kind.";
    case "config_missing":
      return "No active default exists for this catalog. Run the seed first.";
    case "not_found":
      if (error.entity === "config_override") return "There is no override to remove; the default already applies.";
      return "Not found.";
    default:
      return describeError(error);
  }
}
