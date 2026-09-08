"use client";

import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { GrantsReconcile } from "@/components/admin/grants-reconcile";
import {
  AdminGate,
  ConfirmButton,
  InlineError,
  PRIMARY_BUTTON,
  RecordBar,
  UserStatusPill,
  formatDate,
  fullName,
} from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { RecordForm } from "@/components/xms/record-form";
import { Skeleton } from "@/components/xms/skeleton";
import { TabBar } from "@/components/xms/tab-bar";
import { describeError } from "@/lib/admin/api-error";
import { useMutationErrors } from "@/lib/admin/use-mutation-errors";
import { useTrack } from "@/lib/telemetry/provider";
import {
  useGetUserQuery,
  useListAccountsQuery,
  useListPermissionsQuery,
  useListRolesQuery,
  useReplaceUserGrantsMutation,
  useReplaceUserRolesMutation,
  useUpdateUserMutation,
  type UserDetail,
} from "@/redux/adminApi";

const TABS = [
  { key: "profile", label: "Profile" },
  { key: "roles", label: "Roles" },
  { key: "accounts", label: "Accounts" },
  { key: "groups", label: "Groups" },
];

function ProfileTab({ user, refetch }: { user: UserDetail; refetch: () => unknown }) {
  const [update] = useUpdateUserMutation();
  const onError = useMutationErrors(refetch);
  const fields = [
    { key: "email", label: "Email", value: user.email, readOnly: true, mono: true },
    { key: "kind", label: "Kind", value: user.kind, readOnly: true },
    { key: "first_name", label: "First name", value: user.first_name },
    { key: "last_name", label: "Last name", value: user.last_name },
    { key: "title", label: "Title", value: user.title ?? "" },
    { key: "business_phone", label: "Business phone", value: user.business_phone ?? "" },
    { key: "mobile_phone", label: "Mobile phone", value: user.mobile_phone ?? "" },
    { key: "time_zone", label: "Time zone", value: user.time_zone },
    { key: "language", label: "Language", value: user.language },
    { key: "date_format", label: "Date format", value: user.date_format, mono: true },
    {
      key: "last_sign_in_at",
      label: "Last sign-in",
      value: formatDate(user.last_sign_in_at),
      readOnly: true,
      mono: true,
    },
    { key: "clerk_user_id", label: "Identity subject", value: user.clerk_user_id ?? "", readOnly: true, mono: true },
  ];
  return (
    <Panel title="Profile" caption={`version ${user.version}`}>
      <RecordForm
        fields={fields}
        onCommit={async (key, value) => {
          const nullable = ["title", "business_phone", "mobile_phone"].includes(key);
          await update({
            id: user.id,
            body: { version: user.version, [key]: nullable && value === "" ? null : value } as never,
          }).unwrap();
        }}
        onRollback={(_key, _restored, error) => onError(error)}
      />
    </Panel>
  );
}

function RolesTab({ user }: { user: UserDetail }) {
  const catalog = user.kind === "portal" ? "portal" : "operator";
  const roles = useListRolesQuery({ catalog });
  const permissions = useListPermissionsQuery(catalog);
  const [replace, { isLoading: saving }] = useReplaceUserRolesMutation();
  const onError = useMutationErrors();
  const track = useTrack("roles.save");
  const [error, setError] = useState<string | null>(null);
  const options = useMemo(
    () =>
      (roles.data ?? [])
        .filter((role) => role.status === "active")
        .map((role) => ({
          id: role.id,
          label: role.name,
          detail: role.permissions.join(", "),
        })),
    [roles.data],
  );
  const selected = useMemo(() => user.roles.map((role) => role.role_id), [user.roles]);
  if (!roles.data) return <Skeleton lines={4} />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Roles" caption="Reconciled as a whole set">
        <GrantsReconcile
          title="Roles"
          options={options}
          selected={selected}
          saving={saving}
          onSave={async (ids) => {
            setError(null);
            try {
              await replace({ id: user.id, roles: ids.map((role_id) => ({ role_id, account_id: null })) }).unwrap();
              track({ user_id: user.id, count: ids.length });
            } catch (caught) {
              const parsed = onError(caught);
              if (parsed.code === "last_administrator") setError(describeError(parsed));
            }
          }}
        />
        <InlineError message={error} />
      </Panel>
      <Panel title="Permissions catalog" caption="What each key implies">
        <ul className="divide-y text-[13px]">
          {(permissions.data ?? []).map((row) => (
            <li key={row.key} className="py-2">
              <span className="xms-mono text-xms-ink">{row.key}</span>
              <span className="text-xms-label block text-[12px]">{row.label}</span>
              {row.implies.length > 0 ? (
                <span className="text-xms-muted block text-[11px]">Implies {row.implies.join(", ")}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function AccountsTab({ user }: { user: UserDetail }) {
  const accounts = useListAccountsQuery();
  const [replace, { isLoading: saving }] = useReplaceUserGrantsMutation();
  const onError = useMutationErrors();
  const track = useTrack("grants.save");
  const options = useMemo(
    () => (accounts.data ?? []).map((account) => ({ id: account.id, label: account.name, detail: account.key })),
    [accounts.data],
  );
  const selected = useMemo(() => user.grants.map((grant) => grant.account_id), [user.grants]);
  if (!accounts.data) return <Skeleton lines={4} />;
  if (user.kind === "portal") {
    return (
      <Panel title="Account" caption="Portal users belong to exactly one account">
        <p className="text-xms-body text-[13px]">Bound to account {user.account_id}.</p>
      </Panel>
    );
  }
  return (
    <Panel title="Account grants" caption="Which accounts this user may see">
      <GrantsReconcile
        title="Account grants"
        options={options}
        selected={selected}
        saving={saving}
        onSave={async (ids) => {
          try {
            await replace({ id: user.id, account_ids: ids }).unwrap();
            track({ user_id: user.id, count: ids.length });
          } catch (caught) {
            onError(caught);
          }
        }}
      />
    </Panel>
  );
}

/**
 * The screen itself, mounted only once the reader holds the permission,
 * so the queries below are never sent by someone the API would refuse
 * (review finding 25).
 */
function AdminUserRecordPageBody() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data, refetch } = useGetUserQuery(id);
  const [update, { isLoading: updating }] = useUpdateUserMutation();
  const onError = useMutationErrors(refetch);
  const [tab, setTab] = useState("profile");
  const [error, setError] = useState<string | null>(null);

  const setStatus = async (status: "active" | "deactivated") => {
    if (!data) return;
    setError(null);
    try {
      await update({ id, body: { version: data.version, status } }).unwrap();
    } catch (caught) {
      const parsed = onError(caught);
      if (parsed.code === "last_administrator") setError(describeError(parsed));
    }
  };

  return (
    <>
      {data ? (
        <RecordBar
          keyText={data.email}
          title={fullName(data)}
          pill={<UserStatusPill status={data.status} />}
          actions={
            data.status === "deactivated" ? (
              <button
                type="button"
                className={PRIMARY_BUTTON}
                disabled={updating}
                onClick={() => void setStatus("active")}
              >
                Reactivate
              </button>
            ) : (
              <ConfirmButton label="Deactivate" onConfirm={() => setStatus("deactivated")} disabled={updating} danger />
            )
          }
        />
      ) : (
        <Skeleton lines={1} className="mb-4 max-w-sm" />
      )}
      <InlineError message={error} />
      <TabBar tabs={TABS} active={tab} onChange={setTab} className="mb-4" />
      {!data ? <Skeleton lines={6} className="max-w-md" /> : null}
      {data && tab === "profile" ? <ProfileTab user={data} refetch={refetch} /> : null}
      {data && tab === "roles" ? <RolesTab user={data} /> : null}
      {data && tab === "accounts" ? <AccountsTab user={data} /> : null}
      {data && tab === "groups" ? (
        <Panel title="Groups" caption="Membership is edited on the group record">
          {data.groups.length === 0 ? (
            <p className="text-xms-label text-[13px]">Not a member of any group.</p>
          ) : (
            <ul className="text-[13px]">
              {data.groups.map((group) => (
                <li key={group.group_id} className="py-1">
                  <a href={`/admin/groups/${group.group_id}`} className="text-xms-accent">
                    {group.name}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : null}
    </>
  );
}

/** Registered as `admin.user`. */
export default function AdminUserRecordPage() {
  return (
    <AdminGate permission="admin:users">
      <AdminUserRecordPageBody />
    </AdminGate>
  );
}
