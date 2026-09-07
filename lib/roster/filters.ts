import type { PeopleFilter } from "@/redux/rosterApi";

/**
 * The roster list's URL grammar: every filter is a query parameter so a
 * link is a saved filter (User Experience 2.1). `active` defaults to the
 * active people and is only written when it differs.
 */
export function filterFromSearch(search: URLSearchParams): PeopleFilter {
  const active = search.get("active");
  return {
    active: active === "false" || active === "all" ? active : "true",
    role: search.get("role") ?? undefined,
    group: search.get("group") ?? undefined,
    skill: search.get("skill") ?? undefined,
    q: search.get("q") ?? undefined,
  };
}

export function filterToSearch(filter: PeopleFilter): string {
  const params = new URLSearchParams();
  if (filter.active && filter.active !== "true") params.set("active", filter.active);
  if (filter.role) params.set("role", filter.role);
  if (filter.group) params.set("group", filter.group);
  if (filter.skill) params.set("skill", filter.skill);
  if (filter.q) params.set("q", filter.q);
  const text = params.toString();
  return text ? `?${text}` : "";
}
