import { afterEach, describe, expect, it, vi } from "vitest";
import { reportingApi } from "@/redux/reportingApi";
import { makeStore } from "@/redux/store";
import { json, stubFetch } from "@/test-kit/portal";
import { anOperationsDashboard } from "@/test-kit/reporting";

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
});
