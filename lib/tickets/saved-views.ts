/**
 * Saved views over `/v1/views` (Ticket Management technical 2.5, functional
 * 5.x: "saved views, personal and shared, in the Queue's view list").
 *
 * A saved view is the server's ConditionSet, the same grammar the export
 * already speaks, so saving one is `paramsToExportSpec` with the account
 * folded back into the conditions (the export route takes `account_id`
 * beside the set; a view has no such parameter and must say it in the set).
 *
 * Applying one is the reverse: the conditions become the Queue's own URL, so
 * the chips stay removable and a pasted link still reproduces the list. The
 * translation is exact for everything this screen can save, and a condition
 * it cannot express is named in `notes` rather than dropped in silence,
 * because a view that quietly shows more than it says is worse than one that
 * admits what it could not apply.
 */
import { paramsToExportSpec, type ExportCondition, type ExportConditionSet } from "@/lib/tickets/export-conditions";
import {
  chipsToSearch,
  DEFAULT_VIEW,
  OUT_OF_SCOPE,
  RESOLVED_STATES,
  type Chip,
  type ChipKey,
  type TicketListParams,
} from "@/lib/tickets/queue-views";

/** The `definition` column of `acct.saved_views`, as the API returns it. */
export interface SavedViewDefinition {
  conditions: ExportConditionSet;
  sort?: "updated_desc" | "created_desc" | "priority";
  columns?: string[];
}

/**
 * The three sharing modes the API declares. `group` is left out of the
 * picker: it needs a `share_ref` naming one of the caller's groups, and the
 * Queue has no group picker, so offering it would only produce
 * `share_ref_required`.
 */
export const SHARE_MODES = ["private", "account"] as const;
export type ShareMode = (typeof SHARE_MODES)[number];

export const SHARE_LABEL: Record<string, string> = {
  private: "Only me",
  group: "My group",
  account: "Everyone on the account",
};

export function shareLabel(share: string): string {
  return SHARE_LABEL[share] ?? share.replace(/_/g, " ");
}

/**
 * The current view and chips as a definition the API will accept. The
 * export's own notes come back with it, since "Breached counts resolution
 * breaches only" is as true of a saved view as it is of a spreadsheet.
 */
export function definitionFromParams(params: TicketListParams): { definition: SavedViewDefinition; notes: string[] } {
  const spec = paramsToExportSpec(params);
  const conditions: ExportCondition[] = [...spec.conditions.conditions];
  if (spec.accountIds.length > 0) conditions.push({ field: "account_id", op: "in", value: spec.accountIds });
  const definition: SavedViewDefinition = { conditions: { conditions, match: "all" } };
  if (params.sort) definition.sort = params.sort;
  return { definition, notes: spec.notes };
}

/** The Queue's own state, read back out of a definition. */
export interface AppliedView {
  view: string;
  chips: Chip[];
  q: string;
  /** What could not be expressed as a view and chips, in words, for the screen to say. */
  notes: string[];
}

const CLOSED_STATES = ["closed", "cancelled"];

function values(value: ExportCondition["value"]): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value === undefined || value === null) return [];
  return [String(value)];
}

function sameSet(a: string[], b: readonly string[]): boolean {
  return a.length === b.length && [...a].sort().join(",") === [...b].sort().join(",");
}

/**
 * A definition as the Queue's view, chips and search box.
 *
 * The system views carry the presets the conditions name: `is_me` on the
 * assignee is My work, a null assignee is Unassigned, the resolution breach
 * flag is Breached, the resolved state list is Resolved and the single
 * awaiting_client state is Awaiting client. Everything else narrows through
 * chips on the five dimensions the URL grammar carries.
 */
export function applyDefinition(definition: SavedViewDefinition | undefined): AppliedView {
  const chips: Chip[] = [];
  const notes: string[] = [];
  let mine = false;
  let unassigned = false;
  let breached = false;
  let openOnly = false;
  let stateIn: string[] | null = null;
  let q = "";
  const push = (key: ChipKey, list: string[]) => {
    for (const value of list)
      if (!chips.some((chip) => chip.key === key && chip.value === value)) chips.push({ key, value });
  };

  for (const condition of definition?.conditions?.conditions ?? []) {
    const key = `${condition.field}:${condition.op}`;
    switch (key) {
      case "assignee_id:is_me":
        mine = true;
        break;
      case "assignee_id:is_null":
        unassigned = true;
        break;
      case "sla_resolution_breached:eq":
        breached = true;
        break;
      case "state:not_in":
        // The `open` preset every view but the two state views carries.
        if (sameSet(values(condition.value), CLOSED_STATES)) openOnly = true;
        else notes.push(`State is not ${values(condition.value).join(", ")} could not be applied.`);
        break;
      case "state:in":
        stateIn = values(condition.value);
        break;
      case "type:in":
        push("type", values(condition.value));
        break;
      case "priority:in":
        push("priority", values(condition.value));
        break;
      case "out_of_scope:in": {
        const known = values(condition.value).filter((value) => (OUT_OF_SCOPE as readonly string[]).includes(value));
        push("out_of_scope", known);
        break;
      }
      case "account_id:in":
        push("account_id", values(condition.value));
        break;
      case "short_description:contains":
        q = String(condition.value ?? "");
        break;
      default:
        notes.push(`${condition.field} ${condition.op.replace(/_/g, " ")} could not be applied.`);
    }
  }

  let view = DEFAULT_VIEW;
  if (mine) view = "mine";
  else if (unassigned) view = "unassigned";
  else if (breached) view = "breached";
  else if (stateIn && sameSet(stateIn, RESOLVED_STATES)) view = "resolved";
  else if (stateIn && sameSet(stateIn, ["awaiting_client"])) view = "awaiting_client";
  if (stateIn && !["resolved", "awaiting_client"].includes(view)) push("state", stateIn);
  // Every system view except the two state views filters to open tickets, so
  // a definition that never said so is narrowed by the one the Queue must
  // pick. The screen says that rather than showing a shorter list in silence.
  if (!openOnly && !stateIn && !["resolved", "awaiting_client"].includes(view))
    notes.push("This view names no state, so the Queue is showing open tickets.");

  return { view, chips, q, notes };
}

/**
 * The Queue address a saved view opens. `saved` rides along so the screen can
 * name the view it is showing and offer rename and delete on it; it is
 * dropped the moment a chip changes, because the list would no longer be the
 * saved one.
 */
export function savedViewSearch(id: string, definition: SavedViewDefinition | undefined, limit = 25): URLSearchParams {
  const applied = applyDefinition(definition);
  const search = chipsToSearch(applied.view, applied.chips, applied.q, limit);
  search.set("saved", id);
  return search;
}

export interface SavedViewDraft {
  name: string;
  share: ShareMode;
  accountId: string;
}

export const NAME_REQUIRED = "A saved view needs a name.";
export const ACCOUNT_REQUIRED = "A saved view is filed under one account. Choose one.";
export const NAME_TOO_LONG = "A name is at most 80 characters.";

/** Refused here before the API is asked, in the API's own limits (80 characters, one account). */
export function validateSavedView(draft: SavedViewDraft): string[] {
  const problems: string[] = [];
  if (draft.name.trim() === "") problems.push(NAME_REQUIRED);
  if (draft.name.trim().length > 80) problems.push(NAME_TOO_LONG);
  if (draft.accountId === "") problems.push(ACCOUNT_REQUIRED);
  return problems;
}

/** Plain words for the refusals `/v1/views` answers with. */
export function describeSavedViewError(code: string, problems?: string[]): string {
  switch (code) {
    case "not_owner":
      return "Only the person who saved a view can rename or delete it.";
    case "invalid_conditions":
      return problems && problems.length > 0
        ? `The API refused the conditions: ${problems.join("; ")}`
        : "The API refused the conditions of this view.";
    case "share_ref_required":
      return "A view shared with a group has to name the group.";
    case "stale_version":
      return "Someone else changed this view. It has been reloaded.";
    case "not_found":
      return "That saved view is gone. It may have been deleted or unshared.";
    default:
      return `The saved view was not written (${code}).`;
  }
}

/**
 * True while `/v1/views` is not deployed. The Queue keeps its per-browser
 * stars in that case rather than losing "Save as view" entirely, the same
 * way the Waiting rail hides itself before its route exists.
 */
export function isNotDeployed(status: number | string | undefined): boolean {
  return status === 404 || status === 501;
}
