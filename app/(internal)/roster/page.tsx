"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AdminGate, INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { ImportFromDirectoryButton } from "@/components/roster/import-button";
import { NewPersonForm } from "@/components/roster/new-person-form";
import { PeopleList } from "@/components/roster/people-list";
import { HeaderAction, HeaderFilters } from "@/components/shell/content-header-bar";
import { FilterBar, type FilterCriterion } from "@/components/xms/filter-bar";
import { Panel } from "@/components/xms/panel";
import { Skeleton } from "@/components/xms/skeleton";
import { filterFromSearch, filterToSearch } from "@/lib/roster/filters";
import { ROLE_OPTIONS, roleLabel } from "@/lib/roster/vocab";
import { useListGroupsQuery } from "@/redux/adminApi";
import { useMe } from "@/redux/me";
import { useListPeopleQuery, useListSkillsQuery, type PeopleFilter } from "@/redux/rosterApi";

const ACTIVE_LABEL: Record<NonNullable<PeopleFilter["active"]>, string> = {
  true: "Active",
  false: "Inactive",
  all: "All",
};
const ACTIVE_CYCLE: NonNullable<PeopleFilter["active"]>[] = ["true", "false", "all"];

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
  const [adding, setAdding] = useState(false);
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
  const criteria: FilterCriterion[] = [];
  if (filter.role) criteria.push({ key: "role", label: "Role", value: roleLabel(filter.role) });
  if (filter.group)
    criteria.push({ key: "group", label: "Group", value: groupNames?.[filter.group] ?? filter.group.slice(0, 8) });
  if (filter.skill)
    criteria.push({
      key: "skill",
      label: "Skill",
      value: skills.data?.find((skill) => skill.code === filter.skill)?.name ?? filter.skill,
    });
  if (filter.q) criteria.push({ key: "q", label: "Search", value: filter.q });

  return (
    <>
      <HeaderFilters>
        <FilterBar
          primary={{
            label: "Show",
            value: ACTIVE_LABEL[filter.active ?? "true"],
            onClick: () =>
              apply({
                ...filter,
                active: ACTIVE_CYCLE[(ACTIVE_CYCLE.indexOf(filter.active ?? "true") + 1) % ACTIVE_CYCLE.length],
              }),
          }}
          criteria={criteria}
          onRemove={(key) => {
            if (key === "q") setQuery("");
            apply({ ...filter, [key]: undefined });
          }}
          onAdd={() => setAdding((value) => !value)}
          onClearAll={() => {
            setQuery("");
            apply({ active: filter.active });
          }}
        />
      </HeaderFilters>
      <HeaderAction>
        {canAdmin ? (
          <>
            <ImportFromDirectoryButton />
            <button type="button" className={PRIMARY_BUTTON} onClick={() => setCreating(true)}>
              New person
            </button>
          </>
        ) : null}
      </HeaderAction>
      <div className="flex flex-col gap-4">
        {adding ? (
          <Panel title="Add filter" caption="Role, group or skill">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="flex flex-col gap-1 text-[12px]">
                <span className="text-xms-label">Role</span>
                <select
                  aria-label="Filter by role"
                  className={INPUT}
                  value={filter.role ?? ""}
                  onChange={(event) => apply({ ...filter, role: event.target.value || undefined })}
                >
                  <option value="">Any role</option>
                  {roleOptions.map((option) => (
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
                  className={INPUT}
                  value={filter.group ?? ""}
                  disabled={!groups.data}
                  onChange={(event) => apply({ ...filter, group: event.target.value || undefined })}
                >
                  <option value="">{groups.data ? "Any group" : "Groups need admin:users"}</option>
                  {(groups.data ?? []).map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[12px]">
                <span className="text-xms-label">Skill</span>
                <select
                  aria-label="Filter by skill"
                  className={INPUT}
                  value={filter.skill ?? ""}
                  onChange={(event) => apply({ ...filter, skill: event.target.value || undefined })}
                >
                  <option value="">Any skill</option>
                  {(skills.data ?? []).map((skill) => (
                    <option key={skill.id} value={skill.code}>
                      {skill.name}
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
              onSubmit={(event) => {
                event.preventDefault();
                apply({ ...filter, q: query.trim() || undefined });
              }}
            >
              <input
                type="search"
                aria-label="Search people"
                placeholder="Name or email"
                className={`${INPUT} h-[30px] w-[220px]`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </form>
          }
          emptyState={
            people.isLoading
              ? "Loading"
              : canAdmin
                ? "No one on the roster yet. Import from the directory to start."
                : "No one matches."
          }
        />
      </div>
    </>
  );
}

/** Registered as `roster` (Capacity): the people list with filters, import and New person. */
export default function RosterPage() {
  return (
    <AdminGate permission="capacity:view">
      <Suspense fallback={<Skeleton lines={8} />}>
        <RosterScreen />
      </Suspense>
    </AdminGate>
  );
}
