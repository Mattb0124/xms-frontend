import { xmsApi } from "@/redux/api";

/**
 * Cost rates and account margin (TB-16).
 *
 * Both stand on `finance:view-margin`, not on the `contracts:view` that
 * opens a rate card: what a colleague costs is not something every reader of
 * an account's commercial terms should see. Writing a cost rate needs
 * `finance:manage-cost` on top of it.
 */
export interface CostRate {
  id: string;
  person_id: string;
  effective_from: string;
  cost_rate: number;
  currency: string;
  note: string;
  created_by: string;
  created_at: string;
}

export interface MarginLine {
  key: string;
  label: string;
  minutes: number;
  /** Null where the half could not be read; never zero standing in for unknown. */
  revenue: number | null;
  cost: number | null;
  margin: number | null;
  margin_percent: number | null;
  minutes_without_cost: number;
  minutes_without_rate: number;
}

export interface Profitability {
  total: MarginLine;
  by_role: MarginLine[];
  by_person: MarginLine[];
  currencies: string[];
}

export const profitabilityApi = xmsApi.injectEndpoints({
  endpoints: (build) => ({
    accountProfitability: build.query<Profitability, { accountId: string; from: string; to: string }>({
      query: ({ accountId, from, to }) => ({
        url: `/v1/accounts/${accountId}/profitability`,
        params: { from, to },
      }),
      providesTags: (_r, _e, { accountId }) => [{ type: "Profitability", id: accountId }],
    }),
    personCostRates: build.query<CostRate[], string>({
      query: (personId) => `/v1/people/${personId}/cost-rates`,
      providesTags: (_r, _e, personId) => [{ type: "Profitability", id: `person:${personId}` }],
    }),
    setPersonCostRate: build.mutation<
      CostRate,
      { personId: string; body: { effective_from: string; cost_rate: number; currency?: string; note?: string } }
    >({
      query: ({ personId, body }) => ({ url: `/v1/people/${personId}/cost-rates`, method: "PUT", body }),
      invalidatesTags: (_r, _e, { personId }) => [{ type: "Profitability", id: `person:${personId}` }],
    }),
    removePersonCostRate: build.mutation<void, { personId: string; id: string }>({
      query: ({ personId, id }) => ({ url: `/v1/people/${personId}/cost-rates/${id}`, method: "DELETE" }),
      invalidatesTags: (_r, _e, { personId }) => [{ type: "Profitability", id: `person:${personId}` }],
    }),
  }),
});

export const {
  useAccountProfitabilityQuery,
  usePersonCostRatesQuery,
  useSetPersonCostRateMutation,
  useRemovePersonCostRateMutation,
} = profitabilityApi;
