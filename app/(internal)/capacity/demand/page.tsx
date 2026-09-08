"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AdminGate } from "@/components/admin/primitives";
import { CapacityTabs } from "@/components/capacity/capacity-tabs";
import { AddDemandForm } from "@/components/capacity/demand-form";
import { ImportDemandPanel } from "@/components/capacity/demand-import";
import { DemandTable } from "@/components/capacity/demand-table";
import { MonthSelect } from "@/components/capacity/month-select";
import { HeaderFilters } from "@/components/shell/content-header-bar";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { FilterSelect } from "@/components/xms/filter-select";
import { Skeleton } from "@/components/xms/skeleton";
import { useToast } from "@/components/xms/toast";
import { capacityError, describeCapacityError } from "@/lib/capacity/errors";
import { demandFilterFromSearch, demandFilterToSearch, type DemandPageFilter } from "@/lib/capacity/filters";
import { demandSubject, monthLabel } from "@/lib/capacity/vocab";
import { useTrack } from "@/lib/telemetry/provider";
import { useListDemandQuery, useRemoveDemandMutation, type DemandRow } from "@/redux/capacityApi";
import { useMe } from "@/redux/me";
import { useListGrantedAccountsQuery } from "@/redux/ticketsApi";

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
      {/* From, To and Account stand on the grey strip. Two native month
          inputs and a select sat in the page body under a strip that showed
          the range as a pill that did nothing. */}
      <HeaderFilters>
        <MonthSelect
          label="From"
          primary
          month={filter.from}
          onChange={(month) => apply({ ...filter, from: month, to: filter.to < month ? month : filter.to })}
        />
        <MonthSelect
          label="To"
          month={filter.to}
          onChange={(month) => apply({ ...filter, to: month < filter.from ? filter.from : month })}
        />
        <FilterSelect
          label="Account"
          value={filter.account ?? ""}
          options={(accounts.data ?? []).map((account) => ({
            value: account.id,
            label: `${account.key} ${account.name}`,
          }))}
          onChange={(value) => apply({ ...filter, account: value || undefined })}
        />
      </HeaderFilters>
      <CapacityTabs active="demand" />
      <div className="flex flex-col gap-4">
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
