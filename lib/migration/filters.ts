import type { BatchFilter } from "@/redux/migrationApi";

/**
 * The batch list's URL grammar: every filter is a query parameter so a link
 * is a saved filter (User Experience 2.1). The parameter names are the
 * API's own, so the URL reads like the request it makes.
 */
export function filterFromSearch(search: URLSearchParams): BatchFilter {
  return {
    account_id: search.get("account_id") ?? undefined,
    object_kind: search.get("object_kind") ?? undefined,
    status: search.get("status") ?? undefined,
  };
}

export function filterToSearch(filter: BatchFilter): string {
  const params = new URLSearchParams();
  if (filter.account_id) params.set("account_id", filter.account_id);
  if (filter.object_kind) params.set("object_kind", filter.object_kind);
  if (filter.status) params.set("status", filter.status);
  const text = params.toString();
  return text ? `?${text}` : "";
}
