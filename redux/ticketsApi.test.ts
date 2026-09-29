import { afterEach, describe, expect, it, vi } from "vitest";
import { makeStore } from "@/redux/store";
import { ticketsApi } from "@/redux/ticketsApi";
import { json, stubFetch } from "@/test-kit/portal";
import { aSavedView, SAVED_VIEW_ID } from "@/test-kit/views";
import {
  ACCOUNT_ID,
  aChangeWindow,
  aContract,
  anOpenWindowAt,
  aPremiumContract,
  aProjectGroup,
  aRoutingRule,
  aTicketGroup,
  aTicketView,
  CONTRACT_ID,
  GROUP_ID,
  TICKET_GROUP_ID,
} from "@/test-kit/tickets";

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
