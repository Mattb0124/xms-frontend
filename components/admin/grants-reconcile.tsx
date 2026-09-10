"use client";

import { useMemo, useState } from "react";
import { PRIMARY_BUTTON, SECONDARY_BUTTON, INPUT } from "@/components/admin/primitives";

export interface ReconcileOption {
  id: string;
  label: string;
  detail?: string;
}

export interface GrantsReconcileProps {
  title: string;
  options: ReconcileOption[];
  /** The current set from the server. */
  selected: string[];
  /** Save applies the whole set, never a delta (reconcile semantics). */
  onSave: (ids: string[]) => Promise<void> | void;
  saving?: boolean;
  disabled?: boolean;
  emptyLabel?: string;
}

/**
 * Reconcile-the-whole-set checklist (the POC `CompanyProjects` tree with
 * accounts, technical spec section 6): search, tick, Save sends the exact
 * id set, Reset returns to the server's set.
 */
export function GrantsReconcile({
  title,
  options,
  selected,
  onSave,
  saving,
  disabled,
  emptyLabel = "Nothing to choose from",
}: GrantsReconcileProps) {
  const [draft, setDraft] = useState<Set<string>>(() => new Set(selected));
  const [seen, setSeen] = useState(selected);
  if (seen !== selected) {
    setSeen(selected);
    setDraft(new Set(selected));
  }
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(
      (option) => option.label.toLowerCase().includes(needle) || option.detail?.toLowerCase().includes(needle),
    );
  }, [options, query]);

  const dirty = useMemo(() => {
    if (draft.size !== selected.length) return true;
    return selected.some((id) => !draft.has(id));
  }, [draft, selected]);

  const toggle = (id: string) => {
    setDraft((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-3" aria-label={title}>
      <div className="flex items-center gap-2">
        <input
          type="search"
          aria-label={`Search ${title.toLowerCase()}`}
          placeholder="Search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className={`${INPUT} max-w-xs`}
        />
        <span className="xms-mono text-xms-label ml-auto text-[14px]">{draft.size} selected</span>
      </div>
      <ul className="border-xms-line max-h-[360px] divide-y overflow-auto rounded-[4px] border">
        {visible.map((option) => {
          const id = `reconcile-${option.id}`;
          return (
            <li key={option.id}>
              <label htmlFor={id} className="hover:bg-xms-row-hover flex items-center gap-3 px-3 py-2 text-[14px]">
                <input
                  id={id}
                  type="checkbox"
                  checked={draft.has(option.id)}
                  disabled={disabled}
                  onChange={() => toggle(option.id)}
                />
                <span className="text-xms-ink">{option.label}</span>
                {option.detail ? <span className="text-xms-label ml-auto text-[14px]">{option.detail}</span> : null}
              </label>
            </li>
          );
        })}
        {visible.length === 0 ? (
          <li className="text-xms-label px-3 py-4 text-center text-[14px]">{emptyLabel}</li>
        ) : null}
      </ul>
      <div className="flex gap-2">
        <button
          type="button"
          className={PRIMARY_BUTTON}
          disabled={!dirty || saving || disabled}
          onClick={() => void onSave([...draft])}
        >
          {saving ? "Saving" : "Save"}
        </button>
        <button
          type="button"
          className={SECONDARY_BUTTON}
          disabled={!dirty || saving}
          onClick={() => setDraft(new Set(selected))}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
