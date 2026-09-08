import { describe, expect, it } from "vitest";
import type { Condition } from "@/lib/conditions";
import { builtConditions, conditionsParam, queueConditionFields } from "@/lib/tickets/queue-conditions";

/** base64url back to the object, the way the API decodes it. */
function decode(param: string): unknown {
  const padded = param.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(atob(padded + "=".repeat((4 - (padded.length % 4)) % 4)));
}

describe("the Queue's condition fields", () => {
  it("offers only fields the server's allowlist carries", () => {
    // `src/modules/tickets/conditions.ts`, FIELDS. A field outside it is a
    // 400 the reader would meet with no way back.
    const allowed = new Set([
      "state",
      "type",
      "priority",
      "impact",
      "urgency",
      "source",
      "category",
      "short_description",
      "account_id",
      "contract_id",
      "group_id",
      "assignee_id",
      "created_by",
      "created_at",
      "updated_at",
      "resolved_at",
      "first_response_at",
      "sla_response_breached",
      "sla_resolution_breached",
      "priority_overridden",
      "out_of_scope",
    ]);
    for (const field of queueConditionFields()) expect(allowed.has(field.key)).toBe(true);
  });

  it("fills the account and group rows from the catalogs, so neither asks for a uuid", () => {
    const fields = queueConditionFields({
      accounts: [{ id: "acct-1", name: "Brookfield" }],
      groups: [{ id: "grp-1", name: "EPM Close" }],
    });
    expect(fields.find((f) => f.key === "account_id")?.options).toEqual([{ value: "acct-1", label: "Brookfield" }]);
    expect(fields.find((f) => f.key === "group_id")?.options).toEqual([{ value: "grp-1", label: "EPM Close" }]);
  });

  it("names every enum row in words rather than in keys", () => {
    const state = queueConditionFields().find((f) => f.key === "state");
    expect(state?.options).toContainEqual({ value: "in_progress", label: "In progress" });
    const scope = queueConditionFields().find((f) => f.key === "out_of_scope");
    expect(scope?.options).toContainEqual({ value: "flagged", label: "Flagged, waiting for a decision" });
  });
});

describe("what the builder sends", () => {
  const ready: Condition[] = [
    { field: "short_description", op: "contains", value: "report" },
    { field: "priority", op: "eq", value: "p1" },
  ];

  it("encodes the finished rows as the set the list route decodes", () => {
    const param = conditionsParam(ready);
    expect(param).toBeDefined();
    expect(decode(param as string)).toEqual({
      conditions: [
        { field: "short_description", op: "contains", value: "report" },
        { field: "priority", op: "eq", value: "p1" },
      ],
      match: "all",
    });
  });

  it("leaves an unfinished row out of the request but keeps the finished ones", () => {
    const set = builtConditions([...ready, { field: "state", op: "eq", value: "" }]);
    expect(set.map((c) => c.field)).toEqual(["short_description", "priority"]);
  });

  it("sends no parameter at all when nothing is finished", () => {
    expect(conditionsParam([])).toBeUndefined();
    expect(conditionsParam([{ field: "state", op: "eq", value: "" }])).toBeUndefined();
  });

  it("sends a standalone operator with no value key", () => {
    const set = builtConditions([{ field: "assignee_id", op: "is_me", value: null }]);
    expect(set).toEqual([{ field: "assignee_id", op: "is_me" }]);
  });
});
