import { afterEach, describe, expect, it, vi } from "vitest";
import { reportingApi } from "@/redux/reportingApi";
import { makeStore } from "@/redux/store";
import { json, stubFetch } from "@/test-kit/portal";
import { aCsatSummary, aDelivery, anOperationsDashboard, aRun, aSchedule, SCHEDULE_ID } from "@/test-kit/reporting";

/** The reporting slice sends the request shapes the dashboards, audit and reports contract expects. */
describe("reportingApi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads the dashboards with the period and the client toggle", async () => {
    const calls = stubFetch({
      "GET /v1/dashboards/operations": () => json(anOperationsDashboard()),
      "GET /v1/dashboards/accounts/acct-1": () => json({ period: {}, measures: {} }),
      "GET /v1/dashboards/security": () => json({ by_type: [], signin_failures: [], isolation_probes: [] }),
      "GET /v1/dashboards/usage": () => json({}),
      "GET /v1/portal/dashboard": () => json({ period: {}, measures: {} }),
    });
    const store = makeStore();
    await store.dispatch(reportingApi.endpoints.operationsDashboard.initiate({ days: 30 })).unwrap();
    await store.dispatch(reportingApi.endpoints.accountDashboard.initiate({ id: "acct-1", days: 7 })).unwrap();
    await store
      .dispatch(reportingApi.endpoints.accountDashboard.initiate({ id: "acct-1", days: 7, asClient: true }))
      .unwrap();
    await store.dispatch(reportingApi.endpoints.securityDashboard.initiate({ days: 7 })).unwrap();
    await store.dispatch(reportingApi.endpoints.usageDashboard.initiate({ days: 90 })).unwrap();
    await store.dispatch(reportingApi.endpoints.portalDashboard.initiate()).unwrap();
    expect(calls.map((call) => `${call.key}${call.search}`)).toEqual([
      "GET /v1/dashboards/operations?days=30",
      "GET /v1/dashboards/accounts/acct-1?days=7",
      "GET /v1/dashboards/accounts/acct-1?days=7&as_client=true",
      "GET /v1/dashboards/security?days=7",
      "GET /v1/dashboards/usage?days=90",
      "GET /v1/portal/dashboard?days=30",
    ]);
  });

  it("posts the audit query with the cursor, lists runs, generates a WSR and reads a pack", async () => {
    const calls = stubFetch({
      "POST /v1/audit/search": () => json({ items: [], next_cursor: null }),
      "GET /v1/accounts/acct-1/reports": () => json([]),
      "POST /v1/accounts/acct-1/reports/wsr": () =>
        json({ run_id: "run-1", pack_id: "pack-1", download: "https://files.test/pack.pptx" }, 201),
      "GET /v1/reports/packs/pack-1": () => json({ id: "pack-1", narrative_versions: [], download: null }),
    });
    const store = makeStore();
    const query = { conditions: [{ field: "request_id" as const, op: "eq" as const, value: "req-1" }], cursor: "c1" };
    await store.dispatch(reportingApi.endpoints.auditSearch.initiate(query)).unwrap();
    await store.dispatch(reportingApi.endpoints.reportRuns.initiate("acct-1")).unwrap();
    const generated = await store.dispatch(reportingApi.endpoints.generateWsr.initiate("acct-1")).unwrap();
    expect(generated.download).toBe("https://files.test/pack.pptx");
    await store.dispatch(reportingApi.endpoints.reportPack.initiate("pack-1")).unwrap();
    expect(calls.map((call) => [call.key, call.body])).toEqual([
      ["POST /v1/audit/search", query],
      ["GET /v1/accounts/acct-1/reports", undefined],
      ["POST /v1/accounts/acct-1/reports/wsr", undefined],
      ["GET /v1/accounts/acct-1/reports", undefined],
      ["GET /v1/reports/packs/pack-1", undefined],
    ]);
  });

  it("reads the account CSAT with the range as the API names it", async () => {
    const calls = stubFetch({ "GET /v1/accounts/acct-1/csat": () => json(aCsatSummary()) });
    const store = makeStore();
    const view = await store
      .dispatch(
        reportingApi.endpoints.accountCsat.initiate({ accountId: "acct-1", from: "2026-06-09", to: "2026-09-07" }),
      )
      .unwrap();
    expect(view.summary.average).toBe(3.5);
    await store.dispatch(reportingApi.endpoints.accountCsat.initiate({ accountId: "acct-1" })).unwrap();
    expect(calls.map((call) => `${call.key}${call.search}`)).toEqual([
      "GET /v1/accounts/acct-1/csat?from=2026-06-09&to=2026-09-07",
      "GET /v1/accounts/acct-1/csat",
    ]);
  });

  it("lists, creates, patches with the version and runs a schedule now, then reads the runs by account and schedule", async () => {
    const calls = stubFetch({
      "GET /v1/reporting/schedules": () => json([aSchedule()]),
      "POST /v1/reporting/schedules": () => json(aSchedule({ id: "new" }), 201),
      [`PATCH /v1/reporting/schedules/${SCHEDULE_ID}`]: () => json(aSchedule({ enabled: false, version: 2 })),
      [`POST /v1/reporting/schedules/${SCHEDULE_ID}/run-now`]: () =>
        json(
          {
            run_id: "run-11",
            pack_id: "pack-11",
            period: { start: "2026-08-24", end: "2026-08-30" },
            delivery: [aDelivery()],
            status: "sent",
          },
          201,
        ),
      "GET /v1/reporting/runs": () => json([aRun()]),
    });
    const store = makeStore();
    await store.dispatch(reportingApi.endpoints.reportSchedules.initiate("acct-1")).unwrap();
    await store
      .dispatch(
        reportingApi.endpoints.createReportSchedule.initiate({
          account_id: "acct-1",
          name: "Monthly",
          cadence: "monthly",
          run_day: 1,
          run_time: "07:30",
          distribution: [{ kind: "contact", email: "pat@client.test", name: "Pat" }],
        }),
      )
      .unwrap();
    const patched = await store
      .dispatch(
        reportingApi.endpoints.patchReportSchedule.initiate({
          id: SCHEDULE_ID,
          accountId: "acct-1",
          body: { version: 1, enabled: false },
        }),
      )
      .unwrap();
    expect(patched.enabled).toBe(false);
    const ran = await store
      .dispatch(
        reportingApi.endpoints.runScheduleNow.initiate({
          id: SCHEDULE_ID,
          accountId: "acct-1",
          body: { period_start: "2026-08-24", period_end: "2026-08-30" },
        }),
      )
      .unwrap();
    expect(ran.delivery[0].outcome).toBe("notified");
    const runs = await store
      .dispatch(reportingApi.endpoints.scheduleRuns.initiate({ account: "acct-1", schedule: SCHEDULE_ID }))
      .unwrap();
    expect(runs[0].pack_id).toBe("pack-10");
    const seen = calls.map((call) => [`${call.key}${call.search}`, call.body]);
    expect(seen[0]).toEqual(["GET /v1/reporting/schedules?account=acct-1", undefined]);
    expect(seen[1]).toEqual([
      "POST /v1/reporting/schedules",
      {
        account_id: "acct-1",
        name: "Monthly",
        cadence: "monthly",
        run_day: 1,
        run_time: "07:30",
        distribution: [{ kind: "contact", email: "pat@client.test", name: "Pat" }],
      },
    ]);
    expect(seen).toContainEqual([`PATCH /v1/reporting/schedules/${SCHEDULE_ID}`, { version: 1, enabled: false }]);
    expect(seen).toContainEqual([
      `POST /v1/reporting/schedules/${SCHEDULE_ID}/run-now`,
      { period_start: "2026-08-24", period_end: "2026-08-30" },
    ]);
    expect(seen).toContainEqual([`GET /v1/reporting/runs?account=acct-1&schedule=${SCHEDULE_ID}`, undefined]);
    // Every write reloads the schedules list.
    expect(calls.filter((call) => call.key === "GET /v1/reporting/schedules").length).toBe(4);
  });
});
