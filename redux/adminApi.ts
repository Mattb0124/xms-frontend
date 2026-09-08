import type { TicketForm, TicketFormVersion } from "@/lib/admin/ticket-forms";
import type { FormDefinition, FormTicketType } from "@/lib/portal/forms";
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
  /** Present on override rows (acct.config_overrides), absent on operator defaults. */
  account_id?: string;
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

/** What resolves for one account today, where it came from, and the history behind it (technical 3.4). */
export interface EffectiveConfig {
  source: "default" | "override";
  version: number;
  versionId: string;
  body: unknown;
}

export interface AccountConfigView {
  /** Null when nothing is active for the kind: no operator default and no override (not a failure). */
  effective: EffectiveConfig | null;
  default: ConfigVersion | null;
  overrides: ConfigVersion[];
}

export interface AccountConfigKey {
  accountId: string;
  kind: ConfigKind;
  /** The ticket type for the state machine; omitted for the `*` scope. */
  scope?: string;
}

function accountConfigTag({ accountId, kind, scope }: AccountConfigKey) {
  return { type: "AccountConfig" as const, id: `${accountId}:${kind}:${scope ?? "*"}` };
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

/**
 * The account's contacts as the operator administers them (Client Portal
 * technical 2.1). A contact is a person the account writes to, whether or
 * not they hold a portal user; the flags say what each one is for.
 * `executive_sponsor` is the flag the quarterly relationship survey
 * addresses (functional 5.7). The vocabulary is closed by the API and again
 * by the column's check constraint (migration 0032), so a typo cannot
 * quietly drop someone out of every future survey.
 */
export const CONTACT_FLAGS = ["executive_sponsor", "billing_contact", "csat_recipient"] as const;
export type ContactFlag = (typeof CONTACT_FLAGS)[number];

export interface Contact {
  id: string;
  account_id: string;
  email: string;
  display_name: string;
  portal_user_id: string | null;
  status: string;
  flags: string[];
  created_at: string;
  updated_at: string;
  version: number;
}

/** The whole flag set is replaced; the version is the one the row was read at. */
export interface SetContactFlagsBody {
  version: number;
  flags: ContactFlag[];
}

const contactsTag = (accountId: string) => ({ type: "Contacts" as const, id: accountId });
const ticketFormsTag = (accountId: string) => ({ type: "TicketForms" as const, id: accountId });

/** The body POST /v1/accounts/:id/forms takes; the definition is the first draft. */
export interface CreateTicketFormBody {
  ticket_type: FormTicketType;
  name: string;
  description?: string;
  client_visible?: boolean;
  definition?: FormDefinition;
}

export interface PatchTicketFormBody {
  version: number;
  name?: string;
  description?: string;
  client_visible?: boolean;
  is_active?: boolean;
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
    /** The account's contacts, under admin:accounts; `q` matches the address or the name. */
    listContacts: build.query<Contact[], { accountId: string; q?: string }>({
      query: ({ accountId, q }) => ({
        url: `/v1/admin/accounts/${accountId}/contacts`,
        params: q ? { q } : undefined,
      }),
      providesTags: (_result, _error, { accountId }) => [contactsTag(accountId)],
    }),
    /**
     * Replaces the whole flag set with the version the row was read at. The
     * list is read again even when the API refuses, because a stale_version
     * means the browser's copy is behind whatever else happened to the row.
     */
    setContactFlags: build.mutation<Contact, { accountId: string; id: string; body: SetContactFlagsBody }>({
      query: ({ accountId, id, body }) => ({
        url: `/v1/admin/accounts/${accountId}/contacts/${id}/flags`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_result, _error, { accountId }) => [contactsTag(accountId)],
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
    getAccountConfig: build.query<AccountConfigView, AccountConfigKey>({
      query: ({ accountId, kind, scope }) => ({
        url: `/v1/accounts/${accountId}/config/${kind}`,
        params: scope ? { scope } : undefined,
      }),
      providesTags: (_result, _error, key) => [accountConfigTag(key)],
    }),
    setAccountOverride: build.mutation<ConfigVersion, AccountConfigKey & { body: Record<string, unknown> }>({
      query: ({ accountId, kind, scope, body }) => ({
        url: `/v1/accounts/${accountId}/config/${kind}/override`,
        method: "PUT",
        params: scope ? { scope } : undefined,
        body: { body },
      }),
      invalidatesTags: (_result, _error, key) => [accountConfigTag(key)],
    }),
    removeAccountOverride: build.mutation<{ removed: string }, AccountConfigKey>({
      query: ({ accountId, kind, scope }) => ({
        url: `/v1/accounts/${accountId}/config/${kind}/override`,
        method: "DELETE",
        params: scope ? { scope } : undefined,
      }),
      invalidatesTags: (_result, _error, key) => [accountConfigTag(key)],
    }),

    /**
     * Per-account request forms (CP-03). Authoring is configuration, so the
     * API answers all six routes to `admin:config` alone. A version is a
     * draft until it is published and then frozen, so the list is the whole
     * record: it carries every version, and each write reloads it.
     */
    listTicketForms: build.query<TicketForm[], string>({
      query: (accountId) => `/v1/accounts/${accountId}/forms`,
      providesTags: (_result, _error, accountId) => [ticketFormsTag(accountId)],
    }),
    createTicketForm: build.mutation<TicketForm, { accountId: string; body: CreateTicketFormBody }>({
      query: ({ accountId, body }) => ({ url: `/v1/accounts/${accountId}/forms`, method: "POST", body }),
      invalidatesTags: (_result, _error, { accountId }) => [ticketFormsTag(accountId)],
    }),
    patchTicketForm: build.mutation<TicketForm, { accountId: string; formId: string; body: PatchTicketFormBody }>({
      query: ({ accountId, formId, body }) => ({
        url: `/v1/accounts/${accountId}/forms/${formId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_result, _error, { accountId }) => [ticketFormsTag(accountId)],
    }),
    /** A new draft on top of whatever the form serves today. */
    addFormVersion: build.mutation<
      TicketFormVersion,
      { accountId: string; formId: string; definition: FormDefinition }
    >({
      query: ({ accountId, formId, definition }) => ({
        url: `/v1/accounts/${accountId}/forms/${formId}/versions`,
        method: "POST",
        body: { definition },
      }),
      invalidatesTags: (_result, _error, { accountId }) => [ticketFormsTag(accountId)],
    }),
    editFormVersion: build.mutation<
      TicketFormVersion,
      { accountId: string; formId: string; versionId: string; definition: FormDefinition }
    >({
      query: ({ accountId, formId, versionId, definition }) => ({
        url: `/v1/accounts/${accountId}/forms/${formId}/versions/${versionId}`,
        method: "PUT",
        body: { definition },
      }),
      invalidatesTags: (_result, _error, { accountId }) => [ticketFormsTag(accountId)],
    }),
    /** Freezes the version and points the form at it; there is no way back. */
    publishFormVersion: build.mutation<TicketForm, { accountId: string; formId: string; versionId: string }>({
      query: ({ accountId, formId, versionId }) => ({
        url: `/v1/accounts/${accountId}/forms/${formId}/versions/${versionId}/publish`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, { accountId }) => [ticketFormsTag(accountId)],
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
  useListContactsQuery,
  useSetContactFlagsMutation,
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
  useGetAccountConfigQuery,
  useSetAccountOverrideMutation,
  useRemoveAccountOverrideMutation,
  useListTicketFormsQuery,
  useCreateTicketFormMutation,
  usePatchTicketFormMutation,
  useAddFormVersionMutation,
  useEditFormVersionMutation,
  usePublishFormVersionMutation,
  useListAssignableUsersQuery,
} = adminApi;
