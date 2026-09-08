"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AdminGate, INPUT } from "@/components/admin/primitives";
import { CapacityTabs } from "@/components/capacity/capacity-tabs";
import { AddDemandForm } from "@/components/capacity/demand-form";
import { ImportDemandPanel } from "@/components/capacity/demand-import";
import { DemandTable } from "@/components/capacity/demand-table";
import { HeaderFilters } from "@/components/shell/content-header-bar";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { FilterBar, type FilterCriterion } from "@/components/xms/filter-bar";
import { Skeleton } from "@/components/xms/skeleton";
import { useToast } from "@/components/xms/toast";
import { capacityError, describeCapacityError } from "@/lib/capacity/errors";
import { demandFilterFromSearch, demandFilterToSearch, type DemandPageFilter } from "@/lib/capacity/filters";
import { demandSubject, monthLabel } from "@/lib/capacity/vocab";
import { useTrack } from "@/lib/telemetry/provider";
import { cn } from "@/lib/utils";
import { useListDemandQuery, useRemoveDemandMutation, type DemandRow } from "@/redux/capacityApi";
import { useMe } from "@/redux/me";
import { useListGrantedAccountsQuery } from "@/redux/ticketsApi";

const CONTROL = cn(INPUT, "h-[30px] text-[12px]");

function DemandScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const me = useMe();
  const searchString = search.toString();
  const filter = useMemo(() => demandFilterFromSearch(new URLSearchParams(searchString)), [searchString]);
  const canManage = me.hasPermission("capacity:manage");
  const canDirectory = me.hasPermission("tickets:view");
  const list = useListDemandQuery(filter);
  const accounts = useListGrantedAccountsQuery(undefined, { skip: !canDirectory });
  const [remove] = useRemoveDemandMutation();
  const [removing, setRemoving] = useState<string | null>(null);
  const { push } = useToast();
  const track = useTrack("capacity.demand.remove");

  const apply = (next: DemandPageFilter) => router.replace(`${pathname}${demandFilterToSearch(next)}`);
  const accountName = (id: string) => {
    const account = accounts.data?.find((row) => row.id === id);
    return account ? `${account.key} ${account.name}` : id.slice(0, 8);
  };
  const criteria: FilterCriterion[] = [];
  if (filter.account) criteria.push({ key: "account", label: "Account", value: accountName(filter.account) });

  const onRemove = async (row: DemandRow) => {
    setRemoving(row.id);
    try {
      await remove(row.id).unwrap();
      track({ demand_id: row.id, source: row.source });
      push({
        title: "Demand removed",
        detail: `${demandSubject(row)}, ${monthLabel(row.period_month)}.`,
        tone: "success",
      });
    } catch (caught) {
      push({ title: "Not removed", detail: describeCapacityError(capacityError(caught)), tone: "error" });
    } finally {
      setRemoving(null);
    }
  };

  return (
    <>
      <HeaderFilters>
        <FilterBar
          primary={{ label: "Months", value: `${monthLabel(filter.from)} to ${monthLabel(filter.to)}` }}
          criteria={criteria}
          onRemove={(key) => apply({ ...filter, [key]: undefined })}
          onAdd={() => undefined}
          onClearAll={() => apply({ from: filter.from, to: filter.to })}
        />
      </HeaderFilters>
      <CapacityTabs active="demand" />
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Demand filters">
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-xms-label">From</span>
            <input
              type="month"
              aria-label="From month"
              className={cn(CONTROL, "xms-mono w-[160px]")}
              value={filter.from}
              onChange={(event) => {
                if (event.target.value)
                  apply({
                    ...filter,
                    from: event.target.value,
                    to: filter.to < event.target.value ? event.target.value : filter.to,
                  });
              }}
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-xms-label">To</span>
            <input
              type="month"
              aria-label="To month"
              min={filter.from}
              className={cn(CONTROL, "xms-mono w-[160px]")}
              value={filter.to}
              onChange={(event) => {
                if (event.target.value && event.target.value >= filter.from)
                  apply({ ...filter, to: event.target.value });
              }}
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-xms-label">Account</span>
            <select
              aria-label="Filter by account"
              className={cn(CONTROL, "w-[220px]")}
              value={filter.account ?? ""}
              disabled={!accounts.data}
              onChange={(event) => apply({ ...filter, account: event.target.value || undefined })}
            >
              <option value="">{accounts.data ? "Any account" : "Accounts need tickets:view"}</option>
              {(accounts.data ?? []).map((account) => (
                <option key={account.id} value={account.id}>
                  {account.key} {account.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {list.isLoading && !list.data ? <Skeleton lines={8} /> : null}
        {list.isError ? (
          <EmptyBanner
            title="The demand could not be loaded"
            detail={describeCapacityError(capacityError(list.error))}
            action={{ label: "Retry", onClick: () => void list.refetch() }}
          />
        ) : null}
        {list.data ? (
          <DemandTable list={list.data} canManage={canManage} onRemove={onRemove} removing={removing} />
        ) : null}
        {canManage ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <AddDemandForm accounts={accounts.data} defaultMonth={filter.from} />
            <ImportDemandPanel />
          </div>
        ) : null}
      </div>
    </>
  );
}

/**
 * Registered as `capacity.demand` (Capacity & Allocation functional 5.7,
 * CAP-08): pipeline and project demand over a month range (the current
 * month to three months ahead by default) with an account filter, the
 * lines with their weighted hours and the totals, Remove, the Add demand
 * form and the CSV import under capacity:manage.
 */
export default function CapacityDemandPage() {
  return (
    <AdminGate permission="capacity:view">
      <Suspense fallback={<Skeleton lines={8} />}>
        <DemandScreen />
      </Suspense>
    </AdminGate>
  );
}
