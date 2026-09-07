"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AccountSettingsTab } from "@/components/admin/account-settings-tab";
import { BillingPeriodsTab } from "@/components/admin/billing/billing-periods-tab";
import { AccountCalendarsTab } from "@/components/admin/calendars/account-calendars-tab";
import { AccountConfigTab } from "@/components/admin/config/account-config-tab";
import { AccountConnectorsTab } from "@/components/admin/connectors/account-connectors-tab";
import { AccountContractsTab } from "@/components/admin/contracts/account-contracts-tab";
import { GrantsReconcile } from "@/components/admin/grants-reconcile";
import { IntakeTab } from "@/components/admin/intake-tab";
import { AccountBudgetView } from "@/components/time/budget-view";
import {
  AccountStatusPill,
  AdminGate,
  ConfirmButton,
  FieldRow,
  INPUT,
  InlineError,
  PRIMARY_BUTTON,
  RecordBar,
  UserStatusPill,
  formatDate,
  fullName,
} from "@/components/admin/primitives";
import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { Panel } from "@/components/xms/panel";
import { RecordForm } from "@/components/xms/record-form";
import { Skeleton } from "@/components/xms/skeleton";
import { TabBar } from "@/components/xms/tab-bar";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import { useMutationErrors } from "@/lib/admin/use-mutation-errors";
import { useTrack } from "@/lib/telemetry/provider";
import {
  useGetAccountGranteesQuery,
  useGetAccountQuery,
  useInvitePortalUserMutation,
  useListPortalUsersQuery,
  useListRolesQuery,
  useListUsersQuery,
  useReplaceAccountGranteesMutation,
  useTransitionAccountMutation,
  useUpdateAccountMutation,
  type UserRecord,
} from "@/redux/adminApi";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "settings", label: "Settings" },
  { key: "access", label: "Access" },
  { key: "calendars", label: "Calendars" },
  { key: "contracts", label: "Contracts" },
  { key: "budget", label: "Budget" },
  { key: "billing", label: "Billing" },
  { key: "intake", label: "Intake" },
  { key: "connectors", label: "Connectors" },
  { key: "configuration", label: "Configuration" },
];

function OverviewTab({ id }: { id: string }) {
  const { data, refetch } = useGetAccountQuery(id);
  const [update] = useUpdateAccountMutation();
  const onError = useMutationErrors(refetch);
  const { push } = useToast();
  if (!data) return <Skeleton lines={6} className="max-w-md" />;
  const fields = [
    { key: "key", label: "Key", value: data.key, readOnly: true, mono: true },
    { key: "name", label: "Name", value: data.name },
    { key: "legal_name", label: "Legal name", value: data.legal_name ?? "" },
    {
      key: "isolation_tier",
      label: "Isolation tier",
      value: data.isolation_tier,
      kind: "select" as const,
      options: [
        { value: "shared", label: "Shared (row-level security)" },
        { value: "dedicated", label: "Dedicated database" },
      ],
    },
    { key: "residency_region", label: "Residency region", value: data.residency_region, mono: true },
    { key: "default_time_zone", label: "Default time zone", value: data.default_time_zone },
    { key: "created_at", label: "Created", value: formatDate(data.created_at), readOnly: true, mono: true },
    { key: "updated_at", label: "Updated", value: formatDate(data.updated_at), readOnly: true, mono: true },
  ];
  return (
    <Panel title="Identity and residency" caption={`version ${data.version}`}>
      <RecordForm
        fields={fields}
        onCommit={async (key, value) => {
          const body: Record<string, unknown> = {
            version: data.version,
            [key]: key === "legal_name" && value === "" ? null : value,
          };
          await update({ id, body: body as never }).unwrap();
          if (key === "isolation_tier") {
            push({
              title: "Isolation tier recorded",
              detail: "A migration runbook follows before the account moves.",
              tone: "info",
            });
          }
        }}
        onRollback={(_key, _restored, error) => onError(error)}
      />
    </Panel>
  );
}

const PORTAL_COLUMNS: DenseColumn<UserRecord>[] = [
  { key: "email", title: "Email", sortValue: (row) => row.email, mono: true },
  { key: "name", title: "Name", sortValue: (row) => fullName(row), render: (row) => fullName(row) },
  {
    key: "status",
    title: "Status",
    sortValue: (row) => row.status,
    render: (row) => <UserStatusPill status={row.status} />,
  },
  {
    key: "last",
    title: "Last sign-in",
    sortValue: (row) => row.last_sign_in_at ?? "",
    render: (row) => formatDate(row.last_sign_in_at),
    mono: true,
  },
];

function AccessTab({ id }: { id: string }) {
  const grantees = useGetAccountGranteesQuery(id);
  const internal = useListUsersQuery({ kind: "internal" });
  const [replace, { isLoading: saving }] = useReplaceAccountGranteesMutation();
  const onError = useMutationErrors(grantees.refetch);
  const trackGrants = useTrack("grants.save");
  const portalUsers = useListPortalUsersQuery(id);
  const portalRoles = useListRolesQuery({ catalog: "portal" });
  const [invite, { isLoading: inviting }] = useInvitePortalUserMutation();
  const trackInvite = useTrack("user.invite");
  const [form, setForm] = useState({ email: "", first_name: "", last_name: "", role_id: "" });
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(
    () =>
      (internal.data ?? [])
        .filter((user) => user.status !== "deactivated")
        .map((user) => ({ id: user.id, label: fullName(user), detail: user.email })),
    [internal.data],
  );
  const selected = useMemo(() => (grantees.data ?? []).map((grant) => grant.user_id), [grantees.data]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Internal users granted" caption="Who sees this account (reconciled as a whole set)">
        {grantees.data && internal.data ? (
          <GrantsReconcile
            title="Grants"
            options={options}
            selected={selected}
            saving={saving}
            onSave={async (ids) => {
              try {
                await replace({ id, user_ids: ids }).unwrap();
                trackGrants({ account_id: id, count: ids.length });
              } catch (caught) {
                onError(caught);
              }
            }}
          />
        ) : (
          <Skeleton lines={5} />
        )}
      </Panel>
      <div className="flex flex-col gap-4">
        <Panel title="Invite portal user" caption="Sent through Clerk when configured">
          <form
            className="flex flex-col gap-3"
            onSubmit={async (event) => {
              event.preventDefault();
              setError(null);
              try {
                await invite({
                  id,
                  body: {
                    email: form.email.trim(),
                    first_name: form.first_name.trim() || undefined,
                    last_name: form.last_name.trim() || undefined,
                    role_ids: form.role_id ? [form.role_id] : undefined,
                  },
                }).unwrap();
                trackInvite({ kind: "portal", account_id: id });
                setForm({ email: "", first_name: "", last_name: "", role_id: "" });
              } catch (caught) {
                setError(describeError(apiError(caught)));
              }
            }}
          >
            <FieldRow label="Email" htmlFor="portal-email">
              <input
                id="portal-email"
                type="email"
                required
                className={INPUT}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </FieldRow>
            <FieldRow label="First name" htmlFor="portal-first">
              <input
                id="portal-first"
                className={INPUT}
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              />
            </FieldRow>
            <FieldRow label="Last name" htmlFor="portal-last">
              <input
                id="portal-last"
                className={INPUT}
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              />
            </FieldRow>
            <FieldRow label="Portal role" htmlFor="portal-role">
              <select
                id="portal-role"
                className={INPUT}
                value={form.role_id}
                onChange={(e) => setForm({ ...form, role_id: e.target.value })}
              >
                <option value="">No role yet</option>
                {(portalRoles.data ?? []).map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </FieldRow>
            <InlineError message={error} />
            <div>
              <button type="submit" className={PRIMARY_BUTTON} disabled={inviting}>
                Invite
              </button>
            </div>
          </form>
        </Panel>
        <DenseTable
          title="Portal users"
          count={portalUsers.data?.length ?? 0}
          columns={PORTAL_COLUMNS}
          rows={portalUsers.data ?? []}
          rowKey={(row) => row.id}
          loading={portalUsers.isLoading}
          emptyState="No portal users invited yet."
        />
      </div>
    </div>
  );
}

/** The tab a link opens (`?tab=budget` from the threshold notifications); the overview otherwise. */
export function initialTab(search: URLSearchParams | null): string {
  const requested = search?.get("tab");
  return requested && TABS.some((tab) => tab.key === requested) ? requested : "overview";
}

function AccountRecordScreen() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const search = useSearchParams();
  const { data, refetch } = useGetAccountQuery(id);
  const [transition, { isLoading: transitioning }] = useTransitionAccountMutation();
  const onError = useMutationErrors(refetch);
  const [tab, setTab] = useState(() => initialTab(search));

  const act = async (action: "activate" | "suspend" | "offboard") => {
    try {
      await transition({ id, action }).unwrap();
    } catch (caught) {
      onError(caught);
    }
  };

  return (
    <>
      {data ? (
        <RecordBar
          backHref="/admin/accounts"
          backLabel="Accounts"
          keyText={data.key}
          title={data.name}
          pill={<AccountStatusPill status={data.status} />}
          actions={
            <>
              {data.status === "onboarding" || data.status === "suspended" ? (
                <ConfirmButton label="Activate" onConfirm={() => act("activate")} disabled={transitioning} />
              ) : null}
              {data.status === "active" ? (
                <ConfirmButton label="Suspend" onConfirm={() => act("suspend")} disabled={transitioning} danger />
              ) : null}
              {data.status === "onboarding" || data.status === "active" || data.status === "suspended" ? (
                <ConfirmButton label="Offboard" onConfirm={() => act("offboard")} disabled={transitioning} danger />
              ) : null}
            </>
          }
        />
      ) : (
        <Skeleton lines={1} className="mb-4 max-w-sm" />
      )}
      <TabBar tabs={TABS} active={tab} onChange={setTab} className="mb-4" />
      {tab === "overview" ? <OverviewTab id={id} /> : null}
      {tab === "settings" ? <AccountSettingsTab accountId={id} /> : null}
      {tab === "access" ? <AccessTab id={id} /> : null}
      {tab === "calendars" ? <AccountCalendarsTab accountId={id} /> : null}
      {tab === "contracts" ? <AccountContractsTab accountId={id} /> : null}
      {tab === "budget" ? <AccountBudgetView accountId={id} /> : null}
      {tab === "billing" ? <BillingPeriodsTab accountId={id} /> : null}
      {tab === "intake" ? <IntakeTab accountId={id} /> : null}
      {tab === "connectors" ? <AccountConnectorsTab accountId={id} /> : null}
      {tab === "configuration" ? <AccountConfigTab accountId={id} /> : null}
    </>
  );
}

/**
 * Registered as `admin.account`: Overview, Settings, Access, Calendars,
 * Contracts, Budget, Billing, Intake, Connectors and Configuration tabs with the
 * status actions; `?tab=` picks the opening tab.
 */
export default function AdminAccountRecordPage() {
  return (
    <AdminGate permission="admin:accounts">
      <Suspense fallback={<Skeleton lines={6} />}>
        <AccountRecordScreen />
      </Suspense>
    </AdminGate>
  );
}
