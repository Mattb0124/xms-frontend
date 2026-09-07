"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { BatchList } from "@/components/admin/migration/batch-list";
import { ReconciliationTab } from "@/components/admin/migration/reconciliation-tab";
import { AdminGate, INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { HeaderAction, HeaderFilters } from "@/components/shell/content-header-bar";
import { FilterBar, type FilterCriterion } from "@/components/xms/filter-bar";
import { Panel } from "@/components/xms/panel";
import { Skeleton } from "@/components/xms/skeleton";
import { TabBar } from "@/components/xms/tab-bar";
import { filterFromSearch, filterToSearch } from "@/lib/migration/filters";
import { BATCH_STATUSES, OBJECT_KINDS, batchStatusLabel, objectKindLabel } from "@/lib/migration/vocab";
import { useListBatchesQuery, type BatchFilter, type BatchStatus } from "@/redux/migrationApi";
import { useListGrantedAccountsQuery } from "@/redux/ticketsApi";

const TABS = [
  { key: "batches", label: "Batches" },
  { key: "reconciliation", label: "Reconciliation" },
];

function MigrationScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const searchString = search.toString();
  const filter = useMemo(() => filterFromSearch(new URLSearchParams(searchString)), [searchString]);
  const batches = useListBatchesQuery(filter, { pollingInterval: 30_000, refetchOnFocus: true });
  const accounts = useListGrantedAccountsQuery();
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState("batches");
  const names = useMemo(
    () => Object.fromEntries((accounts.data ?? []).map((account) => [account.id, account.name])),
    [accounts.data],
  );

  const apply = (next: BatchFilter) => router.replace(`${pathname}${filterToSearch(next)}`);
  const criteria: FilterCriterion[] = [];
  if (filter.account_id)
    criteria.push({
      key: "account_id",
      label: "Account",
      value: names[filter.account_id] ?? filter.account_id.slice(0, 8),
    });
  if (filter.object_kind)
    criteria.push({ key: "object_kind", label: "Objects", value: objectKindLabel(filter.object_kind) });
  if (filter.status)
    criteria.push({ key: "status", label: "Status", value: batchStatusLabel(filter.status as BatchStatus) });

  return (
    <>
      <HeaderFilters>
        <FilterBar
          primary={{ label: "Show", value: "Batches" }}
          criteria={criteria}
          onRemove={(key) => apply({ ...filter, [key]: undefined })}
          onAdd={() => setAdding((value) => !value)}
          onClearAll={() => apply({})}
        />
      </HeaderFilters>
      <HeaderAction>
        <Link href="/admin/migration/new" className={`${PRIMARY_BUTTON} inline-flex items-center hover:no-underline`}>
          New batch
        </Link>
      </HeaderAction>
      <div className="flex flex-col gap-4">
        {adding ? (
          <Panel title="Add filter" caption="Account, object kind or status">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="flex flex-col gap-1 text-[12px]">
                <span className="text-xms-label">Account</span>
                <select
                  aria-label="Filter by account"
                  className={INPUT}
                  value={filter.account_id ?? ""}
                  onChange={(event) => apply({ ...filter, account_id: event.target.value || undefined })}
                >
                  <option value="">Any account</option>
                  {(accounts.data ?? []).map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[12px]">
                <span className="text-xms-label">Object kind</span>
                <select
                  aria-label="Filter by object kind"
                  className={INPUT}
                  value={filter.object_kind ?? ""}
                  onChange={(event) => apply({ ...filter, object_kind: event.target.value || undefined })}
                >
                  <option value="">Any object kind</option>
                  {OBJECT_KINDS.map((kind) => (
                    <option key={kind.value} value={kind.value}>
                      {kind.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[12px]">
                <span className="text-xms-label">Status</span>
                <select
                  aria-label="Filter by status"
                  className={INPUT}
                  value={filter.status ?? ""}
                  onChange={(event) => apply({ ...filter, status: event.target.value || undefined })}
                >
                  <option value="">Any status</option>
                  {BATCH_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-3">
              <button type="button" className={SECONDARY_BUTTON} onClick={() => setAdding(false)}>
                Done
              </button>
            </div>
          </Panel>
        ) : null}
        <TabBar tabs={TABS} active={tab} onChange={setTab} />
        {tab === "batches" ? (
          <BatchList rows={batches.data ?? []} accountNames={names} loading={batches.isLoading} />
        ) : filter.account_id ? (
          <ReconciliationTab accountId={filter.account_id} />
        ) : (
          <Panel title="Reconciliation" caption="One account at a time">
            <p className="text-xms-label text-[13px]">
              Add an account filter to see its reconciliation reports, or open a batch and use its Reconciliation tab.
            </p>
          </Panel>
        )}
      </div>
    </>
  );
}

/** Registered as `admin.migration`: the Batches view with URL filters, the New batch action and the account's reconciliation. */
export default function AdminMigrationPage() {
  return (
    <AdminGate permission="admin:migration">
      <Suspense fallback={<Skeleton lines={8} />}>
        <MigrationScreen />
      </Suspense>
    </AdminGate>
  );
}
