"use client";

import { useMemo } from "react";
import type { PermissionRow } from "@/redux/adminApi";

/** Transitive closure of the direct implications (mirrors the server's expandPermissions). */
export function impliedClosure(selected: Iterable<string>, catalog: PermissionRow[]): Set<string> {
  const byKey = new Map(catalog.map((row) => [row.key, row]));
  const result = new Set<string>();
  const stack = [...selected];
  while (stack.length > 0) {
    const key = stack.pop()!;
    if (result.has(key)) continue;
    result.add(key);
    for (const implied of byKey.get(key)?.implies ?? []) if (!result.has(implied)) stack.push(implied);
  }
  return result;
}

export interface PermissionChecklistProps {
  catalog: PermissionRow[];
  /** Directly granted keys (what the role stores). */
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

/**
 * The role editor checklist (functional spec 5.5): keys grouped by area,
 * implied keys ticked and greyed automatically with a note saying which
 * key implies them, so the implication graph is visible inline.
 */
export function PermissionChecklist({ catalog, selected, onChange, disabled }: PermissionChecklistProps) {
  const groups = useMemo(() => {
    const map = new Map<string, PermissionRow[]>();
    for (const row of catalog) {
      const area = row.key.split(":")[0];
      map.set(area, [...(map.get(area) ?? []), row]);
    }
    return [...map.entries()];
  }, [catalog]);

  const direct = new Set(selected);
  const closure = impliedClosure(selected, catalog);
  const impliedBy = useMemo(() => {
    const result = new Map<string, string[]>();
    for (const key of direct) {
      for (const implied of impliedClosure([key], catalog)) {
        if (implied === key) continue;
        result.set(implied, [...(result.get(implied) ?? []), key]);
      }
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, catalog]);

  const toggle = (key: string) => {
    const next = new Set(direct);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange([...next]);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {groups.map(([area, rows]) => (
        <fieldset key={area} className="border-xms-line rounded-[4px] border">
          <legend className="xms-caption px-2">{area}</legend>
          <ul className="divide-y">
            {rows.map((row) => {
              const isDirect = direct.has(row.key);
              const isImplied = !isDirect && closure.has(row.key);
              const id = `perm-${row.key}`;
              return (
                <li key={row.key} className="px-3 py-2">
                  <label htmlFor={id} className="flex items-start gap-3 text-[14px]">
                    <input
                      id={id}
                      type="checkbox"
                      checked={isDirect || isImplied}
                      disabled={disabled || isImplied}
                      data-implied={isImplied ? "true" : undefined}
                      onChange={() => toggle(row.key)}
                      className="mt-[3px]"
                    />
                    <span className={isImplied ? "text-xms-muted" : "text-xms-ink"}>
                      <span className="xms-mono">{row.key}</span>
                      <span className="text-xms-label block text-[14px]">{row.label}</span>
                      {isImplied ? (
                        <span className="text-xms-muted block text-[14px]">
                          Implied by {impliedBy.get(row.key)?.join(", ")}
                        </span>
                      ) : row.implies.length > 0 ? (
                        <span className="text-xms-muted block text-[14px]">Implies {row.implies.join(", ")}</span>
                      ) : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ))}
    </div>
  );
}
