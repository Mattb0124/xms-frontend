import { xmsApi } from "@/redux/api";

/**
 * Accounts & Administration endpoints (technical spec section 4), injected
 * into the base API. Reconcile endpoints (grants, roles, members) invalidate
 * only the record they touched; `Me` is invalidated when grants or roles
 * change so the shell's permission set follows the server.
 */
export type AccountStatus = "onboarding" | "active" | "suspended" | "offboarding" | "offboarded";
export type IsolationTier = "shared" | "dedicated";

export interface AccountRow {
  id: string;
  key: string;
  name: string;
  legal_name: string | null;
  status: AccountStatus;
  isolation_tier: IsolationTier;
  residency_region: string;
  default_time_zone: string;
  default_calendar_id: string | null;
  branding: Record<string, unknown>;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

export type SyncMode = "off" | "ingest_only" | "bidirectional";

export interface AccountSettings {
  id: string;
  account_id: string;
  portal_enabled: boolean;
  consumption_visible: boolean;
  csat_enabled: boolean;
  sync_mode: SyncMode;
  ai_enabled: boolean;
  ai_opt_ins: Record<string, string>;
  ai_region_ok: boolean;
  email_branding: Record<string, unknown>;
  outbound_identity: string | null;
  inbound_aliases: string[];
  retention_days: number;
  attachment_max_bytes: number | string;
  usage_analytics_portal: boolean;
  store_search_terms: boolean;
  version: number;
}

export type SettingsPatch = Partial<Omit<AccountSettings, "id" | "account_id" | "version" | "ai_region_ok">> & {
  version: number;
};

export type UserKind = "internal" | "portal" | "service";
export type UserStatus = "invited" | "active" | "deactivated";

export interface UserRecord {
  id: string;
  clerk_user_id: string | null;
  kind: UserKind;
  account_id: string | null;
  email: string;
  first_name: string;
  last_name: string;
  title: string | null;
  business_phone: string | null;
  mobile_phone: string | null;
  time_zone: string;
  language: string;
  date_format: string;
  status: UserStatus;
  last_sign_in_at: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface RoleAssignment {
  role_id: string;
  account_id: string | null;
  name: string;
}

export interface Grant {
  account_id: string;
  granted_by: string;
  granted_at: string;
}

export interface UserDetail extends UserRecord {
  roles: RoleAssignment[];
  grants: Grant[];
  groups: { group_id: string; name: string }[];
}

export interface Grantee {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
}

export type Catalog = "operator" | "portal";

export interface RoleRecord {
  id: string;
  catalog: Catalog;
  name: string;
  description: string;
  permissions: string[];
  is_system: boolean;
  status: "active" | "retired";
  version: number;
}

export interface PermissionRow {
  key: string;
  label: string;
  implies: string[];
}

export interface GroupRecord {
  id: string;
  name: string;
  description: string;
  service_line: string | null;
  lead_user_id: string | null;
  status: "active" | "retired";
  version: number;
}

export interface GroupDetail extends GroupRecord {
  members: Grantee[];
}

export interface AssignableUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

export type ConfigKind =
  "state_machine" | "priority_matrix" | "sla_policy" | "activity_types" | "billable_classes" | "resolution_codes";

export interface ConfigVersion {
  id: string;
  kind: ConfigKind;
  scope_key: string;
  version: number;
  body: unknown;
  status: "draft" | "active" | "retired";
  activated_at: string | null;
  activated_by?: string | null;
  created_at?: string;
}

export interface ConfigDescription {
  active?: ConfigVersion;
  versions: ConfigVersion[];
}

export interface CreateAccountBody {
  key: string;
  name: string;
  legal_name?: string;
  residency_region?: string;
  default_time_zone?: string;
  isolation_tier?: IsolationTier;
}

export interface InviteUserBody {
  email: string;
  first_name?: string;
  last_name?: string;
  time_zone?: string;
  role_ids?: string[];
  account_ids?: string[];
}

export const adminApi = xmsApi.injectEndpoints({
  endpoints: (build) => ({
    listAccounts: build.query<AccountRow[], { status?: string } | void>({
      query: (params) => ({
        url: "/v1/admin/accounts",
        params: params?.status ? { status: params.status } : undefined,
      }),
      providesTags: ["Accounts"],
    }),
    getAccount: build.query<AccountRow, string>({
      query: (id) => `/v1/admin/accounts/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Account", id }],
    }),
    createAccount: build.mutation<AccountRow, CreateAccountBody>({
      query: (body) => ({ url: "/v1/admin/accounts", method: "POST", body }),
      invalidatesTags: ["Accounts", "Me"],
    }),
    updateAccount: build.mutation<AccountRow, { id: string; body: Partial<AccountRow> & { version: number } }>({
      query: ({ id, body }) => ({ url: `/v1/admin/accounts/${id}`, method: "PATCH", body }),
      invalidatesTags: (_result, _error, { id }) => [{ type: "Account", id }, "Accounts"],
    }),
    transitionAccount: build.mutation<AccountRow, { id: string; action: "activate" | "suspend" | "offboard" }>({
      query: ({ id, action }) => ({ url: `/v1/admin/accounts/${id}/${action}`, method: "POST" }),
      invalidatesTags: (_result, _error, { id }) => [{ type: "Account", id }, "Accounts"],
    }),
    getAccountSettings: build.query<AccountSettings, string>({
      query: (id) => `/v1/admin/accounts/${id}/settings`,
      providesTags: (_result, _error, id) => [{ type: "Account", id: `${id}:settings` }],
    }),
    updateAccountSettings: build.mutation<AccountSettings, { id: string; body: SettingsPatch }>({
      query: ({ id, body }) => ({ url: `/v1/admin/accounts/${id}/settings`, method: "PUT", body }),
      invalidatesTags: (_result, _error, { id }) => [{ type: "Account", id: `${id}:settings` }],
    }),
    getAccountGrantees: build.query<Grantee[], string>({
      query: (id) => `/v1/admin/accounts/${id}/grants`,
      providesTags: (_result, _error, id) => [{ type: "Account", id: `${id}:grants` }],
    }),
    replaceAccountGrantees: build.mutation<Grantee[], { id: string; user_ids: string[] }>({
      query: ({ id, user_ids }) => ({ url: `/v1/admin/accounts/${id}/grants`, method: "PUT", body: { user_ids } }),
      invalidatesTags: (_result, _error, { id }) => [{ type: "Account", id: `${id}:grants` }, "Me"],
    }),
    listPortalUsers: build.query<UserRecord[], string>({
      query: (id) => `/v1/admin/accounts/${id}/portal-users`,
      providesTags: (_result, _error, id) => [{ type: "Account", id: `${id}:portal-users` }],
    }),
    invitePortalUser: build.mutation<UserRecord, { id: string; body: InviteUserBody }>({
      query: ({ id, body }) => ({ url: `/v1/admin/accounts/${id}/portal-users`, method: "POST", body }),
      invalidatesTags: (_result, _error, { id }) => [{ type: "Account", id: `${id}:portal-users` }, "Users"],
    }),

    listUsers: build.query<UserRecord[], { kind?: UserKind } | void>({
      query: (params) => ({ url: "/v1/admin/users", params: params?.kind ? { kind: params.kind } : undefined }),
      providesTags: ["Users"],
    }),
    getUser: build.query<UserDetail, string>({
      query: (id) => `/v1/admin/users/${id}`,
      providesTags: (_result, _error, id) => [{ type: "User", id }],
    }),
    inviteUser: build.mutation<UserRecord, InviteUserBody>({
      query: (body) => ({ url: "/v1/admin/users", method: "POST", body }),
      invalidatesTags: ["Users"],
    }),
    updateUser: build.mutation<UserRecord, { id: string; body: Partial<UserRecord> & { version: number } }>({
      query: ({ id, body }) => ({ url: `/v1/admin/users/${id}`, method: "PATCH", body }),
      invalidatesTags: (_result, _error, { id }) => [{ type: "User", id }, "Users"],
    }),
    replaceUserRoles: build.mutation<
      RoleAssignment[],
      { id: string; roles: { role_id: string; account_id?: string | null }[] }
    >({
      query: ({ id, roles }) => ({ url: `/v1/admin/users/${id}/roles`, method: "PUT", body: { roles } }),
      invalidatesTags: (_result, _error, { id }) => [{ type: "User", id }, "Me"],
    }),
    replaceUserGrants: build.mutation<Grant[], { id: string; account_ids: string[] }>({
      query: ({ id, account_ids }) => ({ url: `/v1/admin/users/${id}/grants`, method: "PUT", body: { account_ids } }),
      invalidatesTags: (_result, _error, { id }) => [{ type: "User", id }, "Me"],
    }),

    listRoles: build.query<RoleRecord[], { catalog?: Catalog } | void>({
      query: (params) => ({
        url: "/v1/admin/roles",
        params: params?.catalog ? { catalog: params.catalog } : undefined,
      }),
      providesTags: ["Roles"],
    }),
    getRole: build.query<RoleRecord, string>({
      query: (id) => `/v1/admin/roles/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Role", id }],
    }),
    createRole: build.mutation<
      RoleRecord,
      { catalog: Catalog; name: string; description?: string; permissions: string[] }
    >({
      query: (body) => ({ url: "/v1/admin/roles", method: "POST", body }),
      invalidatesTags: ["Roles"],
    }),
    updateRole: build.mutation<RoleRecord, { id: string; body: Partial<RoleRecord> & { version: number } }>({
      query: ({ id, body }) => ({ url: `/v1/admin/roles/${id}`, method: "PATCH", body }),
      invalidatesTags: (_result, _error, { id }) => [{ type: "Role", id }, "Roles", "Me"],
    }),
    listPermissions: build.query<PermissionRow[], Catalog>({
      query: (catalog) => ({ url: "/v1/admin/permissions", params: { catalog } }),
    }),

    listGroups: build.query<GroupRecord[], void>({
      query: () => "/v1/admin/groups",
      providesTags: ["Groups"],
    }),
    getGroup: build.query<GroupDetail, string>({
      query: (id) => `/v1/admin/groups/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Group", id }],
    }),
    createGroup: build.mutation<
      GroupRecord,
      { name: string; description?: string; service_line?: string | null; lead_user_id?: string | null }
    >({
      query: (body) => ({ url: "/v1/admin/groups", method: "POST", body }),
      invalidatesTags: ["Groups"],
    }),
    updateGroup: build.mutation<GroupRecord, { id: string; body: Partial<GroupRecord> & { version: number } }>({
      query: ({ id, body }) => ({ url: `/v1/admin/groups/${id}`, method: "PATCH", body }),
      invalidatesTags: (_result, _error, { id }) => [{ type: "Group", id }, "Groups"],
    }),
    replaceGroupMembers: build.mutation<Grantee[], { id: string; user_ids: string[] }>({
      query: ({ id, user_ids }) => ({ url: `/v1/admin/groups/${id}/members`, method: "PUT", body: { user_ids } }),
      invalidatesTags: (_result, _error, { id }) => [{ type: "Group", id }],
    }),

    getConfig: build.query<ConfigDescription, { kind: ConfigKind; scope?: string }>({
      query: ({ kind, scope }) => ({ url: `/v1/admin/config/${kind}`, params: scope ? { scope } : undefined }),
      providesTags: (_result, _error, { kind, scope }) => [{ type: "Config", id: `${kind}:${scope ?? "*"}` }],
    }),

    listAssignableUsers: build.query<AssignableUser[], void>({
      query: () => "/v1/users",
      providesTags: ["Users"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListAccountsQuery,
  useGetAccountQuery,
  useCreateAccountMutation,
  useUpdateAccountMutation,
  useTransitionAccountMutation,
  useGetAccountSettingsQuery,
  useUpdateAccountSettingsMutation,
  useGetAccountGranteesQuery,
  useReplaceAccountGranteesMutation,
  useListPortalUsersQuery,
  useInvitePortalUserMutation,
  useListUsersQuery,
  useGetUserQuery,
  useInviteUserMutation,
  useUpdateUserMutation,
  useReplaceUserRolesMutation,
  useReplaceUserGrantsMutation,
  useListRolesQuery,
  useGetRoleQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useListPermissionsQuery,
  useListGroupsQuery,
  useGetGroupQuery,
  useCreateGroupMutation,
  useUpdateGroupMutation,
  useReplaceGroupMembersMutation,
  useGetConfigQuery,
  useListAssignableUsersQuery,
} = adminApi;
