import { afterEach, describe, expect, it, vi } from "vitest";
import { describeMigrationError, migrationError } from "@/lib/migration/errors";
import { filterFromSearch, filterToSearch } from "@/lib/migration/filters";
import {
  batchStatusTone,
  describeRange,
  describeSource,
  formatDelta,
  isRunnable,
  isRunning,
  lineStatusTone,
  recordStatusTone,
  runBlockedReason,
} from "@/lib/migration/vocab";
import { migrationApi } from "@/redux/migrationApi";
import { makeStore } from "@/redux/store";
import { json, stubFetch } from "@/test-kit/portal";
import {
  aBatch,
  aBatchDetail,
  ACCOUNT_ID,
  aRecord,
  aReport,
  BATCH_ID,
  INSTANCE_ID,
  RECORD_ID,
  REPORT_ID,
} from "@/test-kit/migration";

describe("migrationApi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads the batch list with its filters, one batch, the records with status and search, one record, and the reports", async () => {
    const calls = stubFetch({
      "GET /v1/migration/batches": () => json([aBatch()]),
      [`GET /v1/migration/batches/${BATCH_ID}`]: () => json(aBatchDetail()),
      [`GET /v1/migration/batches/${BATCH_ID}/records`]: () => json([aRecord()]),
      [`GET /v1/migration/batches/${BATCH_ID}/records/${RECORD_ID}`]: () =>
        json({ ...aRecord(), payload: { record: { sys_id: "sys-abc123" }, journal: [] } }),
      "GET /v1/migration/reconciliation": () => json([aReport()]),
    });
    const store = makeStore();
    await store.dispatch(migrationApi.endpoints.listBatches.initiate()).unwrap();
    await store
      .dispatch(
        migrationApi.endpoints.listBatches.initiate({ account_id: ACCOUNT_ID, object_kind: "case", status: "draft" }),
      )
      .unwrap();
    await store.dispatch(migrationApi.endpoints.getBatch.initiate(BATCH_ID)).unwrap();
    await store
      .dispatch(migrationApi.endpoints.listRecords.initiate({ id: BATCH_ID, status: "unmatched", q: "CS00" }))
      .unwrap();
    const record = await store
      .dispatch(migrationApi.endpoints.getRecord.initiate({ id: BATCH_ID, recordId: RECORD_ID }))
      .unwrap();
    await store
      .dispatch(migrationApi.endpoints.listReports.initiate({ account_id: ACCOUNT_ID, scope: "batch" }))
      .unwrap();
    expect(calls.map((call) => `${call.key}${call.search}`)).toEqual([
      "GET /v1/migration/batches",
      `GET /v1/migration/batches?account_id=${ACCOUNT_ID}&object_kind=case&status=draft`,
      `GET /v1/migration/batches/${BATCH_ID}`,
      `GET /v1/migration/batches/${BATCH_ID}/records?status=unmatched&q=CS00`,
      `GET /v1/migration/batches/${BATCH_ID}/records/${RECORD_ID}`,
      `GET /v1/migration/reconciliation?account_id=${ACCOUNT_ID}&scope=batch`,
    ]);
    expect((record.payload as { record: { sys_id: string } }).record.sys_id).toBe("sys-abc123");
  });

  it("sends create, run, explain and sign-off with the contract bodies", async () => {
    const calls = stubFetch({
      "POST /v1/migration/batches": () => json(aBatch(), 201),
      [`POST /v1/migration/batches/${BATCH_ID}/run`]: () =>
        json(aBatchDetail({ status: "reconciled", report: aReport() }), 201),
      [`POST /v1/migration/reconciliation/${REPORT_ID}/lines/2/explain`]: () => json(aReport({ version: 2 }), 201),
      [`POST /v1/migration/reconciliation/${REPORT_ID}/sign-off`]: () =>
        json(aReport({ status: "signed_off", signed_by: "user-2", version: 3 }), 201),
    });
    const store = makeStore();
    await store
      .dispatch(
        migrationApi.endpoints.createBatch.initiate({
          account_id: ACCOUNT_ID,
          instance_id: INSTANCE_ID,
          object_kind: "case",
          opened_from: "2025-01-01",
          opened_to: "2025-12-31",
          dry_run: true,
        }),
      )
      .unwrap();
    const ran = await store.dispatch(migrationApi.endpoints.runBatch.initiate(BATCH_ID)).unwrap();
    await store
      .dispatch(
        migrationApi.endpoints.explainLine.initiate({
          id: REPORT_ID,
          line: 2,
          explanation: "attachments are out of scope for the rehearsal",
          version: 1,
        }),
      )
      .unwrap();
    await store.dispatch(migrationApi.endpoints.signOffReport.initiate({ id: REPORT_ID, version: 2 })).unwrap();
    expect(calls.map((call) => [call.key, call.body])).toEqual([
      [
        "POST /v1/migration/batches",
        {
          account_id: ACCOUNT_ID,
          instance_id: INSTANCE_ID,
          object_kind: "case",
          opened_from: "2025-01-01",
          opened_to: "2025-12-31",
          dry_run: true,
        },
      ],
      [`POST /v1/migration/batches/${BATCH_ID}/run`, undefined],
      [
        `POST /v1/migration/reconciliation/${REPORT_ID}/lines/2/explain`,
        { explanation: "attachments are out of scope for the rehearsal", version: 1 },
      ],
      [`POST /v1/migration/reconciliation/${REPORT_ID}/sign-off`, { version: 2 }],
    ]);
    expect(ran.report?.lines).toHaveLength(3);
  });

  it("refetches the batch and its records after a run", async () => {
    let reads = 0;
    let records = 0;
    stubFetch({
      [`GET /v1/migration/batches/${BATCH_ID}`]: () => {
        reads += 1;
        return json(aBatchDetail({ status: reads > 1 ? "reconciled" : "draft" }));
      },
      [`GET /v1/migration/batches/${BATCH_ID}/records`]: () => {
        records += 1;
        return json(records > 1 ? [aRecord()] : []);
      },
      [`POST /v1/migration/batches/${BATCH_ID}/run`]: () => json(aBatchDetail({ status: "reconciled" }), 201),
    });
    const store = makeStore();
    const batch = store.dispatch(migrationApi.endpoints.getBatch.initiate(BATCH_ID));
    const list = store.dispatch(migrationApi.endpoints.listRecords.initiate({ id: BATCH_ID }));
    await batch.unwrap();
    await list.unwrap();
    await store.dispatch(migrationApi.endpoints.runBatch.initiate(BATCH_ID)).unwrap();
    await vi.waitFor(() => expect(reads).toBe(2));
    await vi.waitFor(() => expect(records).toBe(2));
    batch.unsubscribe();
    list.unsubscribe();
  });
});

describe("migration errors", () => {
  it("parses the typed bodies into fixed copy, including the two sign-off rules", () => {
    expect(describeMigrationError(migrationError({ status: 403, data: { code: "signer_ran_batch" } }))).toBe(
      "The person who ran the batch cannot sign its report. A second administrator must sign.",
    );
    expect(describeMigrationError(migrationError({ status: 409, data: { code: "delta_open" } }))).toBe(
      "Every line must be matched or have an explanation before the report can be signed.",
    );
    const notRunnable = migrationError({ status: 409, data: { code: "batch_not_runnable", status: "signed_off" } });
    expect(notRunnable.status_value).toBe("signed_off");
    expect(describeMigrationError(notRunnable)).toBe("This batch is signed off and cannot be run again.");
    expect(
      describeMigrationError(
        migrationError({ status: 404, data: { code: "not_found", entity: "connector_instance" } }),
      ),
    ).toBe("That connector instance is not on the chosen account.");
    expect(describeMigrationError(migrationError({ status: 400, data: { code: "bad_range" } }))).toContain("ISO dates");
    expect(describeMigrationError(migrationError({ status: 409, data: { code: "no_active_field_map" } }))).toContain(
      "field map",
    );
    expect(describeMigrationError(migrationError({ status: 409, data: { code: "stale_version" } }))).toBe(
      "Someone else changed this record. It has been reloaded.",
    );
  });
});

describe("migration vocabulary and filters", () => {
  it("knows which statuses run, which may be run, and why the button is off", () => {
    expect(isRunnable("draft")).toBe(true);
    expect(isRunnable("failed")).toBe(true);
    expect(isRunnable("reconciled")).toBe(false);
    expect(isRunning("loading")).toBe(true);
    expect(isRunning("draft")).toBe(false);
    expect(runBlockedReason({ status: "draft" })).toBeNull();
    expect(runBlockedReason({ status: "mapping" })).toBe("This batch is running.");
    expect(runBlockedReason({ status: "superseded" })).toContain("superseded");
    expect(runBlockedReason({ status: "signed_off" })).toContain("signed off");
    expect(batchStatusTone("failed")).toBe("overdue");
    expect(batchStatusTone("signed_off")).toBe("complete");
    expect(recordStatusTone("error")).toBe("overdue");
    expect(recordStatusTone("unmatched")).toBe("needs-input");
    expect(lineStatusTone("delta_open")).toBe("overdue");
    expect(lineStatusTone("delta_explained")).toBe("ready");
  });

  it("describes the range, the source and the delta", () => {
    expect(describeRange({ opened_from: "2025-01-01", opened_to: "2025-12-31" })).toBe("2025-01-01 to 2025-12-31");
    expect(describeRange({})).toBe("");
    expect(describeSource(aBatch())).toBe("Brookfield CSM (sn_customerservice_case)");
    expect(describeSource(aBatch({ source_ref: {} }))).toBe("ServiceNow table API");
    expect(formatDelta(2)).toBe("+2");
    expect(formatDelta(-2)).toBe("-2");
    expect(formatDelta(0)).toBe("0");
  });

  it("round-trips the list filters through the URL with the API's parameter names", () => {
    const filter = filterFromSearch(new URLSearchParams(`account_id=${ACCOUNT_ID}&status=failed`));
    expect(filter).toEqual({ account_id: ACCOUNT_ID, object_kind: undefined, status: "failed" });
    expect(filterToSearch(filter)).toBe(`?account_id=${ACCOUNT_ID}&status=failed`);
    expect(filterToSearch({})).toBe("");
    expect(filterToSearch({ object_kind: "case" })).toBe("?object_kind=case");
  });
});
