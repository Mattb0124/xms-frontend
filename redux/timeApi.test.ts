import { afterEach, describe, expect, it, vi } from "vitest";
import { makeStore } from "@/redux/store";
import { timeApi, type CompTimeReport, type ContractPosition, type TimeEntry } from "@/redux/timeApi";
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
    performed_start: null,
    after_hours: false,
    after_hours_class: "standard",
    rate_multiplier: "1.000",
    created_at: "2026-09-07T10:00:00Z",
    ...overrides,
  };
}

/** An entry the calendar classed after hours with the contract's premium applied (TB-13). */
export function anAfterHoursEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return anEntry({
    id: "e-ah",
    performed_start: "19:30:00",
    after_hours: true,
    after_hours_class: "after_hours",
    rate_multiplier: "1.500",
    ...overrides,
  });
}

export function aCompTimeReport(overrides: Partial<CompTimeReport> = {}): CompTimeReport {
  const entries = [
    anAfterHoursEntry({ id: "ct-1", person_id: "p-1", rate_multiplier: "1.000", minutes: 90 }),
    anAfterHoursEntry({
      id: "ct-2",
      person_id: "p-1",
      rate_multiplier: "1.000",
      minutes: 30,
      after_hours_class: "weekend",
    }),
    anAfterHoursEntry({
      id: "ct-3",
      person_id: "p-2",
      person_name: "Dev Patel",
      rate_multiplier: "1.000",
      minutes: 60,
    }),
  ];
  return {
    from: "2026-08-08",
    to: "2026-09-07",
    entries,
    total_minutes: 180,
    by_person: [
      { person_id: "p-1", person_name: "Cara Lee", minutes: 120, entries: 2 },
      { person_id: "p-2", person_name: "Dev Patel", minutes: 60, entries: 1 },
    ],
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
      "GET /v1/timesheets/me/unlogged": () =>
        json({ from: "2026-09-07", to: "2026-09-07", days: [], unlogged_minutes: 0 }),
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

/** The after-hours cut (TB-13): the start time travels as performed_start; the comp-time report reads by account and range. */
describe("timeApi after hours", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts performed_start as HH:MM and reads the entry's class and multiplier back", async () => {
    const calls = stubFetch({
      "POST /v1/tickets/CS0001001/time": () => json(anAfterHoursEntry(), 201),
    });
    const store = makeStore();
    const entry = await store
      .dispatch(
        timeApi.endpoints.logTicketTime.initiate({
          ticketKey: "CS0001001",
          body: { performed_on: "2026-09-07", minutes: 45, activity_type: "analysis", performed_start: "19:30" },
        }),
      )
      .unwrap();
    expect(calls[0].body).toEqual({
      performed_on: "2026-09-07",
      minutes: 45,
      activity_type: "analysis",
      performed_start: "19:30",
    });
    expect(entry.after_hours_class).toBe("after_hours");
    expect(entry.rate_multiplier).toBe("1.500");
    expect(entry.after_hours).toBe(true);
  });

  it("reads the comp-time report with the range as query parameters and refreshes it after time is logged", async () => {
    let reads = 0;
    stubFetch({
      "GET /v1/accounts/acct-1/time/comp-time": () => {
        reads += 1;
        return json(aCompTimeReport());
      },
      "POST /v1/accounts/acct-1/buckets/b-1/time": () => json(anEntry(), 201),
    });
    const store = makeStore();
    const subscription = store.dispatch(
      timeApi.endpoints.compTime.initiate({ accountId: "acct-1", from: "2026-08-08", to: "2026-09-07" }),
    );
    const report = await subscription.unwrap();
    expect(report.total_minutes).toBe(180);
    expect(report.by_person.map((row) => row.person_name)).toEqual(["Cara Lee", "Dev Patel"]);
    await store
      .dispatch(
        timeApi.endpoints.logBucketTime.initiate({
          accountId: "acct-1",
          bucketId: "b-1",
          body: { performed_on: "2026-09-07", minutes: 30, activity_type: "analysis" },
        }),
      )
      .unwrap();
    await vi.waitFor(() => expect(reads).toBe(2));
    subscription.unsubscribe();
  });

  it("sends the range on the comp-time route", async () => {
    const calls = stubFetch({ "GET /v1/accounts/acct-1/time/comp-time": () => json(aCompTimeReport()) });
    const store = makeStore();
    await store
      .dispatch(timeApi.endpoints.compTime.initiate({ accountId: "acct-1", from: "2026-08-08", to: "2026-09-07" }))
      .unwrap();
    expect(`${calls[0].key}${calls[0].search}`).toBe(
      "GET /v1/accounts/acct-1/time/comp-time?from=2026-08-08&to=2026-09-07",
    );
  });
});
