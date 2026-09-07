"use client";

import { useMemo, useState } from "react";
import { INPUT } from "@/components/admin/primitives";
import { fullName } from "@/components/admin/primitives";
import { cn } from "@/lib/utils";
import { useListAssignableUsersQuery, type AssignableUser } from "@/redux/adminApi";

export interface AssigneePickerProps {
  value: string | null;
  onChange: (user: AssignableUser | null) => void;
  /** Adds an "Assign to me" shortcut for this user id. */
  currentUserId?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/**
 * Search picker over the assignable roster (GET /users). Typing filters by
 * name or email; picking a row commits; "Unassigned" clears.
 */
export function AssigneePicker({ value, onChange, currentUserId, disabled, id, className }: AssigneePickerProps) {
  const { data: users = [] } = useListAssignableUsersQuery();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
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
              const me = users.find((user) => user.id === currentUserId);
              onChange(me ?? { id: currentUserId, email: "", first_name: "Me", last_name: "" });
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
          {matches.map((user) => (
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
                <span className="text-xms-label ml-auto text-[12px]">{user.email}</span>
              </button>
            </li>
          ))}
          {matches.length === 0 ? <li className="text-xms-label px-3 py-1.5">No one matches</li> : null}
        </ul>
      ) : null}
    </div>
  );
}
