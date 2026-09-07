import { afterEach, describe, expect, it, vi } from "vitest";
import { makeStore } from "@/redux/store";
import {
  billingExportPath,
  budgetEntriesParams,
  timeApi,
  type AccountBudget,
  type BillingExport,
  type BillingPeriod,
  type BudgetContractCard,
  type BudgetEntries,
  type BudgetForecast,
  type BudgetThresholds,
  type CompTimeReport,
  type ContractPosition,
  type RateCard,
  type ThresholdEvent,
  type TimeEntry,
} from "@/redux/timeApi";
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
    rate_snapshot: null,
    amount: null,
    over_budget: false,
    created_at: "2026-09-07T10:00:00Z",
    ...overrides,
  };
}

/** An entry logged under a rate card: the rate and the amount frozen on the row (TB-05). */
export function aRatedEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return anEntry({
    id: "e-rated",
    minutes: 90,
    adjusted_minutes: 90,
    rate_snapshot: "150.00",
    amount: "225.00",
    ...overrides,
  });
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

/** The forecast behind aPosition: 2 h per business day over the last 5, 17 business days left, so 110 percent at period end. */
export function aForecast(overrides: Partial<BudgetForecast> = {}): BudgetForecast {
  return {
    business_days_total: 22,
    business_days_elapsed: 5,
    window_days: 5,
    run_rate_minutes: 120,
    forecast_minutes: 2640,
    forecast_percent: 110,
    business_days_to_exhaustion: 15,
    ...overrides,
  };
}

export function aThresholdEvent(overrides: Partial<ThresholdEvent> = {}): ThresholdEvent {
  return {
    id: "te-1",
    contract_period_id: "p-1",
    percent: 50,
    consumed_minutes_at_fire: 1230,
    available_minutes: 2400,
    fired_at: "2026-09-04T15:00:00Z",
    ...overrides,
  };
}

/** The default thresholds with nothing fired yet: 50 percent is next, at 20 h of the 40 h. */
export function aThresholds(overrides: Partial<BudgetThresholds> = {}): BudgetThresholds {
  return {
    percents: [50, 75, 90, 100],
    fired: [],
    next_percent: 50,
    next_at_minutes: 1200,
    events: [],
    ...overrides,
  };
}

/** One contract on the budget view: aPosition's numbers, aForecast, the default thresholds, nothing unrated. */
export function aBudgetCard(overrides: Partial<BudgetContractCard> = {}): BudgetContractCard {
  const { contract: _contract, ...position } = aPosition();
  void _contract;
  return {
    contract: {
      id: "c-1",
      key: "CT10001",
      name: "Support retainer",
      model: "retainer",
      currency: "USD",
      overage_rule: "allow_flag",
      rollover_rule: "none",
      after_hours_handling: "none",
    },
    period: { id: "p-1", starts_on: "2026-09-01", ends_on: "2026-09-30", locked: false },
    position,
    forecast: aForecast(),
    thresholds: aThresholds(),
    unrated_minutes: 0,
    ...overrides,
  };
}

export function aBudget(overrides: Partial<AccountBudget> = {}): AccountBudget {
  return {
    account_id: "acct-1",
    as_of: "2026-09-07",
    calendar_id: "cal-1",
    contracts: [aBudgetCard()],
    ...overrides,
  };
}

/** The drill-through behind the card: two rated entries and one without a rate. */
export function aBudgetEntries(overrides: Partial<BudgetEntries> = {}): BudgetEntries {
  return {
    contractId: "c-1",
    from: "2026-09-01",
    to: "2026-09-30",
    entries: [
      {
        ...aRatedEntry({ id: "be-1", person_id: "p-1", performed_on: "2026-09-03" }),
        ticket_number: "1000001",
        bucket_label: null,
        contract_key: "CT10001",
      },
      {
        ...aRatedEntry({
          id: "be-2",
          person_id: "p-2",
          person_name: "Dev Patel",
          performed_on: "2026-09-04",
          minutes: 60,
          adjusted_minutes: 60,
          activity_type: "development",
          amount: "150.00",
        }),
        ticket_number: null,
        bucket_label: "Internal",
        contract_key: "CT10001",
      },
      {
        ...anEntry({ id: "be-3", person_id: "p-1", performed_on: "2026-09-05", minutes: 30, adjusted_minutes: 30 }),
        ticket_number: "1000002",
        bucket_label: null,
        contract_key: "CT10001",
      },
    ],
    total_minutes: 180,
    total_amount: 375,
    ...overrides,
  };
}

/** An account-default rate card version (contract_id null) with one consultant line. */
export function aRateCard(overrides: Partial<RateCard> = {}): RateCard {
  return {
    id: "rc-1",
    account_id: "acct-1",
    contract_id: null,
    effective_from: "2026-01-01",
    currency: "USD",
    note: "",
    created_by: "u1",
    created_at: "2026-01-01T09:00:00Z",
    entries: [{ role: "consultant", bill_rate: 150, overage_rate: 200 }],
    ...overrides,
  };
}

/** An open September billing period with nothing summarised yet. */
export function aBillingPeriod(overrides: Partial<BillingPeriod> = {}): BillingPeriod {
  return {
    id: "bp-1",
    account_id: "acct-1",
    starts_on: "2026-09-01",
    ends_on: "2026-09-30",
    status: "open",
    submitted_at: null,
    submitted_by: null,
    approved_at: null,
    approved_by: null,
    locked_at: null,
    locked_by: null,
    submitted_by_name: null,
    approved_by_name: null,
    locked_by_name: null,
    auto_lock_at: null,
    summary: null,
    checksum: null,
    version: 1,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

/** A locked August period with the summary the export must match: 3 entries, 2.25 h, 225.00, 30 min unrated. */
export function aLockedPeriod(overrides: Partial<BillingPeriod> = {}): BillingPeriod {
  return aBillingPeriod({
    id: "bp-0",
    starts_on: "2026-08-01",
    ends_on: "2026-08-31",
    status: "locked",
    submitted_at: "2026-09-01T09:00:00Z",
    submitted_by: "u1",
    approved_at: "2026-09-02T09:00:00Z",
    approved_by: "u2",
    locked_at: "2026-09-03T09:00:00Z",
    locked_by: "u2",
    submitted_by_name: "Ana Silva",
    approved_by_name: "Ben Ito",
    locked_by_name: "Ben Ito",
    auto_lock_at: "2026-09-07T09:00:00Z",
    summary: {
      entries: 3,
      adjustments: 0,
      minutes: 135,
      amount: 225,
      unrated_minutes: 30,
      by_class: {
        billable: { minutes: 105, amount: 175 },
        absorbed: { minutes: 30, amount: 50 },
      },
      by_contract: { CT10001: { minutes: 135, amount: 225 } },
    },
    checksum: "3f2a9c8e1b7d4f6a5c3e2d1b0a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a19",
    version: 4,
    ...overrides,
  });
}

export function aBillingExport(overrides: Partial<BillingExport> = {}): BillingExport {
  return {
    id: "bx-1",
    account_id: "acct-1",
    billing_period_id: "bp-0",
    format: "xlsx",
    template_version: "thg-finance-1",
    object_key: "accounts/acct-1/billing/bp-0/finance-2026-09-03-09-05-00.xlsx",
    checksum: "3f2a9c8e1b7d4f6a5c3e2d1b0a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a19",
    row_count: 3,
    produced_by: "u2",
    produced_at: "2026-09-03T09:05:00Z",
    delivered_at: null,
    delivery_ref: null,
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

/** The budget cut (TB-05, TB-07 to TB-09): the account view, its drill-through and the rate card versions. */
describe("timeApi budget", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("names the drill-through parameters as the API does and leaves absent filters off", () => {
    expect(budgetEntriesParams({ accountId: "acct-1", from: "2026-09-01", to: "2026-09-30" })).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
    expect(
      budgetEntriesParams({
        accountId: "acct-1",
        contract: "c-1",
        person: "p-1",
        activity: "analysis",
        class: "billable",
        from: "2026-09-01",
        to: "2026-09-30",
      }),
    ).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
      contract: "c-1",
      person: "p-1",
      activity: "analysis",
      class: "billable",
    });
  });

  it("reads the budget view and the filtered entries, then refreshes the view after time is logged", async () => {
    let reads = 0;
    const calls = stubFetch({
      "GET /v1/accounts/acct-1/budget": () => {
        reads += 1;
        return json(aBudget());
      },
      "GET /v1/accounts/acct-1/budget/entries": () => json(aBudgetEntries()),
      "POST /v1/tickets/CS0001001/time": () => json(aRatedEntry(), 201),
    });
    const store = makeStore();
    const subscription = store.dispatch(timeApi.endpoints.accountBudget.initiate("acct-1"));
    const budget = await subscription.unwrap();
    expect(budget.contracts[0].position?.available_minutes).toBe(2400);
    expect(budget.contracts[0].thresholds?.next_percent).toBe(50);
    const entries = await store
      .dispatch(
        timeApi.endpoints.budgetEntries.initiate({
          accountId: "acct-1",
          contract: "c-1",
          person: "p-1",
          class: "billable",
          from: "2026-09-01",
          to: "2026-09-30",
        }),
      )
      .unwrap();
    expect(entries.total_amount).toBe(375);
    expect(calls[1].search).toBe("?from=2026-09-01&to=2026-09-30&contract=c-1&person=p-1&class=billable");
    const logged = await store
      .dispatch(
        timeApi.endpoints.logTicketTime.initiate({
          ticketKey: "CS0001001",
          body: { performed_on: "2026-09-07", minutes: 90, activity_type: "analysis" },
        }),
      )
      .unwrap();
    expect([logged.rate_snapshot, logged.amount, logged.over_budget]).toEqual(["150.00", "225.00", false]);
    await vi.waitFor(() => expect(reads).toBe(2));
    subscription.unsubscribe();
  });

  it("lists rate cards per contract or the account defaults and creates a version through PUT", async () => {
    let reads = 0;
    const calls = stubFetch({
      "GET /v1/accounts/acct-1/rate-cards": () => {
        reads += 1;
        return json([aRateCard()]);
      },
      "PUT /v1/accounts/acct-1/rate-cards": () =>
        json(aRateCard({ id: "rc-2", contract_id: "c-1", effective_from: "2026-10-01" })),
    });
    const store = makeStore();
    const subscription = store.dispatch(timeApi.endpoints.rateCards.initiate({ accountId: "acct-1" }));
    await subscription.unwrap();
    await store.dispatch(timeApi.endpoints.rateCards.initiate({ accountId: "acct-1", contractId: "c-1" })).unwrap();
    const created = await store
      .dispatch(
        timeApi.endpoints.createRateCard.initiate({
          accountId: "acct-1",
          body: {
            contract_id: "c-1",
            effective_from: "2026-10-01",
            currency: "USD",
            entries: [
              { role: "consultant", bill_rate: 160, overage_rate: 210 },
              { role: "architect", bill_rate: 220 },
            ],
          },
        }),
      )
      .unwrap();
    expect(created.contract_id).toBe("c-1");
    expect(calls.slice(0, 2).map((call) => `${call.key}${call.search}`)).toEqual([
      "GET /v1/accounts/acct-1/rate-cards",
      "GET /v1/accounts/acct-1/rate-cards?contract_id=c-1",
    ]);
    expect(calls.find((call) => call.key.startsWith("PUT "))?.body).toEqual({
      contract_id: "c-1",
      effective_from: "2026-10-01",
      currency: "USD",
      entries: [
        { role: "consultant", bill_rate: 160, overage_rate: 210 },
        { role: "architect", bill_rate: 220 },
      ],
    });
    // The saved version reloads the lists the screen holds (both the defaults and the contract's).
    await vi.waitFor(() => expect(reads).toBeGreaterThanOrEqual(3));
    subscription.unsubscribe();
  });

  it("surfaces rate_card_exists and duplicate_role as typed errors without reloading the list", async () => {
    let attempt = 0;
    let reads = 0;
    stubFetch({
      "GET /v1/accounts/acct-1/rate-cards": () => {
        reads += 1;
        return json([aRateCard()]);
      },
      "PUT /v1/accounts/acct-1/rate-cards": () => {
        attempt += 1;
        return attempt === 1
          ? json({ code: "rate_card_exists", effective_from: "2026-01-01" }, 409)
          : json({ code: "duplicate_role" }, 400);
      },
    });
    const store = makeStore();
    const subscription = store.dispatch(timeApi.endpoints.rateCards.initiate({ accountId: "acct-1" }));
    await subscription.unwrap();
    const create = () =>
      store
        .dispatch(
          timeApi.endpoints.createRateCard.initiate({
            accountId: "acct-1",
            body: { effective_from: "2026-01-01", entries: [{ role: "consultant", bill_rate: 1 }] },
          }),
        )
        .unwrap();
    await expect(create()).rejects.toMatchObject({ status: 409, data: { code: "rate_card_exists" } });
    await expect(create()).rejects.toMatchObject({ status: 400, data: { code: "duplicate_role" } });
    expect(reads).toBe(1);
    subscription.unsubscribe();
  });
});

/** The billing periods (functional 5.7, TB-14): the list, a new period, the four transitions with the version, the export records. */
describe("timeApi billing", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads the periods and the export records, and builds the export path with the format", async () => {
    const calls = stubFetch({
      "GET /v1/accounts/acct-1/billing-periods": () => json([aBillingPeriod(), aLockedPeriod()]),
      "GET /v1/accounts/acct-1/billing-periods/bp-0/exports": () => json([aBillingExport()]),
    });
    const store = makeStore();
    const periods = await store.dispatch(timeApi.endpoints.billingPeriods.initiate("acct-1")).unwrap();
    expect(periods.map((period) => period.status)).toEqual(["open", "locked"]);
    const exports = await store
      .dispatch(timeApi.endpoints.billingExports.initiate({ accountId: "acct-1", periodId: "bp-0" }))
      .unwrap();
    expect(exports[0].row_count).toBe(3);
    expect(calls.map((call) => call.key)).toEqual([
      "GET /v1/accounts/acct-1/billing-periods",
      "GET /v1/accounts/acct-1/billing-periods/bp-0/exports",
    ]);
    expect(billingExportPath("acct-1", "bp-0", "csv")).toBe("/v1/accounts/acct-1/billing-periods/bp-0/export?format=csv");
    expect(billingExportPath("acct-1", "bp-0", "xlsx")).toBe(
      "/v1/accounts/acct-1/billing-periods/bp-0/export?format=xlsx",
    );
  });

  it("creates a period and sends each transition to its own route with the version", async () => {
    const calls = stubFetch({
      "POST /v1/accounts/acct-1/billing-periods": () => json(aBillingPeriod(), 201),
      "POST /v1/accounts/acct-1/billing-periods/bp-1/submit": () =>
        json(aBillingPeriod({ status: "submitted", version: 2 }), 201),
      "POST /v1/accounts/acct-1/billing-periods/bp-1/reopen": () => json(aBillingPeriod({ version: 3 }), 201),
      "POST /v1/accounts/acct-1/billing-periods/bp-1/approve": () =>
        json(aBillingPeriod({ status: "approved", version: 4 }), 201),
      "POST /v1/accounts/acct-1/billing-periods/bp-1/lock": () =>
        json(aBillingPeriod({ status: "locked", version: 5 }), 201),
    });
    const store = makeStore();
    await store
      .dispatch(
        timeApi.endpoints.createBillingPeriod.initiate({
          accountId: "acct-1",
          body: { starts_on: "2026-09-01", ends_on: "2026-09-30" },
        }),
      )
      .unwrap();
    const step = (action: "submit" | "reopen" | "approve" | "lock", version: number) =>
      store
        .dispatch(timeApi.endpoints.transitionBillingPeriod.initiate({ accountId: "acct-1", periodId: "bp-1", action, version }))
        .unwrap();
    expect((await step("submit", 1)).status).toBe("submitted");
    await step("reopen", 2);
    await step("approve", 3);
    expect((await step("lock", 4)).status).toBe("locked");
    expect(calls.map((call) => [call.key, call.body])).toEqual([
      ["POST /v1/accounts/acct-1/billing-periods", { starts_on: "2026-09-01", ends_on: "2026-09-30" }],
      ["POST /v1/accounts/acct-1/billing-periods/bp-1/submit", { version: 1 }],
      ["POST /v1/accounts/acct-1/billing-periods/bp-1/reopen", { version: 2 }],
      ["POST /v1/accounts/acct-1/billing-periods/bp-1/approve", { version: 3 }],
      ["POST /v1/accounts/acct-1/billing-periods/bp-1/lock", { version: 4 }],
    ]);
  });

  it("reloads the list after a transition, including one refused as invalid_transition", async () => {
    let reads = 0;
    stubFetch({
      "GET /v1/accounts/acct-1/billing-periods": () => {
        reads += 1;
        return json([aBillingPeriod()]);
      },
      "POST /v1/accounts/acct-1/billing-periods/bp-1/approve": () =>
        json({ code: "invalid_transition", status: "open", allowed: ["submit", "lock"] }, 409),
    });
    const store = makeStore();
    const subscription = store.dispatch(timeApi.endpoints.billingPeriods.initiate("acct-1"));
    await subscription.unwrap();
    await expect(
      store
        .dispatch(
          timeApi.endpoints.transitionBillingPeriod.initiate({
            accountId: "acct-1",
            periodId: "bp-1",
            action: "approve",
            version: 1,
          }),
        )
        .unwrap(),
    ).rejects.toMatchObject({ status: 409, data: { code: "invalid_transition", allowed: ["submit", "lock"] } });
    await vi.waitFor(() => expect(reads).toBe(2));
    subscription.unsubscribe();
  });
});
