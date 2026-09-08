"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  AdminGate,
  FieldRow,
  INPUT,
  InlineError,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  UserStatusPill,
  formatDate,
  fullName,
} from "@/components/admin/primitives";
import { HeaderAction, HeaderFilters } from "@/components/shell/content-header-bar";
import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { FilterBar } from "@/components/xms/filter-bar";
import { KeyLink } from "@/components/xms/key-link";
import { Panel } from "@/components/xms/panel";
import { apiError, describeError } from "@/lib/admin/api-error";
import { useTrack } from "@/lib/telemetry/provider";
import {
  useInviteUserMutation,
  useListAccountsQuery,
  useListRolesQuery,
  useListUsersQuery,
  type UserKind,
  type UserRecord,
} from "@/redux/adminApi";

const KINDS: UserKind[] = ["internal", "portal", "service"];

const COLUMNS: DenseColumn<UserRecord>[] = [
  {
    key: "email",
    title: "Email",
    mono: true,
    sortValue: (row) => row.email,
    render: (row) => <KeyLink ticketKey={row.email} href={`/admin/users/${row.id}`} />,
  },
  { key: "name", title: "Name", sortValue: (row) => fullName(row), render: (row) => fullName(row) },
  { key: "kind", title: "Kind", sortValue: (row) => row.kind },
  {
    key: "status",
    title: "Status",
    sortValue: (row) => row.status,
    render: (row) => <UserStatusPill status={row.status} />,
  },
  {
    key: "last",
    title: "Last sign-in",
    mono: true,
    sortValue: (row) => row.last_sign_in_at ?? "",
    render: (row) => formatDate(row.last_sign_in_at),
  },
];

function InviteUserForm({ onDone }: { onDone: (id: string) => void }) {
  const roles = useListRolesQuery({ catalog: "operator" });
  const accounts = useListAccountsQuery();
  const [invite, { isLoading }] = useInviteUserMutation();
  const track = useTrack("user.invite");
  const [form, setForm] = useState({ email: "", first_name: "", last_name: "", time_zone: "UTC" });
  const [roleIds, setRoleIds] = useState<Set<string>>(new Set());
  const [accountIds, setAccountIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };
  return (
    <Panel title="Invite user" caption="Pre-invite an internal user so roles and grants are ready before first sign-in">
      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          try {
            const created = await invite({
              email: form.email.trim(),
              first_name: form.first_name.trim() || undefined,
              last_name: form.last_name.trim() || undefined,
              time_zone: form.time_zone.trim() || undefined,
              role_ids: [...roleIds],
              account_ids: [...accountIds],
            }).unwrap();
            track({ kind: "internal", roles: roleIds.size, accounts: accountIds.size });
            onDone(created.id);
          } catch (caught) {
            setError(describeError(apiError(caught)));
          }
        }}
      >
        <div className="flex flex-col gap-3">
          <FieldRow label="Email" htmlFor="invite-email">
            <input
              id="invite-email"
              type="email"
              required
              className={INPUT}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </FieldRow>
          <FieldRow label="First name" htmlFor="invite-first">
            <input
              id="invite-first"
              className={INPUT}
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            />
          </FieldRow>
          <FieldRow label="Last name" htmlFor="invite-last">
            <input
              id="invite-last"
              className={INPUT}
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            />
          </FieldRow>
          <FieldRow label="Time zone" htmlFor="invite-tz">
            <input
              id="invite-tz"
              className={INPUT}
              value={form.time_zone}
              onChange={(e) => setForm({ ...form, time_zone: e.target.value })}
            />
          </FieldRow>
        </div>
        <div className="flex flex-col gap-3">
          <fieldset className="border-xms-line rounded-[4px] border p-3">
            <legend className="xms-caption px-1">Roles</legend>
            {(roles.data ?? []).map((role) => (
              <label key={role.id} className="flex items-center gap-2 py-1 text-[13px]">
                <input
                  type="checkbox"
                  checked={roleIds.has(role.id)}
                  onChange={() => setRoleIds(toggle(roleIds, role.id))}
                />
                <span className="text-xms-ink">{role.name}</span>
              </label>
            ))}
          </fieldset>
          <fieldset className="border-xms-line rounded-[4px] border p-3">
            <legend className="xms-caption px-1">Accounts</legend>
            {(accounts.data ?? []).map((account) => (
              <label key={account.id} className="flex items-center gap-2 py-1 text-[13px]">
                <input
                  type="checkbox"
                  checked={accountIds.has(account.id)}
                  onChange={() => setAccountIds(toggle(accountIds, account.id))}
                />
                <span className="xms-mono text-xms-accent">{account.key}</span>
                <span className="text-xms-ink">{account.name}</span>
              </label>
            ))}
            {(accounts.data ?? []).length === 0 ? <p className="text-xms-label text-[12px]">No accounts yet.</p> : null}
          </fieldset>
        </div>
        <div className="flex flex-col gap-2 md:col-span-2">
          <InlineError message={error} />
          <div className="flex gap-2">
            <button type="submit" className={PRIMARY_BUTTON} disabled={isLoading}>
              Invite
            </button>
            <button type="button" className={SECONDARY_BUTTON} onClick={() => onDone("")}>
              Cancel
            </button>
          </div>
        </div>
      </form>
    </Panel>
  );
}

/**
 * The list itself, mounted only once the reader holds admin:users. Keeping
 * the query inside the gate is what stops the screen asking for the users
 * and taking a 403 before drawing its own refusal, a denial the browser
 * already knew about and that wrote a security event (review finding 25).
 */
function UsersList() {
  const router = useRouter();
  const [kind, setKind] = useState<UserKind | null>(null);
  const [inviting, setInviting] = useState(false);
  const { data, isLoading } = useListUsersQuery(kind ? { kind } : undefined);
  const rows = useMemo(() => data ?? [], [data]);
  return (
    <>
      <HeaderFilters>
        <FilterBar
          primary={{ label: "Show", value: "Users" }}
          criteria={kind ? [{ key: "kind", label: "Kind", value: kind }] : []}
          onRemove={() => setKind(null)}
          onAdd={() => setKind((current) => KINDS[(KINDS.indexOf(current ?? "service") + 1) % KINDS.length])}
          onClearAll={() => setKind(null)}
        />
      </HeaderFilters>
      <HeaderAction>
        <button type="button" className={PRIMARY_BUTTON} onClick={() => setInviting(true)}>
          Invite user
        </button>
      </HeaderAction>
      <div className="flex flex-col gap-4">
        {inviting ? (
          <InviteUserForm
            onDone={(id) => {
              setInviting(false);
              if (id) router.push(`/admin/users/${id}`);
            }}
          />
        ) : null}
        <DenseTable
          title="Users"
          columns={COLUMNS}
          rows={rows}
          rowKey={(row) => row.id}
          loading={isLoading}
          onRowClick={(row) => router.push(`/admin/users/${row.id}`)}
          emptyState={isLoading ? "Loading" : "No users yet."}
        />
      </div>
    </>
  );
}

/** Registered as `admin.users`. */
export default function AdminUsersPage() {
  return (
    <AdminGate permission="admin:users">
      <UsersList />
    </AdminGate>
  );
}
