"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  AccountStatusPill,
  AdminGate,
  FieldRow,
  INPUT,
  InlineError,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
} from "@/components/admin/primitives";
import { HeaderAction, HeaderFilters } from "@/components/shell/content-header-bar";
import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { useListArrangement } from "@/components/xms/use-list-arrangement";
import { FilterSelect } from "@/components/xms/filter-select";
import { ICON, PlusIcon } from "@/components/xms/icons";
import { KeyLink } from "@/components/xms/key-link";
import { Panel } from "@/components/xms/panel";
import { apiError, describeError } from "@/lib/admin/api-error";
import { useTrack } from "@/lib/telemetry/provider";
import { useCreateAccountMutation, useListAccountsQuery, type AccountRow, type IsolationTier } from "@/redux/adminApi";

const STATUSES = ["onboarding", "active", "suspended", "offboarding", "offboarded"];

const COLUMNS: DenseColumn<AccountRow>[] = [
  {
    key: "key",
    title: "Key",
    mono: true,
    width: "110px",
    sortValue: (row) => row.key,
    render: (row) => <KeyLink ticketKey={row.key} href={`/admin/accounts/${row.id}`} />,
  },
  { key: "name", title: "Name", sortValue: (row) => row.name },
  {
    key: "status",
    title: "Status",
    sortValue: (row) => row.status,
    render: (row) => <AccountStatusPill status={row.status} />,
  },
  { key: "tier", title: "Isolation", sortValue: (row) => row.isolation_tier },
  { key: "region", title: "Region", sortValue: (row) => row.residency_region, mono: true },
  { key: "tz", title: "Time zone", sortValue: (row) => row.default_time_zone },
];

function NewAccountForm({ onDone }: { onDone: (id: string) => void }) {
  const [create, { isLoading }] = useCreateAccountMutation();
  const track = useTrack("account.create");
  const [form, setForm] = useState({
    key: "",
    name: "",
    legal_name: "",
    default_time_zone: "UTC",
    isolation_tier: "shared" as IsolationTier,
  });
  const [error, setError] = useState<string | null>(null);
  return (
    <Panel title="New account" caption="Onboarding starts here">
      <form
        className="flex flex-col gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          try {
            const created = await create({
              key: form.key.trim().toUpperCase(),
              name: form.name.trim(),
              legal_name: form.legal_name.trim() || undefined,
              default_time_zone: form.default_time_zone.trim() || undefined,
              isolation_tier: form.isolation_tier,
            }).unwrap();
            track({ account_id: created.id });
            onDone(created.id);
          } catch (caught) {
            setError(describeError(apiError(caught)));
          }
        }}
      >
        <FieldRow label="Key" htmlFor="new-key">
          <input
            id="new-key"
            className={`${INPUT} xms-mono uppercase`}
            value={form.key}
            maxLength={8}
            onChange={(e) => setForm({ ...form, key: e.target.value })}
            required
          />
        </FieldRow>
        <FieldRow label="Name" htmlFor="new-name">
          <input
            id="new-name"
            className={INPUT}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </FieldRow>
        <FieldRow label="Legal name" htmlFor="new-legal">
          <input
            id="new-legal"
            className={INPUT}
            value={form.legal_name}
            onChange={(e) => setForm({ ...form, legal_name: e.target.value })}
          />
        </FieldRow>
        <FieldRow label="Time zone" htmlFor="new-tz">
          <input
            id="new-tz"
            className={INPUT}
            value={form.default_time_zone}
            onChange={(e) => setForm({ ...form, default_time_zone: e.target.value })}
          />
        </FieldRow>
        <FieldRow label="Isolation" htmlFor="new-tier">
          <select
            id="new-tier"
            className={INPUT}
            value={form.isolation_tier}
            onChange={(e) => setForm({ ...form, isolation_tier: e.target.value as IsolationTier })}
          >
            <option value="shared">Shared (row-level security)</option>
            <option value="dedicated">Dedicated database</option>
          </select>
        </FieldRow>
        <InlineError message={error} />
        <div className="flex gap-2">
          <button type="submit" className={PRIMARY_BUTTON} disabled={isLoading}>
            Create account
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
function AdminAccountsPageBody() {
  const router = useRouter();
  // The reader's own arrangement of this list, behind the strip's gear.
  const arrangement = useListArrangement("accounts", COLUMNS);
  const [status, setStatus] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { data, isLoading } = useListAccountsQuery(status ? { status } : undefined);
  const rows = useMemo(() => data ?? [], [data]);

  return (
    <>
      {/* The strip's primary read "Show: Accounts", which named the screen
          rather than narrowing it, and the status was reached by clicking
          "+ Add filter" until the right one came round. */}
      <HeaderFilters>
        <FilterSelect
          label="Show"
          primary
          count={rows.length}
          value={status ?? ""}
          options={STATUSES.map((entry) => ({ value: entry, label: entry }))}
          onChange={(value) => setStatus(value || null)}
        />
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
          <NewAccountForm
            onDone={(id) => {
              setCreating(false);
              if (id) router.push(`/admin/accounts/${id}`);
            }}
          />
        ) : null}
        <DenseTable
          title="Accounts"
          subtitle="every client account, its isolation tier and where it is in its life"
          columns={arrangement.columns}
          display={arrangement.display}
          rows={rows}
          rowKey={(row) => row.id}
          loading={isLoading}
          onRowClick={(row) => router.push(`/admin/accounts/${row.id}`)}
          emptyState={isLoading ? "Loading" : "No accounts yet. Create the first one with New."}
        />
        {arrangement.dialogue}
      </div>
    </>
  );
}

/** Registered as `admin.accounts`: the dense list with status chips and the New action. */
export default function AdminAccountsPage() {
  return (
    <AdminGate permission="admin:accounts">
      <AdminAccountsPageBody />
    </AdminGate>
  );
}
