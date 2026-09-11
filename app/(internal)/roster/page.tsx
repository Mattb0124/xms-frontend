"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AdminGate, PRIMARY_BUTTON } from "@/components/admin/primitives";
import { ImportFromDirectoryButton } from "@/components/roster/import-button";
import { NewPersonForm } from "@/components/roster/new-person-form";
import { PeopleList } from "@/components/roster/people-list";
import { HeaderAction, HeaderFilters } from "@/components/shell/content-header-bar";
import { FilterSelect, StripSelect } from "@/components/xms/filter-select";
import { ICON, PlusIcon, SearchIcon } from "@/components/xms/icons";
import { Skeleton } from "@/components/xms/skeleton";
import { filterFromSearch, filterToSearch } from "@/lib/roster/filters";
import { ROLE_OPTIONS, roleLabel } from "@/lib/roster/vocab";
import { cn } from "@/lib/utils";
import { useListGroupsQuery } from "@/redux/adminApi";
import { useMe } from "@/redux/me";
import { useListPeopleQuery, useListSkillsQuery, type PeopleFilter } from "@/redux/rosterApi";

const ACTIVE_LABEL: Record<NonNullable<PeopleFilter["active"]>, string> = {
  true: "active",
  false: "inactive",
  all: "everyone",
};

function RosterScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const me = useMe();
  const searchString = search.toString();
  const filter = useMemo(() => filterFromSearch(new URLSearchParams(searchString)), [searchString]);
  const canAdmin = me.hasPermission("admin:users");
  const people = useListPeopleQuery(filter);
  const skills = useListSkillsQuery();
  const groups = useListGroupsQuery(undefined, { skip: !canAdmin });
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState(filter.q ?? "");

  const groupNames = useMemo(
    () => (groups.data ? Object.fromEntries(groups.data.map((group) => [group.id, group.name])) : undefined),
    [groups.data],
  );
  const roleOptions = useMemo(() => {
    const seen = new Set(ROLE_OPTIONS.map((option) => option.value));
    const extra = (people.data ?? []).map((person) => person.role).filter((role) => !seen.has(role));
    return [...ROLE_OPTIONS, ...[...new Set(extra)].map((role) => ({ value: role, label: roleLabel(role) }))];
  }, [people.data]);

  const apply = (next: PeopleFilter) => router.replace(`${pathname}${filterToSearch(next)}`);

  return (
    <>
      {/* The four dimensions stand on the grey strip. Role, group and skill
          were behind "+ Add filter", which opened a card of three native
          selects and a Done button in the page body; the primary was a pill
          that cycled through three states on click rather than offering
          them. */}
      <HeaderFilters>
        <StripSelect
          label="Show"
          primary
          value={filter.active ?? "true"}
          onChange={(value) => apply({ ...filter, active: value as NonNullable<PeopleFilter["active"]> })}
          display={`${ACTIVE_LABEL[filter.active ?? "true"]} (${(people.data ?? []).length})`}
        >
          <option value="true">Show: active</option>
          <option value="false">Show: inactive</option>
          <option value="all">Show: everyone</option>
        </StripSelect>
        <FilterSelect
          label="Role"
          value={filter.role ?? ""}
          options={roleOptions}
          onChange={(value) => apply({ ...filter, role: value || undefined })}
        />
        <FilterSelect
          label="Group"
          value={filter.group ?? ""}
          // Without admin:users the group directory is out of reach, so the
          // dimension offers what the rows themselves name and nothing more.
          options={(groups.data ?? []).map((group) => ({ value: group.id, label: group.name }))}
          onChange={(value) => apply({ ...filter, group: value || undefined })}
        />
        <FilterSelect
          label="Skill"
          value={filter.skill ?? ""}
          options={(skills.data ?? []).map((skill) => ({ value: skill.code, label: skill.name }))}
          onChange={(value) => apply({ ...filter, skill: value || undefined })}
        />
      </HeaderFilters>
      <HeaderAction>
        {canAdmin ? (
          <>
            <ImportFromDirectoryButton />
            <button
              type="button"
              className={cn(PRIMARY_BUTTON, "inline-flex items-center gap-1")}
              onClick={() => setCreating(true)}
            >
              <PlusIcon size={ICON.action} />
              New
            </button>
          </>
        ) : null}
      </HeaderAction>
      <div className="flex flex-col gap-4">
        {creating && canAdmin ? (
          <NewPersonForm
            groups={groups.data}
            onCancel={() => setCreating(false)}
            onCreated={(person) => {
              setCreating(false);
              router.push(`/roster/${person.id}`);
            }}
          />
        ) : null}
        <PeopleList
          rows={people.data ?? []}
          groupNames={groupNames}
          loading={people.isLoading}
          search={
            <form
              className="xms-field xms-field-typed border-xms-line-strong bg-xms-card mx-auto flex h-[38px] w-full max-w-[400px] items-center gap-2 rounded-[4px] border px-[14px]"
              onSubmit={(event) => {
                event.preventDefault();
                apply({ ...filter, q: query.trim() || undefined });
              }}
            >
              <input
                type="search"
                aria-label="Search people"
                placeholder="Name or email"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="text-xms-ink min-w-0 flex-1 bg-transparent text-[14px] outline-none"
              />
              <button type="submit" aria-label="Run the search" className="text-xms-muted hover:text-xms-ink shrink-0">
                <SearchIcon size={ICON.action} />
              </button>
            </form>
          }
          emptyState={
            people.isLoading
              ? "Loading"
              : filter.role || filter.group || filter.skill || filter.q
                ? "No one here. Set a dimension back to all, or clear the search."
                : canAdmin
                  ? "No one on the roster yet. Import from the directory to start."
                  : "No one matches."
          }
        />
      </div>
    </>
  );
}

/** Registered as `roster` (Capacity): the people list with its dimensions, import and New. */
export default function RosterPage() {
  return (
    <AdminGate permission="capacity:view">
      <Suspense fallback={<Skeleton lines={8} />}>
        <RosterScreen />
      </Suspense>
    </AdminGate>
  );
}
