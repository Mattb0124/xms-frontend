import { currentMonth, isMonth } from "@/lib/capacity/vocab";
import type { SkillsLens } from "@/redux/capacityApi";

/**
 * The capacity screens' URL grammar (User Experience 2.1: a link is a
 * saved filter). Every filter is a query parameter named as the API names
 * it; the month is only written when it is not the current one, so a bare
 * link always opens on today's month.
 */
export interface CapacityPageFilter {
  /** "YYYY-MM". */
  month: string;
  role?: string;
  group?: string;
  account?: string;
}

export interface VariancePageFilter {
  month: string;
  account?: string;
  person?: string;
}

/** The skills matrix: the lens, a role under the people lens, an account under the account lens. */
export interface SkillsPageFilter {
  lens: SkillsLens;
  role?: string;
  account?: string;
}

function monthFrom(search: URLSearchParams, fallback: string): string {
  const month = search.get("month");
  return isMonth(month) ? month : fallback;
}

function value(search: URLSearchParams, key: string): string | undefined {
  const text = search.get(key);
  return text ? text : undefined;
}

export function capacityFilterFromSearch(search: URLSearchParams, fallbackMonth = currentMonth()): CapacityPageFilter {
  return {
    month: monthFrom(search, fallbackMonth),
    role: value(search, "role"),
    group: value(search, "group"),
    account: value(search, "account"),
  };
}

export function capacityFilterToSearch(filter: CapacityPageFilter, fallbackMonth = currentMonth()): string {
  const params = new URLSearchParams();
  if (filter.month !== fallbackMonth) params.set("month", filter.month);
  if (filter.role) params.set("role", filter.role);
  if (filter.group) params.set("group", filter.group);
  if (filter.account) params.set("account", filter.account);
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function varianceFilterFromSearch(search: URLSearchParams, fallbackMonth = currentMonth()): VariancePageFilter {
  return {
    month: monthFrom(search, fallbackMonth),
    account: value(search, "account"),
    person: value(search, "person"),
  };
}

export function varianceFilterToSearch(filter: VariancePageFilter, fallbackMonth = currentMonth()): string {
  const params = new URLSearchParams();
  if (filter.month !== fallbackMonth) params.set("month", filter.month);
  if (filter.account) params.set("account", filter.account);
  if (filter.person) params.set("person", filter.person);
  const text = params.toString();
  return text ? `?${text}` : "";
}

/** The people lens is the bare link; the account lens is written, and each lens keeps only its own filter. */
export function skillsFilterFromSearch(search: URLSearchParams): SkillsPageFilter {
  const lens: SkillsLens = search.get("lens") === "account" ? "account" : "people";
  return {
    lens,
    role: lens === "people" ? value(search, "role") : undefined,
    account: lens === "account" ? value(search, "account") : undefined,
  };
}

export function skillsFilterToSearch(filter: SkillsPageFilter): string {
  const params = new URLSearchParams();
  if (filter.lens === "account") params.set("lens", "account");
  if (filter.lens === "people" && filter.role) params.set("role", filter.role);
  if (filter.lens === "account" && filter.account) params.set("account", filter.account);
  const text = params.toString();
  return text ? `?${text}` : "";
}
