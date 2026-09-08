import type { ApiClient, ApiScope } from "@/redux/apiClientsApi";
import type { FinanceDelivery, FinanceDestination } from "@/redux/integrationsApi";

/**
 * Constructed API client and finance fixtures shared by the integrations
 * tests. Nothing here is a live key, endpoint or account: the ids are
 * fixed UUIDs and the key prefix is the API's shape with invented bytes.
 */
export const API_CLIENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const FINANCE_ACCOUNT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const OTHER_ACCOUNT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
export const BILLING_PERIOD_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

/** An active client scoped to reading tickets and exports on one account. */
export function anApiClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    id: API_CLIENT_ID,
    name: "Finance loader",
    owner_user_id: "u1",
    key_prefix: "axk_live_Zm9vYmFy",
    scopes: ["tickets:view", "exports:read"],
    expires_at: null,
    last_used_at: "2026-09-06T07:15:00Z",
    status: "active",
    created_at: "2026-08-01T09:00:00Z",
    version: 1,
    account_ids: [FINANCE_ACCOUNT_ID],
    ...overrides,
  };
}

export function aScope(overrides: Partial<ApiScope> = {}): ApiScope {
  return { scope: "tickets:view", description: "Read tickets on the granted accounts", ...overrides };
}

/** The seven scopes the API offers, in the order it lists them. */
export function someScopes(): ApiScope[] {
  return [
    aScope(),
    aScope({ scope: "tickets:create", description: "Raise tickets" }),
    aScope({ scope: "tickets:work", description: "Work tickets: assign, comment, transition" }),
    aScope({ scope: "time:log", description: "Log time against tickets" }),
    aScope({ scope: "kb:read", description: "Read published articles" }),
    aScope({ scope: "exports:read", description: "Read exports and acknowledge finance deliveries" }),
    aScope({ scope: "webhooks:manage", description: "Register and manage webhook subscriptions" }),
  ];
}

/** An enabled HTTPS destination with a signing key in force. */
export function aDestination(overrides: Partial<FinanceDestination> = {}): FinanceDestination {
  return {
    id: "dest-1",
    account_id: FINANCE_ACCOUNT_ID,
    kind: "https",
    endpoint_url: "https://finance.example.test/xms/billing",
    object_prefix: null,
    secret_kid: "kid-2026-08",
    format: "csv",
    enabled: true,
    updated_at: "2026-09-01T10:00:00Z",
    version: 3,
    ...overrides,
  };
}

/** A delivered hand-over finance has acknowledged. */
export function aFinanceDelivery(overrides: Partial<FinanceDelivery> = {}): FinanceDelivery {
  return {
    id: "del-1",
    billing_period_id: BILLING_PERIOD_ID,
    billing_export_id: "exp-1",
    destination_kind: "https",
    manifest_key: `${FINANCE_ACCOUNT_ID}/finance/2026-08/manifest.json`,
    status: "acknowledged",
    supersedes_id: null,
    response_status: 202,
    ack_received_at: "2026-09-02T08:05:00Z",
    ack_reference: "SAP-BATCH-4471",
    error: null,
    created_at: "2026-09-01T23:10:00Z",
    ...overrides,
  };
}
