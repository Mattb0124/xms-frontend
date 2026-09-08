"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { AdminGate } from "@/components/admin/primitives";
import { AccountCoverageCards } from "@/components/capacity/account-coverage";
import { CapacityTabs } from "@/components/capacity/capacity-tabs";
import { SkillsHeatMap } from "@/components/capacity/skills-heat-map";
import { HeaderFilters } from "@/components/shell/content-header-bar";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { FilterSelect, StripSelect } from "@/components/xms/filter-select";
import { Skeleton } from "@/components/xms/skeleton";
import { capacityError, describeCapacityError } from "@/lib/capacity/errors";
import { skillsFilterFromSearch, skillsFilterToSearch, type SkillsPageFilter } from "@/lib/capacity/filters";
import { ROLE_OPTIONS } from "@/lib/roster/vocab";
import { useSkillsMatrixAccountQuery, useSkillsMatrixPeopleQuery, type SkillsLens } from "@/redux/capacityApi";
import { useMe } from "@/redux/me";
import { useListGrantedAccountsQuery } from "@/redux/ticketsApi";

const LENS_LABEL: Record<SkillsLens, string> = { people: "People", account: "Accounts" };

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
  const active = filter.lens === "people" ? people : accounts;

  return (
    <>
      {/* The lens and its one dimension stand on the grey strip. The lens was
          a pair of 30px segmented buttons in the page body, a control shape no
          other screen has, under a strip that showed the lens as a pill that
          did nothing. */}
      <HeaderFilters>
        <StripSelect
          label="Lens"
          primary
          value={filter.lens}
          onChange={(value) => apply({ lens: value as SkillsLens })}
          display={LENS_LABEL[filter.lens]}
        >
          <option value="people">Lens: People</option>
          <option value="account">Lens: Accounts</option>
        </StripSelect>
        {filter.lens === "people" ? (
          <FilterSelect
            label="Role"
            value={filter.role ?? ""}
            options={ROLE_OPTIONS}
            onChange={(value) => apply({ ...filter, role: value || undefined })}
          />
        ) : (
          <FilterSelect
            label="Account"
            value={filter.account ?? ""}
            options={accountOptions.map((option) => ({ value: option.id, label: option.label }))}
            onChange={(value) => apply({ ...filter, account: value || undefined })}
          />
        )}
      </HeaderFilters>
      <CapacityTabs active="skills" />
      <div className="flex flex-col gap-4">
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
