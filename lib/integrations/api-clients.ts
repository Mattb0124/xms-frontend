import type { SignalTone } from "@/components/xms/signal-pill";
import { apiError, describeError, type ApiError } from "@/lib/admin/api-error";
import type { ApiClientStatus, CreateApiClientBody } from "@/redux/apiClientsApi";

/**
 * The API client vocabulary (Accounts & Administration functional 5.9,
 * Integrations functional 5.4): the two statuses, the draft the form keeps,
 * the create body the API takes, and the refusals in words. The server holds
 * the scope catalog, so nothing here names a scope.
 */
export const API_CLIENT_STATUS: Record<ApiClientStatus, { label: string; tone: SignalTone }> = {
  active: { label: "Active", tone: "ready" },
  revoked: { label: "Revoked", tone: "blocked" },
};

export interface ApiClientDraft {
  name: string;
  scopes: string[];
  accountIds: string[];
  /** A calendar date from the form, empty for no expiry. */
  expiresOn: string;
}

export const emptyApiClientDraft: ApiClientDraft = { name: "", scopes: [], accountIds: [], expiresOn: "" };

export function toggle(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

/** The checks the API makes, made here first so the form can say what is missing. */
export function validateApiClient(draft: ApiClientDraft): string | null {
  if (draft.name.trim().length === 0) return "Give the client a name.";
  if (draft.scopes.length === 0) return "Choose at least one scope.";
  if (draft.accountIds.length === 0) return "Grant the client at least one account.";
  return null;
}

export function apiClientBody(draft: ApiClientDraft): CreateApiClientBody {
  return {
    name: draft.name.trim(),
    scopes: draft.scopes,
    account_ids: draft.accountIds,
    ...(draft.expiresOn ? { expires_at: draft.expiresOn } : {}),
  };
}

/** "Never used" before the first call, else the day and minute the API recorded. */
export function lastUsedLabel(value: string | null): string {
  return value ? value.slice(0, 16).replace("T", " ") : "Never used";
}

export function expiryLabel(value: string | null): string {
  return value ? `Expires ${value.slice(0, 10)}` : "No expiry";
}

/** The account name when the directory is readable, else the short id. */
export function accountLabel(id: string, names: Record<string, string>): string {
  return names[id] ?? id.slice(0, 8);
}

export function apiClientError(error: unknown): ApiError {
  return apiError(error);
}

export function describeApiClientError(error: ApiError): string {
  switch (error.code) {
    case "already_revoked":
      return "This client was already revoked. The list has been reloaded.";
    case "not_found":
      return "One of the accounts is no longer granted to you.";
    case "forbidden":
      return "You need the admin:api-clients permission.";
    default:
      return describeError(error);
  }
}
