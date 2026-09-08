/**
 * The Solutions list's dimensions, and the URL they live in.
 *
 * The list used to carry the chip-and-"+ Add filter" row the Queue lost in
 * pass two: nothing was drawn until a chip had been added, and adding one took
 * two 28px native selects that appeared beside the dashed control. The three
 * dimensions are standing controls now, so the same rule applies here as on
 * the Queue: a dimension reads "all" until it carries a value, and setting it
 * back to all is what removes the criterion.
 *
 * The URL is still the state, and it keeps the parameter names it had, so a
 * link someone already saved still opens the list it named. `status` was
 * written as a comma list; the control sets one value, and a saved link
 * carrying several is read on its first.
 */
export interface KnowledgeFilters {
  status: string;
  kind: string;
  /** "yes" for global articles, "no" for account-only ones. */
  global: string;
  q: string;
}

export const EMPTY_KNOWLEDGE_FILTERS: KnowledgeFilters = { status: "", kind: "", global: "", q: "" };

export function knowledgeFiltersFromSearch(search: URLSearchParams): KnowledgeFilters {
  return {
    status: (search.get("status") ?? "").split(",").filter(Boolean)[0] ?? "",
    kind: search.get("kind") ?? "",
    global: search.get("global") ?? "",
    q: search.get("q") ?? "",
  };
}

export function knowledgeFiltersToSearch(filters: KnowledgeFilters): URLSearchParams {
  const search = new URLSearchParams();
  if (filters.status) search.set("status", filters.status);
  if (filters.kind) search.set("kind", filters.kind);
  if (filters.global) search.set("global", filters.global);
  if (filters.q) search.set("q", filters.q);
  return search;
}

/** Whether anything narrows the list, which is what the empty state has to say. */
export function knowledgeFiltersApplied(filters: KnowledgeFilters): boolean {
  return filters.status !== "" || filters.kind !== "" || filters.global !== "" || filters.q !== "";
}
