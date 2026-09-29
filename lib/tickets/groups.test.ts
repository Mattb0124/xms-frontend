import { describe, expect, it } from "vitest";
import {
  CHANGE_WINDOW_ENDS_REQUIRED,
  describeGroupError,
  describeTicketGroupError,
  ENDS_AFTER_STARTS,
  FREEZE_ENDS_AFTER_STARTS,
  FREEZE_ENDS_REQUIRED,
  GROUP_ACCOUNT_REQUIRED,
  GROUP_NAME_REQUIRED,
  refusalProblems,
  RULE_DUPLICATE,
  RULE_GROUP_REQUIRED,
  ticketGroupKindLabel,
  ticketGroupStatusLabel,
  toFreezeDrafts,
  toFreezeWindows,
  toInstant,
  toLocalInput,
  toRoutingRuleInputs,
  validateRoutingRules,
  CHANGE_WINDOW_REASON_REQUIRED,
  scheduleMoved,
  validateTicketGroup,
  type RoutingRuleDraft,
  type TicketGroupDraft,
} from "@/lib/tickets/groups";

const ACCOUNT_ID = "77777777-7777-4777-8777-777777777777";

function aGroupDraft(overrides: Partial<TicketGroupDraft> = {}): TicketGroupDraft {
  return {
    accountId: ACCOUNT_ID,
    kind: "change_window",
    name: "October release window",
    description: "",
    ownerUserId: "",
    status: "planned",
    startsAt: "2026-10-03T18:00",
    endsAt: "2026-10-04T02:00",
    freezes: [],
    changeWindowReason: "",
    ...overrides,
  };
}

function aRuleDraft(overrides: Partial<RoutingRuleDraft> = {}): RoutingRuleDraft {
  return { ticketType: "incident", category: "", groupId: "g-1", ...overrides };
}

describe("the words for a group refusal", () => {
  it("says why a group change on a ticket was refused", () => {
    expect(describeGroupError({ status: 400, data: { code: "group_retired" } })).toContain("retired");
    expect(describeGroupError({ status: 409, data: { code: "stale_version" } })).toContain("reloaded");
    expect(describeGroupError({ status: 409, data: { code: "ticket_closed" } })).toContain("cannot be reassigned");
    expect(describeGroupError({ status: 500, data: { code: "boom" } })).toContain("boom");
  });

  it("reads the problems out of an invalid_schedule and puts them in the sentence", () => {
    const error = { status: 400, data: { code: "invalid_schedule", problems: ["ends_at must be after starts_at"] } };
    expect(refusalProblems(error)).toEqual(["ends_at must be after starts_at"]);
    expect(describeTicketGroupError(error)).toContain("ends_at must be after starts_at");
    expect(describeTicketGroupError({ status: 409, data: { code: "stale_version" } })).toContain("reloaded");
    expect(describeTicketGroupError({ status: 404, data: { code: "not_found" } })).toContain("gone");
  });

  it("names the two kinds and the four statuses, and falls back on one it has never heard of", () => {
    expect(ticketGroupKindLabel("change_window")).toBe("Change window");
    expect(ticketGroupStatusLabel("cancelled")).toBe("Cancelled");
    expect(ticketGroupKindLabel("something_new")).toBe("something new");
  });
});

describe("validateTicketGroup", () => {
  it("takes a well-formed change window", () => {
    expect(validateTicketGroup(aGroupDraft())).toEqual([]);
  });

  it("refuses a change window without both ends, which the API answers as invalid_schedule", () => {
    expect(validateTicketGroup(aGroupDraft({ endsAt: "" }))).toEqual([CHANGE_WINDOW_ENDS_REQUIRED]);
    // A project has no window rules, so it needs no dates at all.
    expect(validateTicketGroup(aGroupDraft({ kind: "project", startsAt: "", endsAt: "" }))).toEqual([]);
  });

  it("refuses an end before the start, a nameless group and one under no account", () => {
    expect(validateTicketGroup(aGroupDraft({ endsAt: "2026-10-03T17:00" }))).toEqual([ENDS_AFTER_STARTS]);
    expect(validateTicketGroup(aGroupDraft({ name: " ", accountId: "" }))).toEqual([
      GROUP_NAME_REQUIRED,
      GROUP_ACCOUNT_REQUIRED,
    ]);
  });
});

/**
 * The freezes on a window (TM-18): the API's own rule is that a freeze with
 * no end, or an end before its start, is not a rule anyone can apply, and it
 * stores the whole set on the window.
 */
describe("the freezes on a window", () => {
  it("refuses a half-written freeze and one that ends before it starts", () => {
    expect(
      validateTicketGroup(aGroupDraft({ freezes: [{ startsAt: "2026-10-03T20:00", endsAt: "", reason: "" }] })),
    ).toEqual([FREEZE_ENDS_REQUIRED]);
    expect(
      validateTicketGroup(
        aGroupDraft({ freezes: [{ startsAt: "2026-10-03T21:00", endsAt: "2026-10-03T20:00", reason: "" }] }),
      ),
    ).toEqual([FREEZE_ENDS_AFTER_STARTS]);
  });

  it("sends the whole set as instants, and a blank reason as no reason at all", () => {
    const sent = toFreezeWindows([
      { startsAt: "2026-10-03T20:00", endsAt: "2026-10-03T21:00", reason: " Month-end close " },
      { startsAt: "2026-10-03T22:00", endsAt: "2026-10-03T23:00", reason: "  " },
      // A row nobody finished writing is not a freeze and is not sent.
      { startsAt: "", endsAt: "2026-10-04T01:00", reason: "" },
    ]);
    expect(sent).toHaveLength(2);
    expect(sent[0].reason).toBe("Month-end close");
    expect(sent[1].reason).toBeUndefined();
    expect(sent[0].starts_at).toMatch(/Z$/);
  });

  it("round-trips the stored set back into the form", () => {
    const drafts = toFreezeDrafts([{ starts_at: "2026-10-03T20:00:00Z", ends_at: "2026-10-03T21:00:00Z" }]);
    expect(drafts[0].reason).toBe("");
    expect(toFreezeWindows(drafts)[0].starts_at).toBe("2026-10-03T20:00:00.000Z");
    expect(toFreezeDrafts(undefined)).toEqual([]);
  });
});

describe("the datetime the form holds and the instant the API takes", () => {
  it("round-trips a local value through the instant it is sent as", () => {
    const local = "2026-10-03T18:00";
    const instant = toInstant(local);
    expect(instant).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(toLocalInput(instant)).toBe(local);
  });

  it("treats an empty or unreadable value as no date rather than as an invalid one", () => {
    expect(toInstant("")).toBeNull();
    expect(toInstant("not a date")).toBeNull();
    expect(toLocalInput(null)).toBe("");
    expect(toLocalInput("not a date")).toBe("");
  });
});

describe("the routing defaults", () => {
  it("sends a blank category as null, which is the rule for the type as a whole", () => {
    expect(toRoutingRuleInputs([aRuleDraft(), aRuleDraft({ category: " consolidation " })])).toEqual([
      { ticket_type: "incident", category: null, group_id: "g-1" },
      { ticket_type: "incident", category: "consolidation", group_id: "g-1" },
    ]);
  });

  it("refuses a rule with no group and two rules covering the same type and category", () => {
    expect(validateRoutingRules([aRuleDraft({ groupId: "" })])).toEqual([RULE_GROUP_REQUIRED]);
    expect(validateRoutingRules([aRuleDraft(), aRuleDraft({ category: "" })])).toEqual([RULE_DUPLICATE]);
    expect(validateRoutingRules([aRuleDraft(), aRuleDraft({ ticketType: "change" })])).toEqual([]);
  });
});

describe("scheduleMoved", () => {
  const before = { starts_at: "2026-10-01T18:00:00Z", ends_at: "2026-10-02T02:00:00Z", freeze_windows: [] };

  it("is false where only the name changed, so a rename is not a schedule change", () => {
    expect(scheduleMoved(before, { startsAt: before.starts_at, endsAt: before.ends_at, freezes: [] })).toBe(false);
  });

  it("is true where an end moved", () => {
    expect(scheduleMoved(before, { startsAt: before.starts_at, endsAt: "2026-10-02T06:00:00Z", freezes: [] })).toBe(
      true,
    );
  });

  it("is true where a freeze was added or removed", () => {
    const freeze = { starts_at: "2026-10-01T20:00:00Z", ends_at: "2026-10-01T21:00:00Z", reason: "close" };
    expect(scheduleMoved(before, { startsAt: before.starts_at, endsAt: before.ends_at, freezes: [freeze] })).toBe(true);
    expect(
      scheduleMoved(
        { ...before, freeze_windows: [freeze] },
        {
          startsAt: before.starts_at,
          endsAt: before.ends_at,
          freezes: [],
        },
      ),
    ).toBe(true);
  });

  it("treats a missing freeze list as an empty one", () => {
    expect(scheduleMoved({ starts_at: null, ends_at: null }, { startsAt: null, endsAt: null, freezes: [] })).toBe(
      false,
    );
  });
});

describe("the reason a change window moved", () => {
  const editing = { starts_at: "2026-10-01T18:00:00Z", ends_at: "2026-10-02T02:00:00Z", freeze_windows: [] };

  it("is asked for once the schedule has moved", () => {
    const draft = aGroupDraft({ kind: "change_window", startsAt: "2026-10-01T18:00", endsAt: "2026-10-02T06:00" });
    expect(validateTicketGroup(draft, editing)).toContain(CHANGE_WINDOW_REASON_REQUIRED);
    expect(validateTicketGroup({ ...draft, changeWindowReason: "Client moved the cutover" }, editing)).toEqual([]);
  });

  it("is not asked for on a rename, because the schedule did not move", () => {
    const draft = aGroupDraft({
      kind: "change_window",
      name: "October cutover, renamed",
      startsAt: toLocalInput(editing.starts_at),
      endsAt: toLocalInput(editing.ends_at),
    });
    expect(validateTicketGroup(draft, editing)).toEqual([]);
  });

  it("is not asked for on a project, which has no deploy gate behind it", () => {
    const draft = aGroupDraft({ kind: "project", startsAt: "2026-10-01T18:00", endsAt: "2026-12-02T06:00" });
    expect(validateTicketGroup(draft, editing)).not.toContain(CHANGE_WINDOW_REASON_REQUIRED);
  });

  it("is not asked for on a new group, which has nothing to have moved from", () => {
    const draft = aGroupDraft({ kind: "change_window", startsAt: "2026-10-01T18:00", endsAt: "2026-10-02T06:00" });
    expect(validateTicketGroup(draft)).toEqual([]);
  });
});
