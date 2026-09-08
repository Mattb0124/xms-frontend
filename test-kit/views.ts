import type { SavedViewDefinition } from "@/lib/tickets/saved-views";
import type { SavedView } from "@/redux/ticketsApi";

export const SAVED_VIEW_ID = "77777777-7777-4777-8777-777777777777";
export const VIEW_OWNER_ID = "user-ada";
export const VIEW_ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";

/**
 * A saved view as `/v1/views` answers it: the server's ConditionSet, the
 * owner, the sharing mode and the version an edit carries. The default is the
 * one the Queue itself would write for "All open, P1, Brookfield", so a test
 * that saves and a test that applies are looking at the same shape.
 */
export function aSavedViewDefinition(overrides: Partial<SavedViewDefinition> = {}): SavedViewDefinition {
  return {
    conditions: {
      conditions: [
        { field: "state", op: "not_in", value: ["closed", "cancelled"] },
        { field: "priority", op: "in", value: ["p1"] },
        { field: "account_id", op: "in", value: [VIEW_ACCOUNT_ID] },
      ],
      match: "all",
    },
    ...overrides,
  };
}

export function aSavedView(overrides: Partial<SavedView> = {}): SavedView {
  return {
    id: SAVED_VIEW_ID,
    account_id: VIEW_ACCOUNT_ID,
    owner_id: VIEW_OWNER_ID,
    name: "Brookfield P1s",
    definition: aSavedViewDefinition(),
    share: "private",
    share_ref: null,
    created_at: "2026-09-01T09:00:00.000Z",
    updated_at: "2026-09-01T09:00:00.000Z",
    version: 1,
    ...overrides,
  };
}
