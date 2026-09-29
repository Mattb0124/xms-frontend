"use client";

import { useParams } from "next/navigation";
import { useMemo } from "react";
import { GrantsReconcile } from "@/components/admin/grants-reconcile";
import { AdminGate, RecordBar, fullName } from "@/components/admin/primitives";
import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { TextLink } from "@/components/xms/key-link";
import { Panel } from "@/components/xms/panel";
import { RecordForm } from "@/components/xms/record-form";
import { Skeleton } from "@/components/xms/skeleton";
import { StatePill } from "@/components/xms/state-pill";
import { useMutationErrors } from "@/lib/admin/use-mutation-errors";
import { useTrack } from "@/lib/telemetry/provider";
import {
  useGetTeamQuery,
  useListAccountsQuery,
  useListAssignableUsersQuery,
  useSetTeamAccountsMutation,
  useSetTeamMembersMutation,
  useUpdateTeamMutation,
  type TeamAccount,
} from "@/redux/adminApi";

/**
 * The book of business, with the owner of each account beside it: a team
 * record answers "who looks after these clients, and who answers for each
 * one" in the same view (TM-23).
 */
const ACCOUNT_COLUMNS: DenseColumn<TeamAccount>[] = [
  {
    key: "key",
    title: "Key",
    sortValue: (row) => row.key,
    render: (row) => <TextLink href={`/admin/accounts/${row.account_id}`}>{row.key}</TextLink>,
    mono: true,
  },
  { key: "name", title: "Account", sortValue: (row) => row.name },
  {
    key: "owner",
    title: "Owner",
    sortValue: (row) => row.owner_name ?? "",
    render: (row) => row.owner_name ?? "Unassigned",
  },
  { key: "status", title: "Status", sortValue: (row) => row.status },
];

function AdminTeamRecordPageBody() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data, refetch } = useGetTeamQuery(id);
  const users = useListAssignableUsersQuery();
  const accounts = useListAccountsQuery({});
  const [update] = useUpdateTeamMutation();
  const [setMembers, { isLoading: savingMembers }] = useSetTeamMembersMutation();
  const [setAccounts, { isLoading: savingAccounts }] = useSetTeamAccountsMutation();
  const onError = useMutationErrors(refetch);
  const trackMembers = useTrack("grants.save");

  const userOptions = useMemo(
    () => (users.data ?? []).map((user) => ({ id: user.id, label: fullName(user), detail: user.email })),
    [users.data],
  );
  const selectedMembers = useMemo(() => (data?.members ?? []).map((member) => member.user_id), [data?.members]);
  const accountOptions = useMemo(
    () => (accounts.data ?? []).map((account) => ({ id: account.id, label: account.name, detail: account.key })),
    [accounts.data],
  );
  const selectedAccounts = useMemo(() => (data?.accounts ?? []).map((row) => row.account_id), [data?.accounts]);

  if (!data) return <Skeleton lines={6} className="max-w-md" />;
  const leadOptions = [
    { value: "", label: "No lead" },
    ...(users.data ?? []).map((user) => ({ value: user.id, label: fullName(user) })),
  ];

  return (
    <>
      <RecordBar
        title={data.name}
        pill={<StatePill state={data.status === "active" ? "resolved" : "closed"} label={data.status} />}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Identity" caption={`version ${data.version}`}>
          <RecordForm
            columns={1}
            fields={[
              { key: "name", label: "Name", value: data.name },
              { key: "description", label: "Description", value: data.description, kind: "textarea" },
              {
                key: "lead_user_id",
                label: "Lead",
                value: data.lead_user_id ?? "",
                kind: "select",
                options: leadOptions,
              },
              {
                key: "status",
                label: "Status",
                value: data.status,
                kind: "select",
                options: [
                  { value: "active", label: "Active" },
                  { value: "retired", label: "Retired" },
                ],
              },
            ]}
            onCommit={async (key, value) => {
              await update({
                id,
                body: { version: data.version, [key]: key === "lead_user_id" && value === "" ? null : value } as never,
              }).unwrap();
            }}
            onRollback={(_key, _restored, caught) => onError(caught)}
          />
        </Panel>
        <Panel title="People" caption="Internal users, reconciled as a whole set">
          {users.data ? (
            <GrantsReconcile
              title="People"
              options={userOptions}
              selected={selectedMembers}
              saving={savingMembers}
              onSave={async (ids) => {
                try {
                  await setMembers({ id, user_ids: ids }).unwrap();
                  trackMembers({ team_id: id, count: ids.length });
                } catch (caught) {
                  onError(caught);
                }
              }}
            />
          ) : (
            <Skeleton lines={5} />
          )}
        </Panel>
        <Panel
          title="Book of business"
          caption="An account belongs to one team; moving it is refused until the other team lets it go"
        >
          {accounts.data ? (
            <GrantsReconcile
              title="Accounts"
              options={accountOptions}
              selected={selectedAccounts}
              saving={savingAccounts}
              onSave={async (ids) => {
                try {
                  await setAccounts({ id, account_ids: ids }).unwrap();
                } catch (caught) {
                  onError(caught);
                }
              }}
            />
          ) : (
            <Skeleton lines={5} />
          )}
        </Panel>
        <DenseTable
          title="Accounts and their owners"
          columns={ACCOUNT_COLUMNS}
          rows={data.accounts}
          rowKey={(row) => row.account_id}
          emptyState="No accounts on this team yet."
        />
      </div>
    </>
  );
}

/** Registered as `admin.team`: identity, people, and the accounts the team answers for. */
export default function AdminTeamRecordPage() {
  return (
    <AdminGate permission="admin:users">
      <AdminTeamRecordPageBody />
    </AdminGate>
  );
}
