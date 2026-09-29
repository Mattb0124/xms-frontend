"use client";

import { INPUT } from "@/components/admin/primitives";
import { cn } from "@/lib/utils";
import { useListDirectoryGroupsQuery, type DirectoryGroup } from "@/redux/ticketsApi";

/**
 * One assignment group, chosen from the directory the API serves at
 * `/v1/groups` under `tickets:view` (TM-08). The Queue's group chip, the
 * ticket record, the routing defaults and a saved view's group share all
 * name a group, and all of them have to name it the same way, so the list,
 * the retired marker and the fallback label live here once.
 *
 * A retired group routes nothing and cannot be assigned (the API answers
 * `group_retired`), so it is offered only while it is the value already in
 * force: a record that already names one must still be able to show it.
 */
export function groupLabel(groups: DirectoryGroup[] | undefined, id: string | null | undefined): string {
  if (!id) return "No group";
  const group = groups?.find((entry) => entry.id === id);
  if (!group) return id;
  return isRetired(group) ? `${group.name} (retired)` : group.name;
}

export function isRetired(group: DirectoryGroup): boolean {
  return group.status !== undefined && group.status !== "active";
}

/** One group's name, for a line of prose that has only the id. */
export function GroupName({ id }: { id: string | null }) {
  const { data } = useListDirectoryGroupsQuery();
  return <>{groupLabel(data, id)}</>;
}

export interface GroupPickerProps {
  id?: string;
  "aria-label"?: string;
  /** The group id in force, or "" / null for none. */
  value: string | null;
  onChange: (groupId: string | null) => void;
  disabled?: boolean;
  /** Whether "No group" is a choice; false on a control that must name one. */
  allowNone?: boolean;
  noneLabel?: string;
  className?: string;
}

export function GroupPicker({
  id,
  value,
  onChange,
  disabled,
  allowNone = true,
  noneLabel = "No group",
  className,
  "aria-label": ariaLabel = "Group",
}: GroupPickerProps) {
  const { data: groups } = useListDirectoryGroupsQuery();
  const current = value ?? "";
  const options = (groups ?? []).filter((group) => !isRetired(group) || group.id === current);
  const unknown = current !== "" && !options.some((group) => group.id === current);
  return (
    <select
      id={id}
      aria-label={ariaLabel}
      value={current}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)}
      className={cn(INPUT, className)}
    >
      {allowNone || current === "" ? <option value="">{allowNone ? noneLabel : "Choose a group"}</option> : null}
      {/* A group the directory did not answer with is still the value in force, so it is named rather than dropped. */}
      {unknown ? <option value={current}>{current}</option> : null}
      {options.map((group) => (
        <option key={group.id} value={group.id}>
          {isRetired(group) ? `${group.name} (retired)` : group.name}
        </option>
      ))}
    </select>
  );
}
