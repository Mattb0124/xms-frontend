import { describe, expect, it } from "vitest";
import { encodeConditions, exportUrl, paramsToExportSpec } from "@/lib/tickets/export-conditions";
import { QUEUE_VIEWS, viewByKey, viewToParams } from "@/lib/tickets/queue-views";

describe("paramsToExportSpec", () => {
  it("expresses the open view with chips as server conditions and the account filter", () => {
    const params = viewToParams(viewByKey("open"), [
      { key: "account_id", value: "acct-1" },
      { key: "priority", value: "p1" },
    ]);
    const spec = paramsToExportSpec(params);
    expect(spec.conditions).toEqual({
      match: "all",
      conditions: [
        { field: "state", op: "not_in", value: ["closed", "cancelled"] },
        { field: "priority", op: "in", value: ["p1"] },
      ],
    });
    expect(spec.accountIds).toEqual(["acct-1"]);
    expect(spec.notes).toEqual([]);
  });

  it("maps mine, unassigned, breached and the search term, and names the breached approximation", () => {
    expect(paramsToExportSpec(viewByKey("mine").params).conditions.conditions).toContainEqual({
      field: "assignee_id",
      op: "is_me",
    });
    expect(paramsToExportSpec(viewByKey("unassigned").params).conditions.conditions).toContainEqual({
      field: "assignee_id",
      op: "is_null",
    });
    const breached = paramsToExportSpec({ ...viewByKey("breached").params, q: "cube" });
    expect(breached.conditions.conditions).toContainEqual({ field: "sla_resolution_breached", op: "eq", value: true });
    expect(breached.conditions.conditions).toContainEqual({
      field: "short_description",
      op: "contains",
      value: "cube",
    });
    expect(breached.notes).toHaveLength(1);
    expect(QUEUE_VIEWS.every((view) => paramsToExportSpec(view.params).conditions.conditions.length > 0)).toBe(true);
  });
});

describe("exportUrl", () => {
  it("encodes the set as base64url JSON the server decodes, and joins accounts with commas", () => {
    const spec = paramsToExportSpec({ open: true, account_id: ["a", "b"] });
    const url = exportUrl("xlsx", spec);
    const search = new URL(`http://x${url}`).searchParams;
    expect(search.get("format")).toBe("xlsx");
    expect(search.get("account_id")).toBe("a,b");
    const encoded = search.get("conditions")!;
    expect(encoded).not.toMatch(/[+/=]/);
    const decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    expect(decoded).toEqual(spec.conditions);
    expect(encodeConditions({ conditions: [] })).toBe(Buffer.from('{"conditions":[]}').toString("base64url"));
  });
});
