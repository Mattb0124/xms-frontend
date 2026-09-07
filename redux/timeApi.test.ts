import { afterEach, describe, expect, it, vi } from "vitest";
import { makeStore } from "@/redux/store";
import { timeApi, type ContractPosition, type TimeEntry } from "@/redux/timeApi";
import { json, stubFetch } from "@/test-kit/portal";

export function anEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: "e-1",
    ticket_id: "t-1",
    person_name: "Cara Lee",
    performed_on: "2026-09-07",
    minutes: 45,
    adjusted_minutes: 45,
    activity_type: "analysis",
    billable_class: "billable",
    description: "Traced the failing job",
    after_hours: false,
    created_at: "2026-09-07T10:00:00Z",
    ...overrides,
  };
}

export function aPosition(overrides: Partial<ContractPosition> = {}): ContractPosition {
  return {
    contract: { id: "c-1", key: "CT10001", name: "Support retainer", model: "retainer" },
    period: { starts_on: "2026-09-01", ends_on: "2026-09-30", days_total: 30, days_elapsed: 7 },
    contracted_minutes: 2400,
    carried_over_minutes: 0,
    available_minutes: 2400,
    consumed_minutes: 600,
    non_consuming_minutes: 30,
    remaining_minutes: 1800,
    percent_consumed: 25,
    percent_elapsed: 23.3,
    projected_minutes: 2571,
    status: "on_track",
    by_class: { billable: 600 },
    by_activity: { analysis: 600 },
    ...overrides,
  };
}

/** The time slice sends the request shapes the time contract expects. */
describe("timeApi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads ticket time, my timesheet and the contract position", async () => {
    const calls = stubFetch({
      "GET /v1/tickets/CS0001001/time": () => json({ entries: [anEntry()], total_minutes: 45 }),
      "GET /v1/time/mine": () => json([anEntry({ ticket_number: "1000001" })]),
      "GET /v1/accounts/acct-1/contracts/c-1/position": () => json(aPosition()),
    });
    const store = makeStore();
    const time = await store.dispatch(timeApi.endpoints.ticketTime.initiate("CS0001001")).unwrap();
    expect(time.total_minutes).toBe(45);
    await store.dispatch(timeApi.endpoints.myTime.initiate({ from: "2026-09-07", to: "2026-09-13" })).unwrap();
    const position = await store
      .dispatch(timeApi.endpoints.contractPosition.initiate({ accountId: "acct-1", contractId: "c-1" }))
      .unwrap();
    expect(position.status).toBe("on_track");
    expect(calls.map((call) => `${call.key}${call.search}`)).toEqual([
      "GET /v1/tickets/CS0001001/time",
      "GET /v1/time/mine?from=2026-09-07&to=2026-09-13",
      "GET /v1/accounts/acct-1/contracts/c-1/position",
    ]);
  });

  it("posts an entry and an adjustment with the exact bodies", async () => {
    const calls = stubFetch({
      "POST /v1/tickets/CS0001001/time": () => json(anEntry(), 201),
      "POST /v1/time/adjustments": () => json({ id: "adj-1" }, 201),
    });
    const store = makeStore();
    await store
      .dispatch(
        timeApi.endpoints.logTicketTime.initiate({
          ticketKey: "CS0001001",
          body: {
            performed_on: "2026-09-07",
            minutes: 45,
            activity_type: "analysis",
            billable_class: "billable",
            description: "x",
          },
        }),
      )
      .unwrap();
    await store
      .dispatch(
        timeApi.endpoints.adjustTime.initiate({
          entry_id: "e-1",
          delta_minutes: -15,
          kind: "correction",
          reason: "Too much",
        }),
      )
      .unwrap();
    expect(calls.map((call) => call.body)).toEqual([
      {
        performed_on: "2026-09-07",
        minutes: 45,
        activity_type: "analysis",
        billable_class: "billable",
        description: "x",
      },
      { entry_id: "e-1", delta_minutes: -15, kind: "correction", reason: "Too much" },
    ]);
  });
});

/** The week and unlogged routes (P2.18.3) carry the week or the date range as query parameters. */
describe("timeApi timesheets", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads my week by week key or date and the unlogged summary by range", async () => {
    const week = {
      from: "2026-09-07",
      to: "2026-09-13",
      days: [],
      total_minutes: 0,
      unlogged_minutes: 0,
    };
    const calls = stubFetch({
      "GET /v1/timesheets/me": () => json(week),
      "GET /v1/timesheets/me/unlogged": () => json({ from: "2026-09-07", to: "2026-09-07", days: [], unlogged_minutes: 0 }),
    });
    const store = makeStore();
    await store.dispatch(timeApi.endpoints.myWeek.initiate()).unwrap();
    await store.dispatch(timeApi.endpoints.myWeek.initiate({ week: "2026-W37" })).unwrap();
    await store.dispatch(timeApi.endpoints.myWeek.initiate({ week: "2026-09-10" })).unwrap();
    await store.dispatch(timeApi.endpoints.myUnlogged.initiate({ from: "2026-09-07", to: "2026-09-07" })).unwrap();
    expect(calls.map((call) => `${call.key}${call.search}`)).toEqual([
      "GET /v1/timesheets/me",
      "GET /v1/timesheets/me?week=2026-W37",
      "GET /v1/timesheets/me?week=2026-09-10",
      "GET /v1/timesheets/me/unlogged?from=2026-09-07&to=2026-09-07",
    ]);
  });

  it("refreshes the week after time is logged", async () => {
    let weeks = 0;
    stubFetch({
      "GET /v1/timesheets/me": () => {
        weeks += 1;
        return json({ from: "2026-09-07", to: "2026-09-13", days: [], total_minutes: 0, unlogged_minutes: 0 });
      },
      "POST /v1/tickets/CS0001001/time": () => json(anEntry(), 201),
    });
    const store = makeStore();
    const subscription = store.dispatch(timeApi.endpoints.myWeek.initiate({ week: "2026-09-07" }));
    await subscription.unwrap();
    await store
      .dispatch(
        timeApi.endpoints.logTicketTime.initiate({
          ticketKey: "CS0001001",
          body: { performed_on: "2026-09-07", minutes: 30, activity_type: "analysis" },
        }),
      )
      .unwrap();
    await vi.waitFor(() => expect(weeks).toBe(2));
    subscription.unsubscribe();
  });
});
