import { describe, expect, it } from "vitest";
import {
  chipsFromSearch,
  chipsToSearch,
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
