"use client";

import { useEffect, useState } from "react";
import { INPUT } from "@/components/admin/primitives";
import { useLazySearchSolutionsQuery, type SearchHit } from "@/redux/knowledgeApi";

export interface PickedSolution {
  id: string;
  key: string;
  title: string;
}

export interface SolutionPickerProps {
  value: PickedSolution | null;
  onChange: (value: PickedSolution | null) => void;
  /** Articles already suggested for the ticket, listed before any search (Knowledge Base 5.2). */
  suggested?: SearchHit[];
  disabled?: boolean;
}

/** Searchable picker over the published articles the reader may see (GET /search/solutions). */
export function SolutionPicker({ value, onChange, suggested = [], disabled }: SolutionPickerProps) {
  const [query, setQuery] = useState("");
  const [search, { data, isFetching }] = useLazySearchSolutionsQuery();

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    const handle = window.setTimeout(() => void search({ q: term, limit: 8 }), 250);
    return () => window.clearTimeout(handle);
  }, [query, search]);

  const hits = query.trim().length >= 2 ? (data ?? []).filter((hit) => hit.status === "published") : suggested;

  if (value) {
    return (
      <div className="flex items-center gap-2 text-[12px]" data-testid="picked-solution">
        <span className="xms-mono text-xms-accent">{value.key}</span>
        <span className="text-xms-ink truncate">{value.title}</span>
        <button
          type="button"
          onClick={() => onChange(null)}
          disabled={disabled}
          className="text-xms-label ml-auto hover:underline"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 text-[12px]">
      <input
        aria-label="Search solutions"
        value={query}
        disabled={disabled}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search published articles by title or KB key"
        className={INPUT}
      />
      <ul
        className="border-xms-line max-h-[180px] divide-y overflow-auto rounded-[4px] border"
        aria-label="Matching articles"
      >
        {hits.map((hit) => (
          <li key={hit.id}>
            <button
              type="button"
              onClick={() => onChange({ id: hit.id, key: hit.display_key, title: hit.title })}
              className="hover:bg-xms-tint flex w-full items-center gap-2 px-2 py-1.5 text-left"
            >
              <span className="xms-mono text-xms-accent">{hit.display_key}</span>
              <span className="text-xms-ink truncate">{hit.title}</span>
              {hit.is_global ? <span className="text-xms-label ml-auto text-[11px]">Global</span> : null}
            </button>
          </li>
        ))}
        {hits.length === 0 ? (
          <li className="text-xms-label px-2 py-1.5">
            {isFetching
              ? "Searching"
              : query.trim().length >= 2
                ? "No published article matches."
                : "Type to search, or pick a suggestion."}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
