"use client";

import { useMemo, useState } from "react";
import { INPUT } from "@/components/admin/primitives";
import { fullName } from "@/components/admin/primitives";
import { currentMonth, remainingLabel } from "@/lib/capacity/vocab";
import { roleLabel } from "@/lib/roster/vocab";
import { cn } from "@/lib/utils";
import { useListAssignableUsersQuery, type AssignableUser } from "@/redux/adminApi";
import { useCapacityCheckQuery, type CapacityCheck } from "@/redux/capacityApi";
import { useMe } from "@/redux/me";
import { useListPeopleQuery, type Person } from "@/redux/rosterApi";

export interface AssigneePickerProps {
  value: string | null;
  onChange: (user: AssignableUser | null) => void;
  /** Adds an "Assign to me" shortcut for this user id. */
  currentUserId?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/** "Senior Consultant, Europe/London" for a roster person; empty when the roster is not readable or the user is not on it. */
export function rosterHint(person: Person | undefined): string {
  if (!person) return "";
  return [roleLabel(person.role), person.time_zone].filter(Boolean).join(", ");
}

/** The warning marker's words for a candidate in warning or over state; empty otherwise (5.9). */
export function capacityWarning(check: CapacityCheck | undefined): string {
  if (!check) return "";
  if (check.status === "over") return "Over capacity this month";
  if (check.status === "warning") return "Near capacity this month";
  return "";
}

/** At most 50 roster person ids behind the listed users, in list order: one check per open picker. */
export function checkCandidates(users: AssignableUser[], byUserId: Map<string, Person>): string[] {
  const ids: string[] = [];
  for (const user of users) {
    const person = byUserId.get(user.id);
    if (person && !ids.includes(person.id)) ids.push(person.id);
    if (ids.length === 50) break;
  }
  return ids;
}

/**
 * Search picker over the assignable roster (GET /users). Typing filters by
 * name or email; picking a row commits; "Unassigned" clears. When the
 * reader may see the roster (capacity:view) each row also carries the
 * person's role and time zone, matched by user id (CAP-01); with
 * tickets:work as well, the current month's remaining hours and a warning
 * marker for anyone near or over capacity come from one capacity check
 * per open picker (CAP-06). The notice never blocks.
 */
export function AssigneePicker({ value, onChange, currentUserId, disabled, id, className }: AssigneePickerProps) {
  const { data: users = [] } = useListAssignableUsersQuery();
  const me = useMe();
  const rosterReadable = me.hasPermission("capacity:view");
  const canCheck = rosterReadable && me.hasPermission("tickets:work");
  const { data: people } = useListPeopleQuery({ active: "true" }, { skip: !rosterReadable });
  const byUserId = useMemo(
    () => new Map((people ?? []).filter((person) => person.user_id).map((person) => [person.user_id as string, person])),
    [people],
  );
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const candidates = useMemo(() => checkCandidates(users, byUserId), [users, byUserId]);
  const month = useMemo(() => currentMonth(), []);
  const { data: checks } = useCapacityCheckQuery(
    { personIds: candidates, month },
    { skip: !canCheck || !open || candidates.length === 0 },
  );
  const checkByPerson = useMemo(() => new Map((checks ?? []).map((check) => [check.person_id, check])), [checks]);
  const selected = users.find((user) => user.id === value);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = needle
      ? users.filter(
          (user) => fullName(user).toLowerCase().includes(needle) || user.email.toLowerCase().includes(needle),
        )
      : users;
    return list.slice(0, 12);
  }, [users, query]);

  return (
    <div className={cn("relative", className)}>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id ?? "assignee"}-options`}
          aria-label="Assignee"
          placeholder={selected ? fullName(selected) : "Unassigned"}
          value={query}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          className={INPUT}
        />
        {currentUserId ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              const self = users.find((user) => user.id === currentUserId);
              onChange(self ?? { id: currentUserId, email: "", first_name: "Me", last_name: "" });
              setQuery("");
            }}
            className="border-xms-line text-xms-body hover:bg-xms-tint h-[34px] shrink-0 rounded-[4px] border px-2 text-[12px]"
          >
            Assign to me
          </button>
        ) : null}
      </div>
      {open ? (
        <ul
          id={`${id ?? "assignee"}-options`}
          role="listbox"
          className="xms-card absolute z-20 mt-1 max-h-64 w-full overflow-auto py-1 text-[13px]"
        >
          <li>
            <button
              type="button"
              role="option"
              aria-selected={value === null}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(null);
                setQuery("");
                setOpen(false);
              }}
              className="text-xms-muted hover:bg-xms-tint w-full px-3 py-1.5 text-left"
            >
              Unassigned
            </button>
          </li>
          {matches.map((user) => {
            const person = byUserId.get(user.id);
            const hint = rosterHint(person);
            const check = person ? checkByPerson.get(person.id) : undefined;
            const warning = capacityWarning(check);
            return (
              <li key={user.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={user.id === value}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange(user);
                    setQuery("");
                    setOpen(false);
                  }}
                  className="hover:bg-xms-tint flex w-full items-center gap-2 px-3 py-1.5 text-left"
                >
                  <span className="text-xms-ink">{fullName(user)}</span>
                  {warning ? (
                    <span
                      role="img"
                      aria-label={warning}
                      title={warning}
                      data-capacity-warning={check?.status}
                      className="text-[12px] text-[color:var(--state-overdue-text)]"
                    >
                      ⚠
                    </span>
                  ) : null}
                  {check ? (
                    <span className="xms-mono text-xms-label text-[12px]" data-capacity-hint>
                      {remainingLabel(check)}
                    </span>
                  ) : null}
                  {hint ? (
                    <span className="text-xms-label text-[12px]" data-roster-hint>
                      {hint}
                    </span>
                  ) : null}
                  <span className="text-xms-label ml-auto text-[12px]">{user.email}</span>
                </button>
              </li>
            );
          })}
          {matches.length === 0 ? <li className="text-xms-label px-3 py-1.5">No one matches</li> : null}
        </ul>
      ) : null}
    </div>
  );
}
