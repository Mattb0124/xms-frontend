import { xmsApi } from "@/redux/api";

/**
 * The configuration items an account runs (TM-19): the environments,
 * applications, modules, integrations, servers and reports a case is raised
 * against.
 *
 * Reading stands on `tickets:view`, because a case names one and whoever sees
 * the case sees what it is about; writing stands on `admin:config`, because
 * the register belongs to the account rather than to the case.
 */
export const CI_TYPES = ["environment", "application", "module", "integration", "server", "report", "other"] as const;
export type CiType = (typeof CI_TYPES)[number];

export const CI_TYPE_LABEL: Record<CiType, string> = {
  environment: "Environment",
  application: "Application",
  module: "Module",
  integration: "Integration",
  server: "Server",
  report: "Report",
  other: "Other",
};

export interface ConfigurationItem {
  id: string;
  account_id: string;
  ci_type: CiType;
  name: string;
  attributes: Record<string, unknown>;
  owner_contact_id: string | null;
  external_ref: string | null;
  status: "active" | "retired";
  created_at: string;
  updated_at: string;
  version: number;
}

export interface CiSearch {
  accountId: string;
  q?: string;
  ci_type?: string;
  status?: string;
  limit?: number;
}

export interface CreateCiBody {
  ci_type: CiType;
  name: string;
  external_ref?: string;
  owner_contact_id?: string;
}

export interface UpdateCiBody {
  version: number;
  name?: string;
  ci_type?: CiType;
  external_ref?: string;
  owner_contact_id?: string | null;
  status?: "active" | "retired";
}

export const configurationItemsApi = xmsApi.injectEndpoints({
  endpoints: (build) => ({
    listConfigurationItems: build.query<ConfigurationItem[], CiSearch>({
      query: ({ accountId, ...params }) => ({
        url: `/v1/accounts/${accountId}/configuration-items`,
        params,
      }),
      providesTags: [{ type: "ConfigurationItems", id: "list" }],
    }),
    createConfigurationItem: build.mutation<ConfigurationItem, { accountId: string; body: CreateCiBody }>({
      query: ({ accountId, body }) => ({
        url: `/v1/accounts/${accountId}/configuration-items`,
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "ConfigurationItems", id: "list" }],
    }),
    updateConfigurationItem: build.mutation<ConfigurationItem, { id: string; body: UpdateCiBody }>({
      query: ({ id, body }) => ({ url: `/v1/configuration-items/${id}`, method: "PATCH", body }),
      invalidatesTags: [{ type: "ConfigurationItems", id: "list" }],
    }),
  }),
});

export const {
  useListConfigurationItemsQuery,
  useCreateConfigurationItemMutation,
  useUpdateConfigurationItemMutation,
} = configurationItemsApi;
