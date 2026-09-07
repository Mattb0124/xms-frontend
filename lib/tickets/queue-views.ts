/**
 * The Queue's system views and the URL grammar (User Experience 3.2,
 * Wireframes v2 section 3.1): the view is a named preset of list params,
 * the chips are extra criteria, and both live in the URL so a pasted link
 * reproduces the exact list (TM-15).
 */
export interface TicketListParams {
  account_id?: string[];
  state?: string[];
  type?: string[];
  priority?: string[];
  assignee_id?: string;
  group_id?: string;
  unassigned?: boolean;
  open?: boolean;
  mine?: boolean;
  breached?: boolean;
  q?: string;
  sort?: "updated_desc" | "created_desc" | "priority";
  limit?: number;
  cursor?: string;
}

export interface QueueView {
  key: string;
  label: string;
  params: TicketListParams;
}

export const RESOLVED_STATES = ["resolved", "fulfilled", "completed", "done"];

export const QUEUE_VIEWS: QueueView[] = [
  { key: "open", label: "All open", params: { open: true } },
  { key: "mine", label: "My work", params: { open: true, mine: true } },
  { key: "unassigned", label: "Unassigned", params: { open: true, unassigned: true } },
  { key: "breached", label: "Breached", params: { open: true, breached: true } },
  { key: "p1", label: "P1", params: { open: true, priority: ["p1"] } },
  { key: "awaiting_client", label: "Awaiting client", params: { state: ["awaiting_client"] } },
  { key: "resolved", label: "Resolved", params: { state: RESOLVED_STATES } },
];

export const DEFAULT_VIEW = "open";

export type ChipKey = "account_id" | "type" | "priority" | "state";

export interface Chip {
  key: ChipKey;
  value: string;
}

export function viewByKey(key: string | null | undefined): QueueView {
  return QUEUE_VIEWS.find((view) => view.key === key) ?? QUEUE_VIEWS[0];
}

/** Merges the view preset with the chips; a chip on the same dimension narrows the preset. */
export function viewToParams(view: QueueView, chips: Chip[], extra: Partial<TicketListParams> = {}): TicketListParams {
  const params: TicketListParams = { ...view.params, ...extra };
  for (const chip of chips) {
    const current = params[chip.key] ?? [];
    if (!current.includes(chip.value)) params[chip.key] = [...current, chip.value];
  }
  return params;
}

/** The API expects comma-joined lists and string booleans. */
export function paramsToQuery(params: TicketListParams): Record<string, string> {
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length > 0) query[key] = value.join(",");
    } else query[key] = String(value);
  }
  return query;
}

/** URL search params for the screen: view, chips, q, limit. */
export function chipsToSearch(view: string, chips: Chip[], q: string, limit: number): URLSearchParams {
  const search = new URLSearchParams();
  if (view !== DEFAULT_VIEW) search.set("view", view);
  for (const key of ["account_id", "type", "priority", "state"] as ChipKey[]) {
    const values = chips.filter((chip) => chip.key === key).map((chip) => chip.value);
    if (values.length > 0) search.set(key, values.join(","));
  }
  if (q) search.set("q", q);
  if (limit !== 25) search.set("limit", String(limit));
  return search;
}

export function chipsFromSearch(search: URLSearchParams): { view: string; chips: Chip[]; q: string; limit: number } {
  const chips: Chip[] = [];
  for (const key of ["account_id", "type", "priority", "state"] as ChipKey[]) {
    const raw = search.get(key);
    if (!raw) continue;
    for (const value of raw.split(",").filter(Boolean)) chips.push({ key, value });
  }
  const limit = Number(search.get("limit") ?? 25);
  return {
    view: search.get("view") ?? DEFAULT_VIEW,
    chips,
    q: search.get("q") ?? "",
    limit: [10, 25, 50, 100].includes(limit) ? limit : 25,
  };
}

export const CHIP_LABEL: Record<ChipKey, string> = {
  account_id: "Account",
  type: "Type",
  priority: "Priority",
  state: "State",
};
