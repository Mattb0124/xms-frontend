import { describe, expect, it } from "vitest";
import {
  addChip,
  CHIP_KEYS,
  CHIP_LABEL,
  chipsFromSearch,
  chipsToSearch,
  MULTI_CHIP_KEYS,
  MY_GROUPS,
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
    expect(chipsFromSearch(search)).toEqual({ view: "mine", chips, q: "brookfield", limit: 50, saved: null });
    expect(chipsToSearch("open", [], "", 25).toString()).toBe("");
    expect(chipsFromSearch(new URLSearchParams("limit=7"))).toMatchObject({ view: "open", limit: 25 });
    // The saved view id names the list rather than filtering it, so it reads
    // back beside the chips and never as one of them.
    expect(chipsFromSearch(new URLSearchParams("view=mine&saved=view-1")).saved).toBe("view-1");
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

/**
 * The group queue and the group filter (TM-08). `my_groups` is a flag the
 * server answers from the membership table and `group_id` is one assignment
 * group, so neither is a comma list and a second chip on either replaces the
 * first rather than producing a value the route refuses.
 */
describe("the group dimensions", () => {
  it("carries both dimensions as chips with their own labels", () => {
    expect(CHIP_KEYS).toContain("group_id");
    expect(CHIP_KEYS).toContain("my_groups");
    expect(MULTI_CHIP_KEYS).not.toContain("group_id");
    expect(MULTI_CHIP_KEYS).not.toContain("my_groups");
    expect(CHIP_LABEL.group_id).toBe("Group");
    expect(CHIP_LABEL.my_groups).toBe("Group queue");
  });

  it("sends the group queue as the flag and the group as one id", () => {
    const params = viewToParams(viewByKey("breached"), [
      { key: "my_groups", value: MY_GROUPS },
      { key: "group_id", value: "g-1" },
    ]);
    expect(paramsToQuery(params)).toEqual({ open: "true", breached: "true", my_groups: "true", group_id: "g-1" });
  });

  it("keeps the last value on a single-value dimension rather than joining them", () => {
    const params = viewToParams(viewByKey("open"), [
      { key: "group_id", value: "g-1" },
      { key: "group_id", value: "g-2" },
    ]);
    expect(params.group_id).toBe("g-2");
    expect(
      chipsToSearch(
        "open",
        [
          { key: "group_id", value: "g-1" },
          { key: "group_id", value: "g-2" },
        ],
        "",
        25,
      ).toString(),
    ).toBe("group_id=g-2");
  });

  it("replaces rather than appends when a chip is added on a single-value dimension", () => {
    const chips = addChip([{ key: "group_id", value: "g-1" }], { key: "group_id", value: "g-2" });
    expect(chips).toEqual([{ key: "group_id", value: "g-2" }]);
    const many = addChip([{ key: "priority", value: "p1" }], { key: "priority", value: "p2" });
    expect(many).toEqual([
      { key: "priority", value: "p1" },
      { key: "priority", value: "p2" },
    ]);
  });

  it("reads a hand-typed address back without breaking the list", () => {
    expect(chipsFromSearch(new URLSearchParams("group_id=g-1,g-2")).chips).toEqual([{ key: "group_id", value: "g-1" }]);
    // The group queue is a flag: anything but the flag is not it.
    expect(chipsFromSearch(new URLSearchParams("my_groups=maybe")).chips).toEqual([]);
    expect(chipsFromSearch(new URLSearchParams("my_groups=true")).chips).toEqual([{ key: "my_groups", value: "true" }]);
  });
});
