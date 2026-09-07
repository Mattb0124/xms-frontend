"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { PermissionChecklist } from "@/components/admin/permission-checklist";
import {
  AdminGate,
  ConfirmButton,
  InlineError,
  PRIMARY_BUTTON,
  RecordBar,
  SECONDARY_BUTTON,
} from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { RecordForm } from "@/components/xms/record-form";
import { Skeleton } from "@/components/xms/skeleton";
import { StatePill } from "@/components/xms/state-pill";
import { describeError } from "@/lib/admin/api-error";
import { useMutationErrors } from "@/lib/admin/use-mutation-errors";
import { useTrack } from "@/lib/telemetry/provider";
import { useGetRoleQuery, useListPermissionsQuery, useUpdateRoleMutation } from "@/redux/adminApi";

/** Registered as `admin.role`: name and description on the form, the permission checklist with implications. */
export default function AdminRoleRecordPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data, refetch } = useGetRoleQuery(id);
  const catalog = useListPermissionsQuery(data?.catalog ?? "operator", { skip: !data });
  const [update, { isLoading: saving }] = useUpdateRoleMutation();
  const onError = useMutationErrors(refetch);
  const track = useTrack("roles.save");
  const [draft, setDraft] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!data) return <Skeleton lines={6} className="max-w-md" />;
  const permissions = draft ?? data.permissions;
  const dirty =
    draft !== null &&
    (draft.length !== data.permissions.length || draft.some((key) => !data.permissions.includes(key)));

  const savePermissions = async () => {
    if (!draft) return;
    setError(null);
    try {
      await update({ id, body: { version: data.version, permissions: draft } }).unwrap();
      track({ role_id: id, count: draft.length });
      setDraft(null);
    } catch (caught) {
      const parsed = onError(caught);
      if (parsed.code === "last_administrator") setError(describeError(parsed));
    }
  };

  return (
    <AdminGate permission="admin:users">
      <RecordBar
        backHref="/admin/roles"
        backLabel="Roles"
        title={data.name}
        pill={<StatePill state={data.status === "active" ? "resolved" : "closed"} label={data.status} />}
        actions={
          data.is_system ? (
            <span className="text-xms-label text-[12px]">System role: name and status are fixed</span>
          ) : data.status === "active" ? (
            <ConfirmButton
              label="Retire"
              danger
              onConfirm={async () => {
                try {
                  await update({ id, body: { version: data.version, status: "retired" } }).unwrap();
                } catch (caught) {
                  const parsed = onError(caught);
                  if (parsed.code === "last_administrator") setError(describeError(parsed));
                }
              }}
            />
          ) : null
        }
      />
      <InlineError message={error} />
      <div className="grid gap-4">
        <Panel title="Identity" caption={`${data.catalog} catalog, version ${data.version}`}>
          <RecordForm
            fields={[
              { key: "name", label: "Name", value: data.name, readOnly: data.is_system },
              { key: "description", label: "Description", value: data.description },
            ]}
            onCommit={async (key, value) => {
              await update({ id, body: { version: data.version, [key]: value } as never }).unwrap();
            }}
            onRollback={(_key, _restored, caught) => onError(caught)}
          />
        </Panel>
        <Panel
          title="Permissions"
          caption="Implied keys are ticked automatically"
          actions={
            <>
              <button
                type="button"
                className={PRIMARY_BUTTON}
                disabled={!dirty || saving}
                onClick={() => void savePermissions()}
              >
                {saving ? "Saving" : "Save permissions"}
              </button>
              <button
                type="button"
                className={SECONDARY_BUTTON}
                disabled={!dirty || saving}
                onClick={() => setDraft(null)}
              >
                Reset
              </button>
            </>
          }
        >
          {catalog.data ? (
            <PermissionChecklist catalog={catalog.data} selected={permissions} onChange={setDraft} />
          ) : (
            <Skeleton lines={6} />
          )}
        </Panel>
      </div>
    </AdminGate>
  );
}
