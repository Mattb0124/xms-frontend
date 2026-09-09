import { describe, expect, it } from "vitest";
import { attentionOrder, isAtRisk, isBreached, TILES, underLens, needsAttention } from "@/lib/my-work/attention";
import { aTicketView } from "@/test-kit/tickets";
import type { TicketView } from "@/redux/ticketsApi";

function clock(overrides: Partial<{ remainingMinutes: number; breached: boolean; met: boolean }> = {}) {
  return {
    kind: "resolution" as const,
    dueAt: "2026-09-08T20:00:00Z",
    remainingMinutes: 480,
    paused: false,
    breached: false,
    met: false,
    targetMinutes: 480,
    pausedTotalMinutes: 0,
    ...overrides,
  };
}

const breached = aTicketView({ key: "CS0000001", sla: { resolution: clock({ breached: true }) } });
const atRisk = aTicketView({ key: "CS0000002", sla: { resolution: clock({ remainingMinutes: 60 }) } });
const easy = aTicketView({ key: "CS0000003", sla: { resolution: clock({ remainingMinutes: 400 }) } });
const staleAwaiting = aTicketView({
  key: "CS0000004",
  state: "awaiting_client",
  updated_at: "2026-09-01T12:00:00Z",
  sla: {},
});
const freshAwaiting = aTicketView({
  key: "CS0000005",
  state: "awaiting_client",
  updated_at: "2026-09-08T09:00:00Z",
  sla: {},
});

describe("what the list holds", () => {
  it("holds what a person can act on now, and leaves the rest to the scorecards", () => {
    // Matt, 2026-09-09: "my work should only show things that need action
    // now", and "if a ticket is resolved, why would it need my attention?".
    // A case waiting on the client is not this desk's to move and its clock
    // is paused; a settled case needs nothing at all. The scorecards go on
    // counting every open case, so the number above the list and the work
    // inside it answer two different questions.
    const mine = [breached, atRisk, easy, staleAwaiting, freshAwaiting];
    const rows = attentionOrder(mine, []);
    expect(new Set(rows.map((row) => row.key))).toEqual(new Set([breached.key, atRisk.key, easy.key]));
    // The tile still counts the whole desk, waiting cases included.
    expect(TILES[0].value({ mine, breached: 1, atRisk: 1, awaiting: 2 })).toBe(mine.length);
  });

  it("drops a settled case, whatever word the state machine uses for it", () => {
    for (const state of ["resolved", "fulfilled", "completed", "done", "closed", "cancelled"]) {
      expect(needsAttention({ ...easy, state })).toBe(false);
    }
    for (const state of ["new", "triage", "in_progress", "investigating"]) {
      expect(needsAttention({ ...easy, state })).toBe(true);
    }
  });

  it("reads the clock the same way the scorecards do", () => {
    expect(isBreached(breached)).toBe(true);
    expect(isBreached(atRisk)).toBe(false);
    // At risk is the last quarter of the window, and a breached clock is not
    // also at risk: it has already gone.
    expect(isAtRisk(atRisk)).toBe(true);
    expect(isAtRisk(easy)).toBe(false);
    expect(isAtRisk(breached)).toBe(false);
  });
});

describe("the order the list is read in", () => {
  it("puts mine first on the tightest clock, then the group's unassigned work", () => {
    const group = [aTicketView({ key: "CS0000010", sla: { resolution: clock({ remainingMinutes: 30 }) } })];
    const rows = attentionOrder([easy, atRisk], group);
    // Mine, tightest first; then the group's, however tight its own clock is.
    expect(rows.map((row) => row.key)).toEqual(["CS0000002", "CS0000003", "CS0000010"]);
  });

  it("counts nothing twice when a ticket is in both lists", () => {
    const rows = attentionOrder([easy], [easy, atRisk]);
    expect(rows.map((row) => row.key)).toEqual(["CS0000003", "CS0000002"]);
  });
});

describe("the scorecards", () => {
  const rows: TicketView[] = [breached, atRisk, easy, staleAwaiting];

  it("filters the list in place rather than navigating away", () => {
    // Render 08's note 1. Nothing pressed is the whole list.
    expect(underLens(rows, null)).toHaveLength(4);
    expect(underLens(rows, "breached").map((row) => row.key)).toEqual(["CS0000001"]);
    expect(underLens(rows, "at_risk").map((row) => row.key)).toEqual(["CS0000002"]);
    expect(underLens(rows, "awaiting").map((row) => row.key)).toEqual(["CS0000004"]);
    // Assigned to me is the list itself, so pressing it changes nothing.
    expect(underLens(rows, "assigned")).toHaveLength(4);
  });

  it("names each number and what it is counted over", () => {
    const counts = { mine: rows, breached: 1, atRisk: 1, awaiting: 1 };
    const facts = { accountCount: 3, firstBreached: breached, awaiting: 1 };
    expect(TILES.map((tile) => [tile.label, tile.value(counts), tile.detail(facts)])).toEqual([
      ["Assigned to me", 4, "across 3 accounts"],
      ["Breached", 1, "CS0000001"],
      ["At risk", 1, "under 25% left"],
      ["Awaiting client", 1, "clock paused"],
    ]);
  });

  it("says one account and one clock in the singular", () => {
    const assigned = TILES[0];
    const awaiting = TILES[3];
    expect(assigned.detail({ accountCount: 1, awaiting: 0 })).toBe("on 1 account");
    expect(awaiting.detail({ accountCount: 1, awaiting: 2 })).toBe("clocks paused");
  });
});
