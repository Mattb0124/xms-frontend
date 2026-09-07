"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { AdminGate, INPUT } from "@/components/admin/primitives";
import { AccountCoverageCards } from "@/components/capacity/account-coverage";
import { CapacityTabs } from "@/components/capacity/capacity-tabs";
import { SkillsHeatMap } from "@/components/capacity/skills-heat-map";
import { HeaderFilters } from "@/components/shell/content-header-bar";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { FilterBar, type FilterCriterion } from "@/components/xms/filter-bar";
import { Skeleton } from "@/components/xms/skeleton";
import { capacityError, describeCapacityError } from "@/lib/capacity/errors";
import { skillsFilterFromSearch, skillsFilterToSearch, type SkillsPageFilter } from "@/lib/capacity/filters";
import { ROLE_OPTIONS, roleLabel } from "@/lib/roster/vocab";
import { cn } from "@/lib/utils";
import { useSkillsMatrixAccountQuery, useSkillsMatrixPeopleQuery, type SkillsLens } from "@/redux/capacityApi";
import { useMe } from "@/redux/me";
import { useListGrantedAccountsQuery } from "@/redux/ticketsApi";

const CONTROL = cn(INPUT, "h-[30px] text-[12px]");

const LENS_LABEL: Record<SkillsLens, string> = { people: "People", account: "Accounts" };

function LensSwitch({ value, onChange }: { value: SkillsLens; onChange: (lens: SkillsLens) => void }) {
  return (
    <div role="group" aria-label="Lens" className="border-xms-line flex h-[30px] overflow-hidden rounded-[4px] border">
      {(["people", "account"] as SkillsLens[]).map((lens) => (
        <button
          key={lens}
          type="button"
          aria-pressed={value === lens}
          onClick={() => onChange(lens)}
          className={cn(
            "px-3 text-[12px]",
            value === lens ? "bg-xms-accent font-medium text-white" : "bg-xms-card text-xms-body hover:bg-xms-tint",
          )}
        >
          {LENS_LABEL[lens]}
        </button>
      ))}
    </div>
  );
}

function SkillsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const me = useMe();
  const searchString = search.toString();
  const filter = useMemo(() => skillsFilterFromSearch(new URLSearchParams(searchString)), [searchString]);
  const canDirectory = me.hasPermission("tickets:view");
  const people = useSkillsMatrixPeopleQuery(undefined, { skip: filter.lens !== "people" });
  const accounts = useSkillsMatrixAccountQuery({ account: filter.account }, { skip: filter.lens !== "account" });
  const directory = useListGrantedAccountsQuery(undefined, { skip: !canDirectory || filter.lens !== "account" });

  const apply = (next: SkillsPageFilter) => router.replace(`${pathname}${skillsFilterToSearch(next)}`);
  // The account choices: the directory under tickets:view, else the accounts the lens itself returned.
  const accountOptions =
    directory.data?.map((account) => ({ id: account.id, label: `${account.key} ${account.name}` })) ??
    accounts.data?.accounts.map((account) => ({ id: account.account_id, label: `${account.key} ${account.name}` })) ??
    [];
  const accountName = (id: string) => accountOptions.find((option) => option.id === id)?.label ?? id.slice(0, 8);
  const criteria: FilterCriterion[] = [];
  if (filter.role) criteria.push({ key: "role", label: "Role", value: roleLabel(filter.role) });
  if (filter.account) criteria.push({ key: "account", label: "Account", value: accountName(filter.account) });
  const active = filter.lens === "people" ? people : accounts;

  return (
    <>
      <HeaderFilters>
        <FilterBar
          primary={{ label: "Lens", value: LENS_LABEL[filter.lens] }}
          criteria={criteria}
          onRemove={(key) => apply({ ...filter, [key]: undefined })}
          onAdd={() => undefined}
          onClearAll={() => apply({ lens: filter.lens })}
        />
      </HeaderFilters>
      <CapacityTabs active="skills" />
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Skills matrix filters">
          <div className="flex flex-col gap-1 text-[12px]">
            <span className="text-xms-label">Lens</span>
            <LensSwitch value={filter.lens} onChange={(lens) => apply({ lens })} />
          </div>
          {filter.lens === "people" ? (
            <label className="flex flex-col gap-1 text-[12px]">
              <span className="text-xms-label">Role</span>
              <select
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
          ) : (
            <label className="flex flex-col gap-1 text-[12px]">
              <span className="text-xms-label">Account</span>
              <select
                aria-label="Filter by account"
                className={cn(CONTROL, "w-[220px]")}
                value={filter.account ?? ""}
                onChange={(event) => apply({ ...filter, account: event.target.value || undefined })}
              >
                <option value="">Every granted account</option>
                {accountOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {active.isLoading && !active.data ? <Skeleton lines={8} /> : null}
        {active.isError ? (
          <EmptyBanner
            title="The skills matrix could not be loaded"
            detail={describeCapacityError(capacityError(active.error))}
            action={{ label: "Retry", onClick: () => void active.refetch() }}
          />
        ) : null}
        {filter.lens === "people" && people.data ? <SkillsHeatMap matrix={people.data} role={filter.role} /> : null}
        {filter.lens === "account" && accounts.data ? (
          accounts.data.accounts.length === 0 ? (
            <EmptyBanner
              title="No accounts to cover"
              detail="The account lens reads the technology codes on the active contracts of the accounts you are granted."
            />
          ) : (
            <AccountCoverageCards view={accounts.data} />
          )
        ) : null}
      </div>
    </>
  );
}

/**
 * Registered as `capacity.skills` (Capacity & Allocation functional 5.8,
 * CAP-07): the people lens as a heat map with a role filter, the account
 * lens as one card per account with the required technologies, their
 * status and the qualified people, with an account filter; the lens and
 * its filter live in the URL.
 */
export default function CapacitySkillsPage() {
  return (
    <AdminGate permission="capacity:view">
      <Suspense fallback={<Skeleton lines={8} />}>
        <SkillsScreen />
      </Suspense>
    </AdminGate>
  );
}
