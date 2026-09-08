import { describe, expect, it } from "vitest";
import {
  CHIP_KEYS,
  CHIP_LABEL,
  chipsFromSearch,
  chipsToSearch,
  OUT_OF_SCOPE,
  outOfScopeLabel,
  paramsToQuery,
  QUEUE_VIEWS,
  viewByKey,
  viewToParams,
} from "@/lib/tickets/queue-views";

describe("queue views", () => {
  it("maps every system view to list params", () => {
    expect(viewByKey("mine").params).toEqual({ open: true, mine: true });
    expect(viewByKey("unassigned").params).toEqual({ open: true, unassigned: true });
    expect(viewByKey("p1").params).toEqual({ open: true, priority: ["p1"] });
    expect(viewByKey("awaiting_client").params).toEqual({ state: ["awaiting_client"] });
    expect(viewByKey("resolved").params.state).toEqual(["resolved", "fulfilled", "completed", "done"]);
    expect(viewByKey("breached").params).toEqual({ open: true, breached: true });
    expect(viewByKey("nonsense").key).toBe("open");
    expect(QUEUE_VIEWS.map((view) => view.key)).toHaveLength(new Set(QUEUE_VIEWS.map((view) => view.key)).size);
  });

  it("merges chips into the view without duplicating a value", () => {
    const params = viewToParams(
      viewByKey("p1"),
      [
        { key: "priority", value: "p1" },
        { key: "priority", value: "p2" },
        { key: "account_id", value: "acc-1" },
      ],
      { q: "cube", limit: 50 },
    );
    expect(params).toEqual({ open: true, priority: ["p1", "p2"], account_id: ["acc-1"], q: "cube", limit: 50 });
    expect(paramsToQuery(params)).toEqual({
      open: "true",
      priority: "p1,p2",
      account_id: "acc-1",
      q: "cube",
      limit: "50",
    });
  });

  it("round-trips the URL grammar", () => {
    const chips = [
      { key: "type" as const, value: "incident" },
      { key: "state" as const, value: "new" },
      { key: "state" as const, value: "assigned" },
    ];
    const search = chipsToSearch("mine", chips, "brookfield", 50);
    expect(search.toString()).toBe("view=mine&type=incident&state=new%2Cassigned&q=brookfield&limit=50");
    expect(chipsFromSearch(search)).toEqual({ view: "mine", chips, q: "brookfield", limit: 50 });
    expect(chipsToSearch("open", [], "", 25).toString()).toBe("");
    expect(chipsFromSearch(new URLSearchParams("limit=7"))).toMatchObject({ view: "open", limit: 25 });
  });
});

/**
 * The out-of-scope flag as a filter (TM-11, backend commit dfb72ab): the
 * list route takes `out_of_scope=` as a comma list of the closed vocabulary
 * and refuses anything else, so the chip offers exactly those four values
 * and the API's own waiting-rail link reads back as one.
 */
describe("the out-of-scope filter", () => {
  it("carries the server's vocabulary and nothing else", () => {
    expect([...OUT_OF_SCOPE]).toEqual(["none", "flagged", "approved", "declined"]);
    expect(outOfScopeLabel("flagged")).toBe("Flagged, waiting for a decision");
    expect(outOfScopeLabel("something_new")).toBe("something new");
    expect(CHIP_KEYS).toContain("out_of_scope");
    expect(CHIP_LABEL.out_of_scope).toBe("Out of scope");
  });

  it("offers Flagged out of scope as a system view", () => {
    expect(viewByKey("flagged").params).toEqual({ open: true, out_of_scope: ["flagged"] });
    expect(paramsToQuery(viewByKey("flagged").params)).toEqual({ open: "true", out_of_scope: "flagged" });
  });

  it("sends a chip as the comma list the API parses", () => {
    const params = viewToParams(viewByKey("open"), [
      { key: "out_of_scope", value: "flagged" },
      { key: "out_of_scope", value: "approved" },
    ]);
    expect(paramsToQuery(params)).toEqual({ open: "true", out_of_scope: "flagged,approved" });
  });

  it("reads the API's waiting-rail link back as a chip and drops a value the column cannot hold", () => {
    expect(chipsFromSearch(new URLSearchParams("out_of_scope=flagged")).chips).toEqual([
      { key: "out_of_scope", value: "flagged" },
    ]);
    expect(chipsFromSearch(new URLSearchParams("out_of_scope=flagged,made_up")).chips).toEqual([
      { key: "out_of_scope", value: "flagged" },
    ]);
    expect(chipsToSearch("open", [{ key: "out_of_scope", value: "flagged" }], "", 25).toString()).toBe(
      "out_of_scope=flagged",
    );
  });
});
