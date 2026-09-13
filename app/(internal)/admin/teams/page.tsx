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
import { TextLink } from "@/components/xms/key-link";
import { Panel } from "@/components/xms/panel";
import { StatePill } from "@/components/xms/state-pill";
import { apiError, describeError } from "@/lib/admin/api-error";
import { useCreateTeamMutation, useListTeamsQuery, type TeamSummary } from "@/redux/adminApi";

/**
 * Teams (TM-23): the people and the accounts they are responsible for. The
 * two counts are what the list is read for, so they are columns rather than
 * something to open a record to find.
 */
const COLUMNS: DenseColumn<TeamSummary>[] = [
  {
    key: "name",
    title: "Team",
    sortValue: (row) => row.name,
    render: (row) => <TextLink href={`/admin/teams/${row.id}`}>{row.name}</TextLink>,
  },
  {
    key: "lead",
    title: "Lead",
    sortValue: (row) => row.lead_name ?? "",
    render: (row) => row.lead_name ?? "Unassigned",
  },
  { key: "description", title: "Description", sortValue: (row) => row.description },
  {
    key: "members",
    title: "People",
    sortValue: (row) => row.member_count,
    render: (row) => row.member_count,
    mono: true,
  },
  {
    key: "accounts",
    title: "Accounts",
    sortValue: (row) => row.account_count,
    render: (row) => row.account_count,
    mono: true,
  },
  {
    key: "status",
    title: "Status",
    sortValue: (row) => row.status,
    render: (row) => <StatePill state={row.status === "active" ? "resolved" : "closed"} label={row.status} />,
  },
];

function NewTeamForm({ onDone }: { onDone: (id: string) => void }) {
  const [create, { isLoading }] = useCreateTeamMutation();
  const [form, setForm] = useState({ name: "", description: "" });
  const [error, setError] = useState<string | null>(null);
  return (
    <Panel title="New team" caption="People and the accounts they answer for">
      <form
        className="flex flex-col gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          try {
            const created = await create({
              name: form.name.trim(),
              description: form.description.trim() || undefined,
            }).unwrap();
            onDone(created.id);
          } catch (caught) {
            setError(describeError(apiError(caught)));
          }
        }}
      >
        <FieldRow label="Name" htmlFor="team-name">
          <input
            id="team-name"
            required
            className={INPUT}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </FieldRow>
        <FieldRow label="Description" htmlFor="team-desc">
          <input
            id="team-desc"
            className={INPUT}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </FieldRow>
        <InlineError message={error} />
        <div className="flex gap-2">
          <button type="submit" className={PRIMARY_BUTTON} disabled={isLoading}>
            Create team
          </button>
          <button type="button" className={SECONDARY_BUTTON} onClick={() => onDone("")}>
            Cancel
          </button>
        </div>
      </form>
    </Panel>
  );
}

function AdminTeamsPageBody() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const { data, isLoading } = useListTeamsQuery();
  return (
    <>
      <HeaderAction>
        <button type="button" className={PRIMARY_BUTTON} onClick={() => setCreating(true)}>
          New team
        </button>
      </HeaderAction>
      <div className="flex flex-col gap-4">
        {creating ? (
          <NewTeamForm
            onDone={(id) => {
              setCreating(false);
              if (id) router.push(`/admin/teams/${id}`);
            }}
          />
        ) : null}
        <DenseTable
          title="Teams"
          columns={COLUMNS}
          rows={data ?? []}
          rowKey={(row) => row.id}
          loading={isLoading}
          onRowClick={(row) => router.push(`/admin/teams/${row.id}`)}
          emptyState={isLoading ? "Loading" : "No teams yet."}
        />
      </div>
    </>
  );
}

/** Registered as `admin.teams`. */
export default function AdminTeamsPage() {
  return (
    <AdminGate permission="admin:users">
      <AdminTeamsPageBody />
    </AdminGate>
  );
}
