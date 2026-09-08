import { afterEach, describe, expect, it, vi } from "vitest";
import { makeStore } from "@/redux/store";
import {
  ticketsApi,
  type ChangeCalendarWindow,
  type Contract,
  type Engagement,
  type FreezeWindow,
  type RoutingRule,
  type TicketGroup,
  type TicketScope,
  type TicketView,
  type WindowAt,
} from "@/redux/ticketsApi";
import { json, stubFetch } from "@/test-kit/portal";
import { aSavedView, SAVED_VIEW_ID } from "@/test-kit/views";

export const ACCOUNT_ID = "77777777-7777-4777-8777-777777777777";
export const CONTRACT_ID = "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1";

/** A constructed contract row: a retainer with no after-hours handling and the column-default budget rules. */
export function aContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: CONTRACT_ID,
    key: "CT10001",
    name: "Support retainer",
    model: "retainer",
    status: "active",
    currency: "USD",
    engagement_id: null,
    after_hours_handling: "none",
    after_hours_multiplier: null,
    threshold_percents: [50, 75, 90, 100],
    threshold_notify_client: false,
    overage_rule: "allow_flag",
    overage_multiplier: null,
    rollover_rule: "none",
    rollover_cap_hours: null,
    forecast_window_days: 10,
    technology_codes: [],
    version: 1,
    ...overrides,
  };
}

export const ENGAGEMENT_ID = "e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1";
export const OWNER_USER_ID = "0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a";

/**
 * A constructed engagement: active, a renewal a year out, a month of notice
 * and no alert fired yet. Nothing here is copied from a live account.
 */
export function anEngagement(overrides: Partial<Engagement> = {}): Engagement {
  return {
    id: ENGAGEMENT_ID,
    account_id: ACCOUNT_ID,
    name: "Managed services 2026",
    owner_user_id: OWNER_USER_ID,
    renewal_date: "2027-03-31",
    notice_period_days: 30,
    status: "active",
    renewal_alerts_fired: [],
    created_at: "2026-04-01T09:00:00.000Z",
    updated_at: "2026-04-01T09:00:00.000Z",
    version: 1,
    ...overrides,
  };
}

/** The same engagement inside the widest lead window, with two alerts already sent. */
export function anExpiringEngagement(overrides: Partial<Engagement> = {}): Engagement {
  return anEngagement({
    id: "e2e2e2e2-e2e2-4e2e-8e2e-e2e2e2e2e2e2",
    name: "Hosting renewal",
    renewal_date: "2026-10-01",
    status: "expiring",
    renewal_alerts_fired: [90, 60],
    version: 4,
    ...overrides,
  });
}

export const TICKET_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const FLAGGER_ID = "u-cara";
export const APPROVER_ID = "u-dana";

/** A ticket nobody has flagged: the four fields present, everything else null. */
export function aScope(overrides: Partial<TicketScope> = {}): TicketScope {
  return {
    out_of_scope: "none",
    reason: null,
    flagged_by: null,
    flagged_by_name: null,
    flagged_at: null,
    decision: null,
    note: null,
    decided_by: null,
    decided_by_name: null,
    decided_at: null,
    overage_allowance_minutes: null,
    ...overrides,
  };
}

/** A flag Cara raised and nobody has decided (TM-11). */
export function aFlaggedScope(overrides: Partial<TicketScope> = {}): TicketScope {
  return aScope({
    out_of_scope: "flagged",
    reason: "A new hierarchy is a project, not support.",
    flagged_by: FLAGGER_ID,
    flagged_by_name: "Cara Lee",
    flagged_at: "2026-09-06T11:00:00Z",
    ...overrides,
  });
}

/** The same flag, approved by someone else with eight hours of extra budget. */
export function anApprovedScope(overrides: Partial<TicketScope> = {}): TicketScope {
  return aFlaggedScope({
    out_of_scope: "approved",
    decision: "approve",
    note: "Agreed with the client.",
    decided_by: APPROVER_ID,
    decided_by_name: "Dana Reid",
    decided_at: "2026-09-07T08:30:00Z",
    overage_allowance_minutes: 480,
    ...overrides,
  });
}

/** A constructed ticket record: an open incident on the retainer, assigned, with both clocks running. */
export function aTicketView(overrides: Partial<TicketView> = {}): TicketView {
  return {
    id: TICKET_ID,
    key: "CS1000199",
    account_id: ACCOUNT_ID,
    type: "incident",
    state: "in_progress",
    state_label: "In progress",
    short_description: "HFM consolidation fails on the September close",
    description: null,
    category: null,
    impact: "high",
    urgency: "high",
    priority: "p2",
    priority_overridden: false,
    source: "portal",
    requester: { id: "u-pat", email: "pat.client@example.test", display_name: "Pat Client" },
    group_id: null,
    assignee_id: "u-ben",
    assignee_name: "Ben Okafor",
    contract_id: CONTRACT_ID,
    resolution: {
      code: null,
      notes: null,
      solution_article_id: null,
      solution_candidate: false,
      time_exemption_reason: null,
    },
    scope: aScope(),
    external_refs: {},
    reopen_count: 0,
    first_response_at: null,
    resolved_at: null,
    closed_at: null,
    cancelled_at: null,
    sla: {},
    created_by: "u-pat",
    created_by_name: "Pat Client",
    created_at: "2026-08-25T09:00:00Z",
    updated_at: "2026-08-25T10:00:00Z",
    version: 3,
    ...overrides,
  };
}

export function aPremiumContract(overrides: Partial<Contract> = {}): Contract {
  return aContract({ after_hours_handling: "premium_rate", after_hours_multiplier: "1.500", ...overrides });
}

export function aCompTimeContract(overrides: Partial<Contract> = {}): Contract {
  return aContract({ after_hours_handling: "comp_time", after_hours_multiplier: null, ...overrides });
}

/** The contracts routes on the tickets slice (TB-13): list under tickets:view, PATCH the handling with the version. */
describe("ticketsApi contracts", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists the account's contracts with their after-hours handling", async () => {
    const calls = stubFetch({
      [`GET /v1/accounts/${ACCOUNT_ID}/contracts`]: () =>
        json([aContract(), aPremiumContract({ id: "c-2", key: "CT10002" })]),
    });
    const store = makeStore();
    const rows = await store.dispatch(ticketsApi.endpoints.listAccountContracts.initiate(ACCOUNT_ID)).unwrap();
    expect(calls.map((call) => call.key)).toEqual([`GET /v1/accounts/${ACCOUNT_ID}/contracts`]);
    expect(rows.map((row) => [row.after_hours_handling, row.after_hours_multiplier])).toEqual([
      ["none", null],
      ["premium_rate", "1.500"],
    ]);
  });

  it("patches the handling and the required technologies with the version and refreshes the list", async () => {
    let reads = 0;
    const calls = stubFetch({
      [`GET /v1/accounts/${ACCOUNT_ID}/contracts`]: () => {
        reads += 1;
        return json([reads > 1 ? aPremiumContract({ version: 2, technology_codes: ["onestream"] }) : aContract()]);
      },
      [`PATCH /v1/accounts/${ACCOUNT_ID}/contracts/${CONTRACT_ID}`]: () =>
        json(aPremiumContract({ version: 2, technology_codes: ["onestream"] })),
    });
    const store = makeStore();
    const subscription = store.dispatch(ticketsApi.endpoints.listAccountContracts.initiate(ACCOUNT_ID));
    await subscription.unwrap();
    const updated = await store
      .dispatch(
        ticketsApi.endpoints.patchContract.initiate({
          accountId: ACCOUNT_ID,
          contractId: CONTRACT_ID,
          body: {
            version: 1,
            after_hours_handling: "premium_rate",
            after_hours_multiplier: 1.5,
            technology_codes: ["onestream"],
          },
        }),
      )
      .unwrap();
    expect(calls.find((call) => call.key.startsWith("PATCH "))?.body).toEqual({
      version: 1,
      after_hours_handling: "premium_rate",
      after_hours_multiplier: 1.5,
      technology_codes: ["onestream"],
    });
    expect(updated.version).toBe(2);
    expect(updated.technology_codes).toEqual(["onestream"]);

    await vi.waitFor(() => expect(reads).toBe(2));
    subscription.unsubscribe();
  });

  it("surfaces multiplier_required and the stale version as typed errors", async () => {
    let attempt = 0;
    stubFetch({
      [`PATCH /v1/accounts/${ACCOUNT_ID}/contracts/${CONTRACT_ID}`]: () => {
        attempt += 1;
        return attempt === 1
          ? json({ code: "multiplier_required", handling: "premium_rate" }, 400)
          : json({ code: "stale_version" }, 409);
      },
    });
    const store = makeStore();
    const patch = (version: number) =>
      store
        .dispatch(
          ticketsApi.endpoints.patchContract.initiate({
            accountId: ACCOUNT_ID,
            contractId: CONTRACT_ID,
            body: { version, after_hours_handling: "premium_rate" },
          }),
        )
        .unwrap();
    await expect(patch(1)).rejects.toMatchObject({ status: 400, data: { code: "multiplier_required" } });
    await expect(patch(1)).rejects.toMatchObject({ status: 409, data: { code: "stale_version" } });
  });
});

export const GROUP_ID = "99999999-9999-4999-8999-999999999999";
export const TICKET_GROUP_ID = "88888888-8888-4888-8888-888888888888";

/** A constructed change window: October's release window with one freeze inside it (TM-10, TM-18). */
export function aTicketGroup(overrides: Partial<TicketGroup> = {}): TicketGroup {
  return {
    id: TICKET_GROUP_ID,
    account_id: ACCOUNT_ID,
    kind: "change_window",
    name: "October release window",
    description: "The monthly consolidation release",
    owner_user_id: "u-ben",
    starts_at: "2026-10-03T18:00:00Z",
    ends_at: "2026-10-04T02:00:00Z",
    freeze_windows: [aFreeze()],
    status: "planned",
    created_at: "2026-09-01T09:00:00Z",
    updated_at: "2026-09-01T09:00:00Z",
    version: 1,
    ...overrides,
  };
}

/** A constructed freeze: the hour inside the window during which nothing may be scheduled. */
export function aFreeze(overrides: Partial<FreezeWindow> = {}): FreezeWindow {
  return {
    starts_at: "2026-10-03T20:00:00Z",
    ends_at: "2026-10-03T21:00:00Z",
    reason: "Month-end close",
    ...overrides,
  };
}

/** A constructed project: a container with no schedule, so no window rule applies to it. */
export function aProjectGroup(overrides: Partial<TicketGroup> = {}): TicketGroup {
  return aTicketGroup({
    id: "88888888-8888-4888-8888-888888888889",
    kind: "project",
    name: "Cutover programme",
    starts_at: null,
    ends_at: null,
    freeze_windows: [],
    status: "active",
    ...overrides,
  });
}

/** A constructed routing default: every incident goes to one group unless a category rule is more specific. */
export function aRoutingRule(overrides: Partial<RoutingRule> = {}): RoutingRule {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    account_id: ACCOUNT_ID,
    ticket_type: "incident",
    category: null,
    group_id: GROUP_ID,
    group_name: "Application support",
    created_at: "2026-09-01T09:00:00Z",
    updated_at: "2026-09-01T09:00:00Z",
    version: 1,
    ...overrides,
  };
}

/**
 * The group queue and the routing defaults (TM-08), and the catalog of
 * projects and change windows (TM-10), on the tickets slice.
 */
describe("ticketsApi groups", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("asks the list route for the group queue and for one group by id", async () => {
    const calls = stubFetch({
      "GET /v1/tickets": () =>
        json({ items: [aTicketView({ group_id: GROUP_ID })], next_cursor: null, stats: { open: 1 } }),
    });
    const store = makeStore();
    await store.dispatch(ticketsApi.endpoints.listTickets.initiate({ open: true, my_groups: true })).unwrap();
    await store.dispatch(ticketsApi.endpoints.listTickets.initiate({ open: true, group_id: GROUP_ID })).unwrap();
    expect(calls.map((call) => call.search)).toEqual(["?open=true&my_groups=true", `?open=true&group_id=${GROUP_ID}`]);
  });

  it("replaces the whole routing set with one PUT and reads the set again", async () => {
    let reads = 0;
    const calls = stubFetch({
      [`GET /v1/accounts/${ACCOUNT_ID}/routing-rules`]: () => {
        reads += 1;
        return json(reads > 1 ? [aRoutingRule({ category: "consolidation" })] : [aRoutingRule()]);
      },
      [`PUT /v1/accounts/${ACCOUNT_ID}/routing-rules`]: () => json([aRoutingRule({ category: "consolidation" })]),
    });
    const store = makeStore();
    const subscription = store.dispatch(ticketsApi.endpoints.listRoutingRules.initiate(ACCOUNT_ID));
    expect((await subscription.unwrap())[0].category).toBeNull();
    const saved = await store
      .dispatch(
        ticketsApi.endpoints.replaceRoutingRules.initiate({
          accountId: ACCOUNT_ID,
          rules: [{ ticket_type: "incident", category: "consolidation", group_id: GROUP_ID }],
        }),
      )
      .unwrap();
    expect(saved[0].category).toBe("consolidation");
    expect(calls.find((call) => call.key.startsWith("PUT "))?.body).toEqual({
      rules: [{ ticket_type: "incident", category: "consolidation", group_id: GROUP_ID }],
    });
    await vi.waitFor(() => expect(reads).toBe(2));
    subscription.unsubscribe();
  });

  it("leaves the routing set alone when the API refuses it, because nothing was written", async () => {
    let reads = 0;
    stubFetch({
      [`GET /v1/accounts/${ACCOUNT_ID}/routing-rules`]: () => {
        reads += 1;
        return json([aRoutingRule()]);
      },
      [`PUT /v1/accounts/${ACCOUNT_ID}/routing-rules`]: () => json({ code: "validation_failed" }, 400),
    });
    const store = makeStore();
    const subscription = store.dispatch(ticketsApi.endpoints.listRoutingRules.initiate(ACCOUNT_ID));
    await subscription.unwrap();
    await expect(
      store
        .dispatch(
          ticketsApi.endpoints.replaceRoutingRules.initiate({
            accountId: ACCOUNT_ID,
            rules: [{ ticket_type: "incident", category: null, group_id: GROUP_ID }],
          }),
        )
        .unwrap(),
    ).rejects.toMatchObject({ status: 400, data: { code: "validation_failed" } });
    expect(reads).toBe(1);
    subscription.unsubscribe();
  });

  it("filters the group catalog on the parameters the API declares", async () => {
    const calls = stubFetch({ "GET /v1/ticket-groups": () => json([aTicketGroup(), aProjectGroup()]) });
    const store = makeStore();
    const groups = await store
      .dispatch(ticketsApi.endpoints.listTicketGroups.initiate({ account_id: ACCOUNT_ID, kind: "change_window" }))
      .unwrap();
    expect(groups.map((group) => group.kind)).toEqual(["change_window", "project"]);
    expect(calls[0].search).toBe(`?account_id=${ACCOUNT_ID}&kind=change_window`);
  });

  it("creates a group, and reads the list again even when a patch is refused", async () => {
    let reads = 0;
    const calls = stubFetch({
      "GET /v1/ticket-groups": () => {
        reads += 1;
        return json([aTicketGroup()]);
      },
      "POST /v1/ticket-groups": () => json(aTicketGroup(), 201),
      [`PATCH /v1/ticket-groups/${TICKET_GROUP_ID}`]: () => json({ code: "stale_version" }, 409),
    });
    const store = makeStore();
    const subscription = store.dispatch(ticketsApi.endpoints.listTicketGroups.initiate());
    await subscription.unwrap();
    const created = await store
      .dispatch(
        ticketsApi.endpoints.createTicketGroup.initiate({
          account_id: ACCOUNT_ID,
          kind: "change_window",
          name: "October release window",
          starts_at: "2026-10-03T18:00:00Z",
          ends_at: "2026-10-04T02:00:00Z",
        }),
      )
      .unwrap();
    expect(created.name).toBe("October release window");
    expect(calls.find((call) => call.key === "POST /v1/ticket-groups")?.body).toMatchObject({
      kind: "change_window",
      starts_at: "2026-10-03T18:00:00Z",
    });
    await vi.waitFor(() => expect(reads).toBe(2));
    // A stale version means this screen is behind, so the list is read again
    // even though nothing was written.
    await expect(
      store
        .dispatch(
          ticketsApi.endpoints.patchTicketGroup.initiate({ id: TICKET_GROUP_ID, body: { version: 1, name: "Moved" } }),
        )
        .unwrap(),
    ).rejects.toMatchObject({ status: 409, data: { code: "stale_version" } });
    await vi.waitFor(() => expect(reads).toBe(3));
    subscription.unsubscribe();
  });

  it("sends share_ref with a group share and clears it on a move away", async () => {
    const calls = stubFetch({
      "POST /v1/views": () => json(aSavedView({ share: "group", share_ref: GROUP_ID }), 201),
      [`PATCH /v1/views/${SAVED_VIEW_ID}`]: () => json(aSavedView({ share: "private", share_ref: null, version: 2 })),
    });
    const store = makeStore();
    const view = await store
      .dispatch(
        ticketsApi.endpoints.createSavedView.initiate({
          account_id: ACCOUNT_ID,
          name: "My groups, breached",
          definition: { conditions: { conditions: [{ field: "group_id", op: "is_mine" }], match: "all" } },
          share: "group",
          share_ref: GROUP_ID,
        }),
      )
      .unwrap();
    expect(view.share_ref).toBe(GROUP_ID);
    const moved = await store
      .dispatch(
        ticketsApi.endpoints.patchSavedView.initiate({
          id: SAVED_VIEW_ID,
          body: { version: 1, share: "private", share_ref: null },
        }),
      )
      .unwrap();
    expect(moved.share_ref).toBeNull();
    expect(calls[0].body).toMatchObject({ share: "group", share_ref: GROUP_ID });
    expect(calls[1].body).toMatchObject({ share: "private", share_ref: null });
  });
});

/**
 * A constructed calendar window (TM-18): October's release window with one
 * freeze inside it and one change planned in it. The calendar answers a
 * window with both ends and never a cancelled one, so the fixture has both.
 */
export function aChangeWindow(overrides: Partial<ChangeCalendarWindow> = {}): ChangeCalendarWindow {
  return {
    id: TICKET_GROUP_ID,
    account_id: ACCOUNT_ID,
    name: "October release window",
    status: "planned",
    starts_at: "2026-10-03T18:00:00Z",
    ends_at: "2026-10-04T02:00:00Z",
    freeze_windows: [aFreeze()],
    tickets: [
      {
        id: "t-change",
        key: "CS1000420",
        type: "change",
        state: "scheduled",
        priority: "p3",
        short_description: "Deploy the consolidation hotfix",
      },
    ],
    ...overrides,
  };
}

/** The instant answer for an account inside an open window. */
export function anOpenWindowAt(overrides: Partial<WindowAt> = {}): WindowAt {
  return {
    at: "2026-10-03T19:00:00Z",
    inside: true,
    frozen: false,
    windows: [
      {
        id: TICKET_GROUP_ID,
        name: "October release window",
        status: "active",
        starts_at: "2026-10-03T18:00:00Z",
        ends_at: "2026-10-04T02:00:00Z",
        freeze: null,
      },
    ],
    ...overrides,
  };
}

/** The change calendar routes, both under tickets:view (TM-18). */
describe("ticketsApi change calendar", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("asks for the range, and for one account when one is chosen", async () => {
    const calls = stubFetch({
      "GET /v1/change-calendar": () =>
        json({ from: "2026-10-01T00:00:00.000Z", to: "2026-11-01T00:00:00.000Z", windows: [aChangeWindow()] }),
    });
    const store = makeStore();
    const calendar = await store
      .dispatch(
        ticketsApi.endpoints.changeCalendar.initiate({
          from: "2026-10-01T00:00:00.000Z",
          to: "2026-11-01T00:00:00.000Z",
        }),
      )
      .unwrap();
    expect(calendar.windows[0].tickets.map((ticket) => ticket.key)).toEqual(["CS1000420"]);
    expect(calendar.windows[0].freeze_windows[0].reason).toBe("Month-end close");
    await store
      .dispatch(
        ticketsApi.endpoints.changeCalendar.initiate({
          from: "2026-10-01T00:00:00.000Z",
          to: "2026-11-01T00:00:00.000Z",
          account_id: ACCOUNT_ID,
        }),
      )
      .unwrap();
    expect(calls.map((call) => call.search)).toEqual([
      "?from=2026-10-01T00%3A00%3A00.000Z&to=2026-11-01T00%3A00%3A00.000Z",
      `?from=2026-10-01T00%3A00%3A00.000Z&to=2026-11-01T00%3A00%3A00.000Z&account_id=${ACCOUNT_ID}`,
    ]);
  });

  it("asks whether an account is inside a window right now, and lets the window itself answer", async () => {
    const calls = stubFetch({ "GET /v1/change-calendar/at": () => json(anOpenWindowAt()) });
    const store = makeStore();
    const at = await store.dispatch(ticketsApi.endpoints.changeWindowAt.initiate({ account_id: ACCOUNT_ID })).unwrap();
    expect(at.inside).toBe(true);
    expect(at.frozen).toBe(false);
    expect(at.windows[0].freeze).toBeNull();
    expect(calls[0].search).toBe(`?account_id=${ACCOUNT_ID}`);
  });

  it("re-reads the calendar after a window is edited, because moving one moves the month", async () => {
    let reads = 0;
    stubFetch({
      "GET /v1/change-calendar": () => {
        reads += 1;
        return json({ from: "2026-10-01T00:00:00.000Z", to: "2026-11-01T00:00:00.000Z", windows: [aChangeWindow()] });
      },
      [`PATCH /v1/ticket-groups/${TICKET_GROUP_ID}`]: () => json(aTicketGroup({ version: 2 })),
    });
    const store = makeStore();
    const subscription = store.dispatch(
      ticketsApi.endpoints.changeCalendar.initiate({
        from: "2026-10-01T00:00:00.000Z",
        to: "2026-11-01T00:00:00.000Z",
      }),
    );
    await subscription.unwrap();
    await store
      .dispatch(
        ticketsApi.endpoints.patchTicketGroup.initiate({
          id: TICKET_GROUP_ID,
          body: { version: 1, freeze_windows: [] },
        }),
      )
      .unwrap();
    await vi.waitFor(() => expect(reads).toBe(2));
    subscription.unsubscribe();
  });
});
