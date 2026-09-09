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
import { HeaderAction, HeaderFilters } from "@/components/shell/content-header-bar";
import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { StripSelect } from "@/components/xms/filter-select";
import { ICON, PlusIcon } from "@/components/xms/icons";
import { TextLink } from "@/components/xms/key-link";
import { Panel } from "@/components/xms/panel";
import { StatePill } from "@/components/xms/state-pill";
import { apiError, describeError } from "@/lib/admin/api-error";
import { useCreateRoleMutation, useListRolesQuery, type Catalog, type RoleRecord } from "@/redux/adminApi";

const COLUMNS: DenseColumn<RoleRecord>[] = [
  {
    key: "name",
    title: "Role",
    sortValue: (row) => row.name,
    render: (row) => <TextLink href={`/admin/roles/${row.id}`}>{row.name}</TextLink>,
  },
  { key: "catalog", title: "Catalog", sortValue: (row) => row.catalog },
  { key: "count", title: "Permissions", mono: true, align: "right", sortValue: (row) => row.permissions.length },
  {
    key: "system",
    title: "System",
    sortValue: (row) => (row.is_system ? 1 : 0),
    render: (row) => (row.is_system ? "Yes" : ""),
  },
  {
    key: "status",
    title: "Status",
    sortValue: (row) => row.status,
    render: (row) => <StatePill state={row.status === "active" ? "resolved" : "closed"} label={row.status} />,
  },
];

function NewRoleForm({ catalog, onDone }: { catalog: Catalog; onDone: (id: string) => void }) {
  const [create, { isLoading }] = useCreateRoleMutation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Panel title="New role" caption={`${catalog} catalog; permissions are set on the record`}>
      <form
        className="flex flex-col gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          try {
            const created = await create({
              catalog,
              name: name.trim(),
              description: description.trim() || undefined,
              permissions: [],
            }).unwrap();
            onDone(created.id);
          } catch (caught) {
            setError(describeError(apiError(caught)));
          }
        }}
      >
        <FieldRow label="Name" htmlFor="role-name">
          <input id="role-name" required className={INPUT} value={name} onChange={(e) => setName(e.target.value)} />
        </FieldRow>
        <FieldRow label="Description" htmlFor="role-desc">
          <input
            id="role-desc"
            className={INPUT}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </FieldRow>
        <InlineError message={error} />
        <div className="flex gap-2">
          <button type="submit" className={PRIMARY_BUTTON} disabled={isLoading}>
            Create role
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
function AdminRolesPageBody() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<Catalog>("operator");
  const [creating, setCreating] = useState(false);
  const { data, isLoading } = useListRolesQuery({ catalog });
  return (
    <>
      {/* The catalog was a pill that swapped on click, so the other catalog
          was never named until you were in it. It is a menu, like every other
          primary dimension. */}
      <HeaderFilters>
        <StripSelect
          label="Catalog"
          primary
          value={catalog}
          onChange={(value) => setCatalog(value as Catalog)}
          display={catalog}
        >
          <option value="operator">Catalog: operator</option>
          <option value="portal">Catalog: portal</option>
        </StripSelect>
      </HeaderFilters>
      <HeaderAction>
        <button
          type="button"
          className={`${PRIMARY_BUTTON} inline-flex items-center gap-1`}
          onClick={() => setCreating(true)}
        >
          <PlusIcon size={ICON.action} />
          New
        </button>
      </HeaderAction>
      <div className="flex flex-col gap-4">
        {creating ? (
          <NewRoleForm
            catalog={catalog}
            onDone={(id) => {
              setCreating(false);
              if (id) router.push(`/admin/roles/${id}`);
            }}
          />
        ) : null}
        <DenseTable
          title={`${catalog === "operator" ? "Operator" : "Portal"} roles`}
          columns={COLUMNS}
          rows={data ?? []}
          rowKey={(row) => row.id}
          loading={isLoading}
          onRowClick={(row) => router.push(`/admin/roles/${row.id}`)}
        />
      </div>
    </>
  );
}

/** Registered as `admin.roles`: both catalogs, filtered by chip. */
export default function AdminRolesPage() {
  return (
    <AdminGate permission="admin:users">
      <AdminRolesPageBody />
    </AdminGate>
  );
}
