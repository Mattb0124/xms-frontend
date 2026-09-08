"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { BatchList } from "@/components/admin/migration/batch-list";
import { ReconciliationTab } from "@/components/admin/migration/reconciliation-tab";
import { AdminGate, PRIMARY_BUTTON } from "@/components/admin/primitives";
import { HeaderAction, HeaderFilters } from "@/components/shell/content-header-bar";
import { FilterSelect } from "@/components/xms/filter-select";
import { ICON, PlusIcon } from "@/components/xms/icons";
import { Panel } from "@/components/xms/panel";
import { Skeleton } from "@/components/xms/skeleton";
import { TabBar } from "@/components/xms/tab-bar";
import { filterFromSearch, filterToSearch } from "@/lib/migration/filters";
import { BATCH_STATUSES, OBJECT_KINDS } from "@/lib/migration/vocab";
import { useListBatchesQuery, type BatchFilter } from "@/redux/migrationApi";
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
  const [tab, setTab] = useState("batches");
  const names = useMemo(
    () => Object.fromEntries((accounts.data ?? []).map((account) => [account.id, account.name])),
    [accounts.data],
  );

  const apply = (next: BatchFilter) => router.replace(`${pathname}${filterToSearch(next)}`);

  return (
    <>
      {/* The three dimensions stand on the strip. The primary read "Show:
          Batches", which named the screen rather than narrowing it, and the
          controls that set the rest were in a card called "Add filter" with a
          Done button, in the page body. */}
      <HeaderFilters>
        <FilterSelect
          label="Show"
          primary
          count={(batches.data ?? []).length}
          value={filter.status ?? ""}
          options={BATCH_STATUSES.map((status) => ({ value: status.value, label: status.label }))}
          onChange={(value) => apply({ ...filter, status: value || undefined })}
        />
        <FilterSelect
          label="Account"
          value={filter.account_id ?? ""}
          options={(accounts.data ?? []).map((account) => ({ value: account.id, label: account.name }))}
          onChange={(value) => apply({ ...filter, account_id: value || undefined })}
        />
        <FilterSelect
          label="Objects"
          value={filter.object_kind ?? ""}
          options={OBJECT_KINDS.map((kind) => ({ value: kind.value, label: kind.label }))}
          onChange={(value) => apply({ ...filter, object_kind: value || undefined })}
        />
      </HeaderFilters>
      <HeaderAction>
        <Link href="/admin/migration/new" className={`${PRIMARY_BUTTON} inline-flex items-center gap-1`}>
          <PlusIcon size={ICON.action} />
          New
        </Link>
      </HeaderAction>
      <div className="flex flex-col gap-4">
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
