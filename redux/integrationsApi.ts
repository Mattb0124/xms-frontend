import { xmsApi } from "@/redux/api";

/**
 * The finance connector (Integrations functional 5.3, INT-02): each account
 * has at most one destination for its locked billing exports, as a signed
 * HTTPS post or as objects under a prefix in the object store, and every
 * hand-over is a delivery row finance can acknowledge. Reading and setting
 * the destination need `admin:connectors`; the deliveries and "Deliver now"
 * need `time:lock-period`.
 */
export type DestinationKind = "https" | "object_store";
export type FinanceFormat = "csv" | "xlsx";

export interface FinanceDestination {
  id: string;
  account_id: string;
  kind: DestinationKind;
  endpoint_url: string | null;
  object_prefix: string | null;
  /** The signing key in force; the secret itself is shown once and never returned. */
  secret_kid: string | null;
  format: FinanceFormat;
  enabled: boolean;
  updated_at: string;
  version: number;
}

/** The PUT response: `secret` is present only when a new HTTPS secret was minted. */
export interface SavedFinanceDestination extends FinanceDestination {
  secret?: string;
}

export interface SetDestinationBody {
  kind: DestinationKind;
  endpoint_url?: string;
  object_prefix?: string;
  format?: FinanceFormat;
  enabled?: boolean;
}

export type FinanceDeliveryStatus = "pending" | "delivered" | "acknowledged" | "failed" | "superseded";

export interface FinanceDelivery {
  id: string;
  billing_period_id: string;
  billing_export_id: string;
  destination_kind: DestinationKind;
  manifest_key: string | null;
  status: FinanceDeliveryStatus;
  supersedes_id: string | null;
  response_status: number | null;
  ack_received_at: string | null;
  ack_reference: string | null;
  error: string | null;
  created_at: string;
}

export interface DeliveriesFilter {
  account_id?: string;
  period_id?: string;
}

const destinationTag = (accountId: string) => ({ type: "FinanceDestination" as const, id: accountId });
const deliveriesTag = (accountId: string | undefined) => ({
  type: "FinanceDeliveries" as const,
  id: accountId ?? "all",
});

export const integrationsApi = xmsApi.injectEndpoints({
  endpoints: (build) => ({
    /** `null` when the account has no destination yet; the form opens empty. */
    financeDestination: build.query<FinanceDestination | null, string>({
      query: (accountId) => `/v1/finance/destinations/${accountId}`,
      providesTags: (_result, _error, accountId) => [destinationTag(accountId)],
    }),
    setFinanceDestination: build.mutation<SavedFinanceDestination, { accountId: string; body: SetDestinationBody }>({
      query: ({ accountId, body }) => ({ url: `/v1/finance/destinations/${accountId}`, method: "PUT", body }),
      invalidatesTags: (_result, error, { accountId }) => (error ? [] : [destinationTag(accountId)]),
    }),
    financeDeliveries: build.query<FinanceDelivery[], DeliveriesFilter>({
      query: (filter) => ({
        url: "/v1/finance/deliveries",
        params: {
          ...(filter.account_id ? { account_id: filter.account_id } : {}),
          ...(filter.period_id ? { period_id: filter.period_id } : {}),
        },
      }),
      providesTags: (_result, _error, filter) => [deliveriesTag(filter.account_id)],
    }),
    /** Deliver or re-deliver a locked period now; the earlier delivery is superseded. */
    deliverPeriodNow: build.mutation<FinanceDelivery, { accountId: string; period_id: string }>({
      query: ({ period_id }) => ({ url: "/v1/finance/deliveries", method: "POST", body: { period_id } }),
      invalidatesTags: (_result, error, { accountId }) =>
        error ? [] : [deliveriesTag(accountId), deliveriesTag(undefined), { type: "BillingPeriods", id: accountId }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useFinanceDestinationQuery,
  useSetFinanceDestinationMutation,
  useFinanceDeliveriesQuery,
  useDeliverPeriodNowMutation,
} = integrationsApi;
