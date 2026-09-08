"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AdminGate,
  FieldRow,
  INPUT,
  InlineError,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
} from "@/components/admin/primitives";
import { HeaderAction } from "@/components/shell/content-header-bar";
import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { KeyLink } from "@/components/xms/key-link";
import { Panel } from "@/components/xms/panel";
import { StatePill } from "@/components/xms/state-pill";
import { apiError, describeError } from "@/lib/admin/api-error";
import { useCreateGroupMutation, useListGroupsQuery, type GroupRecord } from "@/redux/adminApi";

const COLUMNS: DenseColumn<GroupRecord>[] = [
  {
    key: "name",
    title: "Group",
    sortValue: (row) => row.name,
    render: (row) => <KeyLink ticketKey={row.name} href={`/admin/groups/${row.id}`} className="font-sans" />,
  },
  { key: "service_line", title: "Service line", sortValue: (row) => row.service_line ?? "" },
  { key: "description", title: "Description", sortValue: (row) => row.description },
  {
    key: "status",
    title: "Status",
    sortValue: (row) => row.status,
    render: (row) => <StatePill state={row.status === "active" ? "resolved" : "closed"} label={row.status} />,
  },
];

function NewGroupForm({ onDone }: { onDone: (id: string) => void }) {
  const [create, { isLoading }] = useCreateGroupMutation();
  const [form, setForm] = useState({ name: "", description: "", service_line: "" });
  const [error, setError] = useState<string | null>(null);
  return (
    <Panel title="New group" caption="Assignment group">
      <form
        className="flex flex-col gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          try {
            const created = await create({
              name: form.name.trim(),
              description: form.description.trim() || undefined,
              service_line: form.service_line.trim() || null,
            }).unwrap();
            onDone(created.id);
          } catch (caught) {
            setError(describeError(apiError(caught)));
          }
        }}
      >
        <FieldRow label="Name" htmlFor="group-name">
          <input
            id="group-name"
            required
            className={INPUT}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </FieldRow>
        <FieldRow label="Service line" htmlFor="group-line">
          <input
            id="group-line"
            className={INPUT}
            value={form.service_line}
            onChange={(e) => setForm({ ...form, service_line: e.target.value })}
            placeholder="OneStream, Coupa, FCCS, EPM, Infrastructure"
          />
        </FieldRow>
        <FieldRow label="Description" htmlFor="group-desc">
          <input
            id="group-desc"
            className={INPUT}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </FieldRow>
        <InlineError message={error} />
        <div className="flex gap-2">
          <button type="submit" className={PRIMARY_BUTTON} disabled={isLoading}>
            Create group
          </button>
          <button type="button" className={SECONDARY_BUTTON} onClick={() => onDone("")}>
            Cancel
          </button>
        </div>
      </form>
    </Panel>
  );
}

/**
 * The screen itself, mounted only once the reader holds the permission,
 * so the queries below are never sent by someone the API would refuse
 * (review finding 25).
 */
function AdminGroupsPageBody() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const { data, isLoading } = useListGroupsQuery();
  return (
    <>
      <HeaderAction>
        <button type="button" className={PRIMARY_BUTTON} onClick={() => setCreating(true)}>
          New group
        </button>
      </HeaderAction>
      <div className="flex flex-col gap-4">
        {creating ? (
          <NewGroupForm
            onDone={(id) => {
              setCreating(false);
              if (id) router.push(`/admin/groups/${id}`);
            }}
          />
        ) : null}
        <DenseTable
          title="Assignment groups"
          columns={COLUMNS}
          rows={data ?? []}
          rowKey={(row) => row.id}
          loading={isLoading}
          onRowClick={(row) => router.push(`/admin/groups/${row.id}`)}
          emptyState={isLoading ? "Loading" : "No groups yet."}
        />
      </div>
    </>
  );
}

/** Registered as `admin.groups`. */
export default function AdminGroupsPage() {
  return (
    <AdminGate permission="admin:users">
      <AdminGroupsPageBody />
    </AdminGate>
  );
}
