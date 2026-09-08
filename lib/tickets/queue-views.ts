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
  /** The out-of-scope flag (TM-11); one or more values of `OUT_OF_SCOPE`. */
  out_of_scope?: string[];
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

/**
 * The out-of-scope vocabulary, exactly as the API declares it
 * (`src/modules/tickets/conditions.ts`, `OUT_OF_SCOPE`, from the check
 * constraint of migration 0004). `GET /v1/tickets?out_of_scope=` takes one
 * or more of these as a comma list and refuses anything else with a 400, so
 * the list is written here once and the view, the chip and the export
 * conditions all read it.
 */
export const OUT_OF_SCOPE = ["none", "flagged", "approved", "declined"] as const;

export type OutOfScope = (typeof OUT_OF_SCOPE)[number];

export const OUT_OF_SCOPE_LABEL: Record<string, string> = {
  none: "Not flagged",
  flagged: "Flagged, waiting for a decision",
  approved: "Approved as out of scope",
  declined: "Flag declined",
};

export function outOfScopeLabel(value: string): string {
  return OUT_OF_SCOPE_LABEL[value] ?? value.replace(/_/g, " ");
}

export const QUEUE_VIEWS: QueueView[] = [
  { key: "open", label: "All open", params: { open: true } },
  { key: "mine", label: "My work", params: { open: true, mine: true } },
  { key: "unassigned", label: "Unassigned", params: { open: true, unassigned: true } },
  { key: "breached", label: "Breached", params: { open: true, breached: true } },
  { key: "p1", label: "P1", params: { open: true, priority: ["p1"] } },
  // Functional 5.x names "Flagged out of scope" among the Queue's own
  // presets, and the flag is the thing an approver comes here for: the work
  // waiting on their decision, not every ticket the flag ever touched.
  { key: "flagged", label: "Flagged out of scope", params: { open: true, out_of_scope: ["flagged"] } },
  { key: "awaiting_client", label: "Awaiting client", params: { state: ["awaiting_client"] } },
  { key: "resolved", label: "Resolved", params: { state: RESOLVED_STATES } },
];

export const DEFAULT_VIEW = "open";

/**
 * The five dimensions a chip narrows.
 *
 * `out_of_scope` is the newest (TM-11): the list route takes it as a
 * parameter and the server's condition-set allowlist carries it as an enum,
 * so the chip asks for something the API actually filters on and a saved
 * link reproduces it. The vocabulary is closed, and a value outside it is a
 * 400 rather than a silent widening, which is why the chip offers the four
 * values rather than free text.
 */
export type ChipKey = "account_id" | "type" | "priority" | "state" | "out_of_scope";

/** The chip dimensions in the order the URL writes them. */
export const CHIP_KEYS: ChipKey[] = ["account_id", "type", "priority", "state", "out_of_scope"];

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
  for (const key of CHIP_KEYS) {
    const values = chips.filter((chip) => chip.key === key).map((chip) => chip.value);
    if (values.length > 0) search.set(key, values.join(","));
  }
  if (q) search.set("q", q);
  if (limit !== 25) search.set("limit", String(limit));
  return search;
}

export function chipsFromSearch(search: URLSearchParams): {
  view: string;
  chips: Chip[];
  q: string;
  limit: number;
  /**
   * The saved view (`/v1/views`) whose conditions were written into this URL,
   * where one was. It names the list rather than filtering it: the chips are
   * the filter, and the id leaves the URL as soon as one of them changes.
   */
  saved: string | null;
} {
  const chips: Chip[] = [];
  for (const key of CHIP_KEYS) {
    const raw = search.get(key);
    if (!raw) continue;
    for (const value of raw.split(",").filter(Boolean)) {
      // The out-of-scope vocabulary is closed on the server, so a value from
      // outside it is dropped here rather than sent for a 400: the API's own
      // waiting-rail link (`/tickets?out_of_scope=flagged`) reads back as a
      // chip, and a hand-typed address cannot break the list.
      if (key === "out_of_scope" && !(OUT_OF_SCOPE as readonly string[]).includes(value)) continue;
      chips.push({ key, value });
    }
  }
  const limit = Number(search.get("limit") ?? 25);
  return {
    view: search.get("view") ?? DEFAULT_VIEW,
    chips,
    q: search.get("q") ?? "",
    limit: [10, 25, 50, 100].includes(limit) ? limit : 25,
    saved: search.get("saved"),
  };
}

export const CHIP_LABEL: Record<ChipKey, string> = {
  account_id: "Account",
  type: "Type",
  priority: "Priority",
  state: "State",
  out_of_scope: "Out of scope",
};
