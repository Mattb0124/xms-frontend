"use client";

import { useParams } from "next/navigation";
import { useMemo } from "react";
import { GrantsReconcile } from "@/components/admin/grants-reconcile";
import { AdminGate, RecordBar, fullName } from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { RecordForm } from "@/components/xms/record-form";
import { Skeleton } from "@/components/xms/skeleton";
import { StatePill } from "@/components/xms/state-pill";
import { useMutationErrors } from "@/lib/admin/use-mutation-errors";
import { useTrack } from "@/lib/telemetry/provider";
import {
  useGetGroupQuery,
  useListAssignableUsersQuery,
  useReplaceGroupMembersMutation,
  useUpdateGroupMutation,
} from "@/redux/adminApi";

/**
 * The screen itself, mounted only once the reader holds the permission,
 * so the queries below are never sent by someone the API would refuse
 * (review finding 25).
 */
function AdminGroupRecordPageBody() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data, refetch } = useGetGroupQuery(id);
  const users = useListAssignableUsersQuery();
  const [update] = useUpdateGroupMutation();
  const [replaceMembers, { isLoading: saving }] = useReplaceGroupMembersMutation();
  const onError = useMutationErrors(refetch);
  const track = useTrack("grants.save");

  const options = useMemo(
    () => (users.data ?? []).map((user) => ({ id: user.id, label: fullName(user), detail: user.email })),
    [users.data],
  );
  const selected = useMemo(() => (data?.members ?? []).map((member) => member.user_id), [data?.members]);

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
              { key: "service_line", label: "Service line", value: data.service_line ?? "" },
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
              const nullable = key === "lead_user_id" || key === "service_line";
              await update({
                id,
                body: { version: data.version, [key]: nullable && value === "" ? null : value } as never,
              }).unwrap();
            }}
            onRollback={(_key, _restored, caught) => onError(caught)}
          />
        </Panel>
        <Panel title="Members" caption="Internal users, reconciled as a whole set">
          {users.data ? (
            <GrantsReconcile
              title="Members"
              options={options}
              selected={selected}
              saving={saving}
              onSave={async (ids) => {
                try {
                  await replaceMembers({ id, user_ids: ids }).unwrap();
                  track({ group_id: id, count: ids.length });
                } catch (caught) {
                  onError(caught);
                }
              }}
            />
          ) : (
            <Skeleton lines={5} />
          )}
        </Panel>
      </div>
    </>
  );
}

/** Registered as `admin.group`: identity with the lead picker, members reconciled as a set. */
export default function AdminGroupRecordPage() {
  return (
    <AdminGate permission="admin:users">
      <AdminGroupRecordPageBody />
    </AdminGate>
  );
}
