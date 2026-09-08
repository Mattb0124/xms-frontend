"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { AdminGate } from "@/components/admin/primitives";
import { CapacityGrid } from "@/components/capacity/capacity-grid";
import { CapacityTabs } from "@/components/capacity/capacity-tabs";
import { DemandOverlay } from "@/components/capacity/demand-overlay";
import { MonthSelect } from "@/components/capacity/month-select";
import { HeaderFilters } from "@/components/shell/content-header-bar";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { FilterSelect } from "@/components/xms/filter-select";
import { Skeleton } from "@/components/xms/skeleton";
import { capacityFilterFromSearch, capacityFilterToSearch, type CapacityPageFilter } from "@/lib/capacity/filters";
import { ROLE_OPTIONS } from "@/lib/roster/vocab";
import { useCapacityViewQuery } from "@/redux/capacityApi";
import { useMe } from "@/redux/me";
import { useListDirectoryGroupsQuery, useListGrantedAccountsQuery } from "@/redux/ticketsApi";

function CapacityScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const me = useMe();
  const searchString = search.toString();
  const filter = useMemo(() => capacityFilterFromSearch(new URLSearchParams(searchString)), [searchString]);
  const canManage = me.hasPermission("capacity:manage");
  // The account and group directories sit behind tickets:view; without it the grid names them by id.
  const canDirectory = me.hasPermission("tickets:view");
  const view = useCapacityViewQuery(filter);
  const accounts = useListGrantedAccountsQuery(undefined, { skip: !canDirectory });
  const groups = useListDirectoryGroupsQuery(undefined, { skip: !canDirectory });

  const apply = (next: CapacityPageFilter) => router.replace(`${pathname}${capacityFilterToSearch(next)}`);

  return (
    <>
      {/* The four dimensions stand on the grey strip. The strip used to carry
          a Month pill that did nothing and chips for whatever was set, while
          the controls that set them were a row of labelled selects in the
          page body, so the screen said its filters twice and neither said it
          in the render's own grammar. */}
      <HeaderFilters>
        <MonthSelect primary month={filter.month} onChange={(month) => apply({ ...filter, month })} />
        <FilterSelect
          label="Role"
          value={filter.role ?? ""}
          options={ROLE_OPTIONS}
          onChange={(value) => apply({ ...filter, role: value || undefined })}
        />
        <FilterSelect
          label="Group"
          value={filter.group ?? ""}
          options={(groups.data ?? []).map((group) => ({ value: group.id, label: group.name }))}
          onChange={(value) => apply({ ...filter, group: value || undefined })}
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
      <CapacityTabs active="capacity" search={capacityFilterToSearch({ month: filter.month })} />
      <div className="flex flex-col gap-4">
        {view.isLoading && !view.data ? <Skeleton lines={8} /> : null}
        {view.isError ? (
          <EmptyBanner
            title="The month could not be loaded"
            detail="Check the month and that you are granted the accounts involved."
            action={{ label: "Retry", onClick: () => void view.refetch() }}
          />
        ) : null}
        {view.data && view.data.people.length === 0 && !filter.role && !filter.group && !filter.account ? (
          <EmptyBanner
            title="No one on the roster yet"
            detail="Import people from the sign-in directory to start planning capacity."
            action={{ label: "Open the Roster", href: "/roster" }}
          />
        ) : null}
        {view.data ? (
          <CapacityGrid view={view.data} month={filter.month} accounts={accounts.data} canManage={canManage} />
        ) : null}
        {view.data ? <DemandOverlay view={view.data} month={filter.month} /> : null}
      </div>
    </>
  );
}

/**
 * Registered as `capacity` (Capacity & Allocation functional 5.4, 5.5 and
 * 5.7, CAP-03, CAP-04, CAP-08): the month grid with the filters in the
 * URL, one row per person, the allocation cells per account editable
 * inline under capacity:manage, and the month's demand overlay beneath.
 */
export default function CapacityPage() {
  return (
    <AdminGate permission="capacity:view">
      <Suspense fallback={<Skeleton lines={8} />}>
        <CapacityScreen />
      </Suspense>
    </AdminGate>
  );
}
