import { xmsApi } from "@/redux/api";

/**
 * API clients (Accounts & Administration functional 5.9, Integrations
 * functional 5.4): an administrator names a client, scopes it, grants it
 * accounts and an optional expiry, and sees its key once. The list carries
 * the key prefix, the scopes, the accounts, last used and the status; revoke
 * is immediate. Reading and writing need `admin:api-clients`, which
 * `admin:users` implies.
 *
 * Webhook subscriptions are not administered here: `/v1/webhooks` answers API
 * client principals only, so the client registers its own endpoints with its
 * key.
 */
export type ApiClientStatus = "active" | "revoked";

export interface ApiClient {
  id: string;
  name: string;
  owner_user_id: string | null;
  /** The first sixteen characters of the key, enough to recognise it in a log. */
  key_prefix: string;
  scopes: string[];
  expires_at: string | null;
  last_used_at: string | null;
  status: ApiClientStatus;
  created_at: string;
  version: number;
  account_ids: string[];
}

/** The create response only: the key is shown once and never returned again. */
export interface CreatedApiClient extends ApiClient {
  key: string;
}

export interface ApiScope {
  scope: string;
  description: string;
}

export interface CreateApiClientBody {
  name: string;
  scopes: string[];
  account_ids: string[];
  expires_at?: string;
}

export interface RevokedApiClient {
  id: string;
  status: ApiClientStatus;
}

export const apiClientsApi = xmsApi.injectEndpoints({
  endpoints: (build) => ({
    apiClients: build.query<ApiClient[], void>({
      query: () => "/v1/admin/api-clients",
      providesTags: ["ApiClients"],
    }),
    apiClientScopes: build.query<ApiScope[], void>({
      query: () => "/v1/admin/api-clients/scopes",
      providesTags: ["ApiClientScopes"],
    }),
    createApiClient: build.mutation<CreatedApiClient, CreateApiClientBody>({
      query: (body) => ({ url: "/v1/admin/api-clients", method: "POST", body }),
      invalidatesTags: (_result, error) => (error ? [] : ["ApiClients"]),
    }),
    /** A refused revoke reloads the list too, so `already_revoked` shows the row as it now is. */
    revokeApiClient: build.mutation<RevokedApiClient, string>({
      query: (id) => ({ url: `/v1/admin/api-clients/${id}/revoke`, method: "POST" }),
      invalidatesTags: ["ApiClients"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useApiClientsQuery,
  useApiClientScopesQuery,
  useCreateApiClientMutation,
  useRevokeApiClientMutation,
} = apiClientsApi;
