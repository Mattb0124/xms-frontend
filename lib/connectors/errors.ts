import { apiError, describeError, type ApiError } from "@/lib/admin/api-error";

/**
 * The typed error bodies of the connector routes (ServiceNow Sync technical
 * section 4). Handlers branch on `code`; the copy lives here so every screen
 * says the same thing.
 */
export type ConnectorErrorCode =
  | "no_active_field_map"
  | "no_active_state_map"
  | "credential_not_valid"
  | "bad_status"
  | "stale_version"
  | "map_immutable"
  | "map_not_validated"
  | "map_not_draft"
  | "credential_incomplete"
  | "bad_watermark";

export interface ConnectorError extends ApiError {
  /** credential_incomplete names the missing credential fields. */
  needs?: string[];
  /** map_immutable and map_not_validated carry the map's state. */
  state?: string;
  /** credential_not_valid names the state the credential is in (unknown or invalid). */
  credential_state?: string;
  detail?: string;
}

export function connectorError(error: unknown): ConnectorError {
  const parsed = apiError(error) as ConnectorError;
  const data = (error as { data?: Record<string, unknown> })?.data;
  if (data && typeof data === "object") {
    if (Array.isArray(data.needs)) parsed.needs = data.needs.map(String);
    if (typeof data.state === "string") parsed.state = data.state;
    if (typeof data.credential_state === "string") parsed.credential_state = data.credential_state;
    if (typeof data.detail === "string") parsed.detail = data.detail;
  }
  return parsed;
}

export function describeConnectorError(error: ConnectorError): string {
  switch (error.code) {
    case "no_active_field_map":
      return "Activate a field map before switching the mode on.";
    case "no_active_state_map":
      return "Bidirectional mode sends XMS states to the client, so activate a state map first.";
    case "credential_not_valid":
      return error.credential_state === "invalid"
        ? "The instance refused this credential. Fix it in Settings, then test the connection again."
        : "Run Test connection first: bidirectional mode needs a credential the instance has accepted.";
    case "bad_status":
      return "That is not a status the outbound queue keeps.";
    case "map_immutable":
      return `This version is ${error.state ?? "active"} and cannot be edited. Create a new draft.`;
    case "map_not_validated":
      return "Validate this version before activating it.";
    case "map_not_draft":
      return "Samples are stored on draft versions only.";
    case "credential_incomplete":
      return error.needs && error.needs.length > 0
        ? `The credential needs ${error.needs.join(" and ")}.`
        : "The credential is incomplete.";
    case "bad_watermark":
      return "The watermark must be a valid date and time.";
    default:
      return describeError(error);
  }
}
