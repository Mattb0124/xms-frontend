import { describe, expect, it } from "vitest";
import { viewByKey, viewToParams } from "@/lib/tickets/queue-views";
import {
  ACCOUNT_REQUIRED,
  applyDefinition,
  definitionFromParams,
  describeSavedViewError,
  isNotDeployed,
  NAME_REQUIRED,
  savedViewSearch,
  shareLabel,
  validateSavedView,
} from "@/lib/tickets/saved-views";
import { aSavedViewDefinition, VIEW_ACCOUNT_ID } from "@/test-kit/views";

const params = (view: string, chips: Parameters<typeof viewToParams>[1] = [], extra = {}) =>
  viewToParams(viewByKey(view), chips, extra);

describe("definitionFromParams", () => {
  it("writes the account into the conditions, since a view has no account parameter", () => {
    const { definition } = definitionFromParams(params("open", [{ key: "account_id", value: VIEW_ACCOUNT_ID }]));
    expect(definition.conditions.match).toBe("all");
    expect(definition.conditions.conditions).toEqual([
      { field: "state", op: "not_in", value: ["closed", "cancelled"] },
      { field: "account_id", op: "in", value: [VIEW_ACCOUNT_ID] },
    ]);
  });

  it("carries the presets the system views stand for", () => {
    expect(definitionFromParams(params("mine")).definition.conditions.conditions).toContainEqual({
      field: "assignee_id",
      op: "is_me",
    });
    expect(definitionFromParams(params("unassigned")).definition.conditions.conditions).toContainEqual({
      field: "assignee_id",
      op: "is_null",
    });
    expect(definitionFromParams(params("resolved")).definition.conditions.conditions).toContainEqual({
      field: "state",
      op: "in",
      value: ["resolved", "fulfilled", "completed", "done"],
    });
  });

  it("keeps the export's own note about what the grammar cannot say", () => {
    const { notes } = definitionFromParams(params("breached"));
    expect(notes).toEqual(["Breached counts resolution breaches only in the export."]);
  });
});

describe("applyDefinition", () => {
  it("reads a definition back as the view and chips the Queue writes", () => {
    expect(applyDefinition(aSavedViewDefinition())).toEqual({
      view: "open",
      chips: [
        { key: "priority", value: "p1" },
        { key: "account_id", value: VIEW_ACCOUNT_ID },
      ],
      q: "",
      notes: [],
    });
  });

  it("round-trips every system view", () => {
    for (const key of ["open", "mine", "unassigned", "breached", "p1", "flagged", "awaiting_client", "resolved"]) {
      const { definition } = definitionFromParams(params(key));
      const applied = applyDefinition(definition);
      expect(applied.notes, `${key} lost something on the way back`).toEqual([]);
      expect(viewToParams(viewByKey(applied.view), applied.chips), `${key} does not round-trip`).toEqual(params(key));
    }
  });

  it("carries the search text back into the search box", () => {
    const { definition } = definitionFromParams(params("open", [], { q: "cube" }));
    expect(applyDefinition(definition).q).toBe("cube");
  });

  it("names a condition the chip grammar cannot express rather than dropping it", () => {
    const applied = applyDefinition({
      conditions: {
        conditions: [
          { field: "state", op: "not_in", value: ["closed", "cancelled"] },
          { field: "category", op: "contains", value: "network" },
        ],
      },
    });
    expect(applied.chips).toEqual([]);
    expect(applied.notes).toEqual(["category contains could not be applied."]);
  });

  it("says so when a view names no state and the Queue narrows it to open", () => {
    const applied = applyDefinition({ conditions: { conditions: [{ field: "type", op: "in", value: ["incident"] }] } });
    expect(applied.view).toBe("open");
    expect(applied.notes).toEqual(["This view names no state, so the Queue is showing open tickets."]);
  });

  it("drops an out-of-scope value outside the server's closed vocabulary", () => {
    const applied = applyDefinition({
      conditions: {
        conditions: [
          { field: "state", op: "not_in", value: ["closed", "cancelled"] },
          { field: "out_of_scope", op: "in", value: ["flagged", "invented"] },
        ],
      },
    });
    expect(applied.chips).toEqual([{ key: "out_of_scope", value: "flagged" }]);
  });
});

describe("savedViewSearch", () => {
  it("writes the conditions and the view id into the Queue address", () => {
    expect(savedViewSearch("view-1", aSavedViewDefinition()).toString()).toBe(
      `account_id=${VIEW_ACCOUNT_ID}&priority=p1&saved=view-1`,
    );
  });

  it("keeps the page size the reader was already on", () => {
    expect(savedViewSearch("view-1", aSavedViewDefinition(), 50).toString()).toContain("limit=50");
  });
});

describe("validateSavedView", () => {
  it("refuses a nameless view and one filed under no account before the API is asked", () => {
    expect(validateSavedView({ name: "", share: "private", accountId: "" })).toEqual([NAME_REQUIRED, ACCOUNT_REQUIRED]);
    expect(validateSavedView({ name: "P1s", share: "account", accountId: VIEW_ACCOUNT_ID })).toEqual([]);
  });
});

describe("the words for a refusal", () => {
  it("says who may rename a view and what the API refused", () => {
    expect(describeSavedViewError("not_owner")).toContain("Only the person who saved a view");
    expect(describeSavedViewError("invalid_conditions", ["condition 0: unknown field password"])).toContain(
      "unknown field password",
    );
    expect(describeSavedViewError("not_found")).toContain("gone");
    expect(shareLabel("account")).toBe("Everyone on the account");
    expect(shareLabel("group")).toBe("My group");
  });

  it("treats only a missing route as the reason to fall back to the browser star", () => {
    expect(isNotDeployed(404)).toBe(true);
    expect(isNotDeployed(501)).toBe(true);
    expect(isNotDeployed(403)).toBe(false);
    expect(isNotDeployed(undefined)).toBe(false);
  });
});
