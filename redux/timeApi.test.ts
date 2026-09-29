import { afterEach, describe, expect, it, vi } from "vitest";
import { makeStore } from "@/redux/store";
import { billingExportPath, BUCKET_CODES, bucketCodeLabel, budgetEntriesParams, timeApi } from "@/redux/timeApi";
import { json, stubFetch } from "@/test-kit/portal";
import {
  aBillingExport,
  aBillingPeriod,
  aBucket,
  aBudget,
  aBudgetEntries,
  aCompTimeReport,
  aLockedPeriod,
  anAfterHoursEntry,
  anEntry,
  aPosition,
  aRateCard,
  aRatedEntry,
  BUCKET_ID,
} from "@/test-kit/time";

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
      "POST /v1/accounts/acct-1/buckets/b-1/time-entries": () => json(anEntry(), 201),
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

  it("logs bucket time on the /time-entries route the API renamed it to", async () => {
    const calls = stubFetch({
      "POST /v1/accounts/acct-1/buckets/b-1/time-entries": () => json(anEntry({ bucket_id: "b-1" }), 201),
    });
    const store = makeStore();
    const entry = await store
      .dispatch(
        timeApi.endpoints.logBucketTime.initiate({
          accountId: "acct-1",
          bucketId: "b-1",
          body: { performed_on: "2026-09-07", minutes: 30, activity_type: "analysis" },
        }),
      )
      .unwrap();
    expect(entry.bucket_id).toBe("b-1");
    expect(calls.map((call) => call.key)).toEqual(["POST /v1/accounts/acct-1/buckets/b-1/time-entries"]);
    expect(calls[0].body).toMatchObject({ performed_on: "2026-09-07", minutes: 30, activity_type: "analysis" });
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
    expect(billingExportPath("acct-1", "bp-0", "csv")).toBe(
      "/v1/accounts/acct-1/billing-periods/bp-0/export?format=csv",
    );
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
        .dispatch(
          timeApi.endpoints.transitionBillingPeriod.initiate({
            accountId: "acct-1",
            periodId: "bp-1",
            action,
            version,
          }),
        )
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

/** The bucket routes (TB-12): the list under time:log, the edit under contracts:manage. */
describe("timeApi buckets", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists the account's buckets with the taxonomy and the class each one carries", async () => {
    const calls = stubFetch({
      "GET /v1/accounts/acct-1/buckets": () =>
        json([aBucket(), aBucket({ id: "b-2", key: "qbr_prep", label: "QBR prep", code: "qbr_prep" })]),
    });
    const store = makeStore();
    const buckets = await store.dispatch(timeApi.endpoints.listBuckets.initiate("acct-1")).unwrap();
    expect(buckets.map((bucket) => bucket.code)).toEqual(["governance", "qbr_prep"]);
    expect(calls.map((call) => call.key)).toEqual(["GET /v1/accounts/acct-1/buckets"]);
  });

  it("patches a bucket with its version and reads the list again", async () => {
    let reads = 0;
    const calls = stubFetch({
      "GET /v1/accounts/acct-1/buckets": () => {
        reads += 1;
        return json([reads > 1 ? aBucket({ status: "retired", version: 2 }) : aBucket()]);
      },
      [`PATCH /v1/accounts/acct-1/buckets/${BUCKET_ID}`]: () => json(aBucket({ status: "retired", version: 2 })),
    });
    const store = makeStore();
    const subscription = store.dispatch(timeApi.endpoints.listBuckets.initiate("acct-1"));
    await subscription.unwrap();
    const patched = await store
      .dispatch(
        timeApi.endpoints.patchBucket.initiate({
          accountId: "acct-1",
          bucketId: BUCKET_ID,
          body: { version: 1, status: "retired" },
        }),
      )
      .unwrap();
    expect(patched.status).toBe("retired");
    expect(calls.find((call) => call.key.startsWith("PATCH "))?.body).toEqual({ version: 1, status: "retired" });
    await vi.waitFor(() => expect(reads).toBe(2));
    subscription.unsubscribe();
  });

  it("reads the list again even when the patch is refused, because a stale version means it is behind", async () => {
    let reads = 0;
    stubFetch({
      "GET /v1/accounts/acct-1/buckets": () => {
        reads += 1;
        return json([aBucket()]);
      },
      [`PATCH /v1/accounts/acct-1/buckets/${BUCKET_ID}`]: () => json({ code: "stale_version" }, 409),
    });
    const store = makeStore();
    const subscription = store.dispatch(timeApi.endpoints.listBuckets.initiate("acct-1"));
    await subscription.unwrap();
    await expect(
      store
        .dispatch(
          timeApi.endpoints.patchBucket.initiate({
            accountId: "acct-1",
            bucketId: BUCKET_ID,
            body: { version: 1, label: "Governance and QBR" },
          }),
        )
        .unwrap(),
    ).rejects.toMatchObject({ status: 409, data: { code: "stale_version" } });
    await vi.waitFor(() => expect(reads).toBe(2));
    subscription.unsubscribe();
  });

  it("names each code in the shared taxonomy, and falls back on one it has never heard of", () => {
    expect([...BUCKET_CODES]).toEqual(["governance", "qbr_prep", "account_mgmt", "escalation", "custom"]);
    expect(bucketCodeLabel("qbr_prep")).toBe("QBR preparation");
    expect(bucketCodeLabel("something_new")).toBe("something new");
  });
});
