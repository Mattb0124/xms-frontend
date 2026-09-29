import { xmsApi } from "@/redux/api";

/**
 * Webhook subscriptions, as an account's administrator sees them.
 *
 * The routes are answered to `webhooks:manage` and scoped to one account.
 * A subscription belongs to an API client of that account: the client is who
 * XMS is talking to, and the subscription is which of its events go where.
 *
 * The signing secret is never readable. It comes back once, from create and
 * from rotate, and is not stored anywhere the browser can ask for it again;
 * that is why the screen shows it in a panel that says so.
 */
export interface WebhookSubscription {
  id: string;
  account_id: string;
  api_client_id: string;
  endpoint_url: string;
  event_types: string[];
  secret_kid: string;
  status: "active" | "paused" | "deleted";
  /** Why the worker paused it, in its own vocabulary. */
  paused_reason: string | null;
  /** What a person typed when they paused it by hand. */
  paused_note: string | null;
  consecutive_failures: number;
  created_at: string;
  version: number;
  client: { id: string; name: string; status: string };
}

/** Create and rotate answer with the secret once, and never again. */
export interface WebhookSecret {
  id: string;
  secret_kid: string;
  secret: string;
}

export interface WebhookDelivery {
  id: string;
  subscription_id: string;
  event_type: string;
  attempt: number;
  status: "pending" | "delivered" | "retrying" | "dead_lettered" | "replayed";
  response_status: number | null;
  duration_ms: number | null;
  error: string | null;
  next_attempt_at: string | null;
  created_at: string;
}

export interface WebhookDeadLetter extends WebhookDelivery {
  endpoint_url: string;
  first_failed_at: string;
}

export const webhooksApi = xmsApi.injectEndpoints({
  endpoints: (build) => ({
    accountWebhooks: build.query<WebhookSubscription[], string>({
      query: (accountId) => `/v1/accounts/${accountId}/webhooks`,
      providesTags: (_r, _e, accountId) => [{ type: "Webhooks", id: accountId }],
    }),
    createAccountWebhook: build.mutation<
      WebhookSubscription & { secret: string },
      { accountId: string; body: { api_client_id: string; endpoint_url: string; event_types: string[] } }
    >({
      query: ({ accountId, body }) => ({ url: `/v1/accounts/${accountId}/webhooks`, method: "POST", body }),
      invalidatesTags: (_r, _e, { accountId }) => [{ type: "Webhooks", id: accountId }],
    }),
    deleteAccountWebhook: build.mutation<void, { accountId: string; id: string }>({
      query: ({ accountId, id }) => ({ url: `/v1/accounts/${accountId}/webhooks/${id}`, method: "DELETE" }),
      invalidatesTags: (_r, _e, { accountId }) => [{ type: "Webhooks", id: accountId }],
    }),
    pauseAccountWebhook: build.mutation<WebhookSubscription, { accountId: string; id: string; reason?: string }>({
      query: ({ accountId, id, reason }) => ({
        url: `/v1/accounts/${accountId}/webhooks/${id}/pause`,
        method: "POST",
        body: reason ? { reason } : {},
      }),
      invalidatesTags: (_r, _e, { accountId }) => [{ type: "Webhooks", id: accountId }],
    }),
    resumeAccountWebhook: build.mutation<WebhookSubscription, { accountId: string; id: string }>({
      query: ({ accountId, id }) => ({ url: `/v1/accounts/${accountId}/webhooks/${id}/resume`, method: "POST" }),
      invalidatesTags: (_r, _e, { accountId }) => [{ type: "Webhooks", id: accountId }],
    }),
    rotateAccountWebhookSecret: build.mutation<WebhookSecret, { accountId: string; id: string }>({
      query: ({ accountId, id }) => ({
        url: `/v1/accounts/${accountId}/webhooks/${id}/rotate-secret`,
        method: "POST",
      }),
      invalidatesTags: (_r, _e, { accountId }) => [{ type: "Webhooks", id: accountId }],
    }),
    accountWebhookDeliveries: build.query<WebhookDelivery[], { accountId: string; id: string }>({
      query: ({ accountId, id }) => `/v1/accounts/${accountId}/webhooks/${id}/deliveries`,
      providesTags: (_r, _e, { id }) => [{ type: "Webhooks", id: `deliveries:${id}` }],
    }),
    accountWebhookDeadLetters: build.query<WebhookDeadLetter[], { accountId: string; subscriptionId?: string }>({
      query: ({ accountId, subscriptionId }) => ({
        url: `/v1/accounts/${accountId}/webhooks/dead-letters`,
        params: subscriptionId ? { subscription_id: subscriptionId } : undefined,
      }),
      providesTags: (_r, _e, { accountId }) => [{ type: "Webhooks", id: `dead:${accountId}` }],
    }),
    replayAccountWebhook: build.mutation<unknown, { accountId: string; deliveryId: string }>({
      query: ({ accountId, deliveryId }) => ({
        url: `/v1/accounts/${accountId}/webhooks/dead-letters/${deliveryId}/replay`,
        method: "POST",
      }),
      invalidatesTags: (_r, _e, { accountId }) => [{ type: "Webhooks", id: `dead:${accountId}` }],
    }),
    webhookEventTypes: build.query<string[], void>({
      query: () => "/v1/webhooks/event-types",
    }),
  }),
});

export const {
  useAccountWebhooksQuery,
  useCreateAccountWebhookMutation,
  useDeleteAccountWebhookMutation,
  usePauseAccountWebhookMutation,
  useResumeAccountWebhookMutation,
  useRotateAccountWebhookSecretMutation,
  useAccountWebhookDeliveriesQuery,
  useAccountWebhookDeadLettersQuery,
  useReplayAccountWebhookMutation,
  useWebhookEventTypesQuery,
} = webhooksApi;
