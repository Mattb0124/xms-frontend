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
  /**
   * The record's own name for the current assignee. The control shows it
   * straight away, so the picker names who holds the ticket instead of
   * reading empty while the directory loads (frontend review finding 10).
   */
  valueLabel?: string | null;
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

/**
 * The words in the closed control: the assignee's name, marked "(you)" when
 * the reader holds the ticket, or "Unassigned". One control says who has the
 * ticket and changes it; there is no second read-only line (finding 10).
 */
export function assigneeLabel(name: string | null | undefined, isMe: boolean): string {
  if (!name) return "Unassigned";
  return isMe ? `${name} (you)` : name;
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
 *
 * The directories load on first open, not on mount: a ticket record does not
 * need the whole user list or the roster to say who the assignee is, which
 * the record itself names (review finding 24).
 */
export function AssigneePicker({
  value,
  valueLabel,
  onChange,
  currentUserId,
  disabled,
  id,
  className,
}: AssigneePickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  // Sticky: once the reader has opened the picker the lists stay loaded, so
  // closing and reopening does not ask again.
  const [wanted, setWanted] = useState(false);
  const { data: users = [] } = useListAssignableUsersQuery(undefined, { skip: !wanted });
  const me = useMe();
  const rosterReadable = me.hasPermission("capacity:view");
  const canCheck = rosterReadable && me.hasPermission("tickets:work");
  const { data: people } = useListPeopleQuery({ active: "true" }, { skip: !wanted || !rosterReadable });
  const byUserId = useMemo(
    () =>
      new Map((people ?? []).filter((person) => person.user_id).map((person) => [person.user_id as string, person])),
    [people],
  );
  const candidates = useMemo(() => checkCandidates(users, byUserId), [users, byUserId]);
  const month = useMemo(() => currentMonth(), []);
  const { data: checks } = useCapacityCheckQuery(
    { personIds: candidates, month },
    { skip: !canCheck || !open || candidates.length === 0 },
  );
  const checkByPerson = useMemo(() => new Map((checks ?? []).map((check) => [check.person_id, check])), [checks]);
  const selected = users.find((user) => user.id === value);
  const isMe = Boolean(value) && value === currentUserId;
  // The directory, then the record, then the reader's own name for a ticket
  // they just took: the control is never blank when someone holds the ticket.
  const named = selected ? fullName(selected) : (valueLabel ?? (isMe ? me.principal?.displayName : null));
  const current = assigneeLabel(named, isMe);
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
          // Closed, the control reads as the assignee; open, it is a search box
          // and the assignee stays in the placeholder for context.
          placeholder={current}
          data-current-assignee={current}
          value={open ? query : current === "Unassigned" ? "" : current}
          disabled={disabled}
          onFocus={() => {
            setQuery("");
            setWanted(true);
            setOpen(true);
          }}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(event) => {
            setQuery(event.target.value);
            setWanted(true);
            setOpen(true);
          }}
          className={INPUT}
        />
        {currentUserId && value !== currentUserId ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              const self = users.find((user) => user.id === currentUserId);
              onChange(self ?? { id: currentUserId, email: "", first_name: "Me", last_name: "" });
              setQuery("");
              setWanted(true);
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
