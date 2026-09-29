/**
 * Saved queries for the audit search (Audit & Analytics 7.1, backend
 * 1b7bc74). A saved query is a named condition set over the three event
 * streams and nothing else: it holds no rows, no account and no window, and
 * what it may see is decided when it runs, by the grant clause the search
 * applies to whoever ran it.
 *
 * Two rules the screen has to keep. Sharing needs `audit:export`, which
 * `audit:read` does not imply, so the switch is not offered without it rather
 * than offered and refused. And a query that is gone reads as gone: the API
 * answers 404 both for a query that was deleted and for someone else's
 * private one, deliberately, so the wording says what a reader can act on
 * without claiming which of the two it was.
 */
import type { AuditCondition, AuditSavedQuery, SavedQueryBody } from "@/redux/reportingApi";

export interface SavedQueryDraft {
  name: string;
  description: string;
  shared: boolean;
}

export function emptySavedQueryDraft(): SavedQueryDraft {
  return { name: "", description: "", shared: false };
}

export function draftFromSavedQuery(query: AuditSavedQuery): SavedQueryDraft {
  return { name: query.name, description: query.description, shared: query.shared };
}

export const QUERY_NAME_REQUIRED = "A saved query needs a name.";
export const QUERY_NAME_TOO_LONG = "A name is at most 120 characters.";
export const QUERY_NEEDS_CONDITIONS = "A saved query with no conditions would match every event. Add one first.";
export const SHARING_NEEDS_EXPORT = "Sharing a saved query needs the audit:export permission.";

/** Refused here in the API's own limits (120 characters, 500 for the description, at most twenty conditions). */
export function validateSavedQuery(draft: SavedQueryDraft, conditions: AuditCondition[]): string[] {
  const problems: string[] = [];
  if (draft.name.trim() === "") problems.push(QUERY_NAME_REQUIRED);
  if (draft.name.trim().length > 120) problems.push(QUERY_NAME_TOO_LONG);
  if (draft.description.length > 500) problems.push("A description is at most 500 characters.");
  if (conditions.length === 0) problems.push(QUERY_NEEDS_CONDITIONS);
  if (conditions.length > 20) problems.push("A saved query holds at most 20 conditions.");
  return problems;
}

export function savedQueryBody(draft: SavedQueryDraft, conditions: AuditCondition[]): SavedQueryBody {
  return {
    name: draft.name.trim(),
    description: draft.description.trim(),
    shared: draft.shared,
    conditions,
  };
}

/** Who saved it, in the server's own name where it sent one. */
export function ownerLabel(query: AuditSavedQuery, viewerUserId: string | undefined): string {
  if (viewerUserId && query.owner_user_id === viewerUserId) return "You";
  return query.owner_name ?? query.owner_user_id.slice(0, 8);
}

/** The line under a saved query's name: how many conditions it carries, who saved it and who else has it. */
export function savedQueryLine(query: AuditSavedQuery, viewerUserId: string | undefined): string {
  const count = query.conditions.length;
  const conditions = `${count} condition${count === 1 ? "" : "s"}`;
  const sharing = query.shared ? "shared" : "private";
  return `${conditions}, ${sharing}, saved by ${ownerLabel(query, viewerUserId)}`;
}

/** Whether the signed-in reader may rename, reshare or delete this one. Editing is the owner's alone. */
export function isOwner(query: AuditSavedQuery, viewerUserId: string | undefined): boolean {
  return viewerUserId !== undefined && query.owner_user_id === viewerUserId;
}

/**
 * Plain words for what the saved-query routes refuse.
 *
 * `not_found` covers three things the API deliberately does not tell apart:
 * a query that was deleted, one whose owner stopped sharing it, and an edit
 * of someone else's. The wording names them as the possibilities rather than
 * asserting one, and never says "forbidden", which would confirm a foreign
 * id exists.
 */
export function describeSavedQueryError(code: string, problems?: string[], permission?: string): string {
  switch (code) {
    case "not_found":
      return "That saved query is no longer there. It may have been deleted, or its owner may have stopped sharing it.";
    case "forbidden":
      return permission === "audit:export" ? SHARING_NEEDS_EXPORT : `You need the ${permission ?? "right"} permission.`;
    case "invalid_conditions":
      return problems && problems.length > 0
        ? `The search refused the conditions: ${problems.join("; ")}`
        : "The search refused these conditions, so nothing was saved.";
    case "validation_failed":
      return problems?.join("; ") ?? "The saved query was not valid.";
    default:
      return `The saved query was not written (${code}).`;
  }
}
