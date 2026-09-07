"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useRef } from "react";
import { AdminGate, INPUT } from "@/components/admin/primitives";
import { CapacityGrid } from "@/components/capacity/capacity-grid";
import { CapacityTabs } from "@/components/capacity/capacity-tabs";
import { DemandOverlay } from "@/components/capacity/demand-overlay";
import { HeaderFilters } from "@/components/shell/content-header-bar";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { FilterBar, type FilterCriterion } from "@/components/xms/filter-bar";
import { Skeleton } from "@/components/xms/skeleton";
import { capacityFilterFromSearch, capacityFilterToSearch, type CapacityPageFilter } from "@/lib/capacity/filters";
import { monthLabel } from "@/lib/capacity/vocab";
import { ROLE_OPTIONS, roleLabel } from "@/lib/roster/vocab";
import { cn } from "@/lib/utils";
import { useCapacityViewQuery } from "@/redux/capacityApi";
import { useMe } from "@/redux/me";
import { useListDirectoryGroupsQuery, useListGrantedAccountsQuery } from "@/redux/ticketsApi";

const CONTROL = cn(INPUT, "h-[30px] text-[12px]");

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
  const roleRef = useRef<HTMLSelectElement>(null);

  const apply = (next: CapacityPageFilter) => router.replace(`${pathname}${capacityFilterToSearch(next)}`);
  const accountName = (id: string) => {
    const account = accounts.data?.find((row) => row.id === id);
    return account ? `${account.key} ${account.name}` : id.slice(0, 8);
  };
  const groupName = (id: string) => groups.data?.find((row) => row.id === id)?.name ?? id.slice(0, 8);
  const criteria: FilterCriterion[] = [];
  if (filter.role) criteria.push({ key: "role", label: "Role", value: roleLabel(filter.role) });
  if (filter.group) criteria.push({ key: "group", label: "Group", value: groupName(filter.group) });
  if (filter.account) criteria.push({ key: "account", label: "Account", value: accountName(filter.account) });

  return (
    <>
      <HeaderFilters>
        <FilterBar
          primary={{ label: "Month", value: monthLabel(filter.month) }}
          criteria={criteria}
          onRemove={(key) => apply({ ...filter, [key]: undefined })}
          onAdd={() => roleRef.current?.focus()}
          onClearAll={() => apply({ month: filter.month })}
        />
      </HeaderFilters>
      <CapacityTabs active="capacity" search={capacityFilterToSearch({ month: filter.month })} />
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Capacity filters">
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-xms-label">Month</span>
            <input
              type="month"
              aria-label="Month"
              className={cn(CONTROL, "xms-mono w-[160px]")}
              value={filter.month}
              onChange={(event) => {
                if (event.target.value) apply({ ...filter, month: event.target.value });
              }}
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-xms-label">Role</span>
            <select
              ref={roleRef}
              aria-label="Filter by role"
              className={cn(CONTROL, "w-[180px]")}
              value={filter.role ?? ""}
              onChange={(event) => apply({ ...filter, role: event.target.value || undefined })}
            >
              <option value="">Any role</option>
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-xms-label">Group</span>
            <select
              aria-label="Filter by group"
              className={cn(CONTROL, "w-[180px]")}
              value={filter.group ?? ""}
              disabled={!groups.data}
              onChange={(event) => apply({ ...filter, group: event.target.value || undefined })}
            >
              <option value="">{groups.data ? "Any group" : "Groups need tickets:view"}</option>
              {(groups.data ?? []).map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-xms-label">Account</span>
            <select
              aria-label="Filter by account"
              className={cn(CONTROL, "w-[200px]")}
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
