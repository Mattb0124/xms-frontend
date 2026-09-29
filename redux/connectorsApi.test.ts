import { afterEach, describe, expect, it, vi } from "vitest";
import { connectorError, describeConnectorError } from "@/lib/connectors/errors";
import { externalRecordUrl, formatSeconds } from "@/lib/connectors/vocab";
import { connectorsApi } from "@/redux/connectorsApi";
import { makeStore } from "@/redux/store";
import { json, stubFetch } from "@/test-kit/portal";
import {
  aDeadLetter,
  aFieldMap,
  aHealthRow,
  aLink,
  anInstance,
  anOutboundRow,
  aRun,
  aSyncCardOutbound,
} from "@/test-kit/connectors";

const ID = anInstance().id;
const MAP = aFieldMap().id;

describe("connectorsApi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads instances, health, maps, runs with its filters, dead letters and the ticket sync", async () => {
    const calls = stubFetch({
      "GET /v1/accounts/acct-1/connectors": () => json([anInstance()]),
      "GET /v1/connectors/health": () => json([aHealthRow()]),
      [`GET /v1/connectors/${ID}/field-maps`]: () => json([aFieldMap()]),
      [`GET /v1/connectors/${ID}/state-maps`]: () => json([]),
      [`GET /v1/connectors/${ID}/runs`]: () => json([aRun()]),
      [`GET /v1/connectors/${ID}/dead-letters`]: () => json([aDeadLetter()]),
      "GET /v1/tickets/t-1/sync": () => json({ links: [aLink()], runs: [] }),
    });
    const store = makeStore();
    await store.dispatch(connectorsApi.endpoints.listConnectors.initiate("acct-1")).unwrap();
    await store.dispatch(connectorsApi.endpoints.connectorHealth.initiate()).unwrap();
    await store.dispatch(connectorsApi.endpoints.listFieldMaps.initiate(ID)).unwrap();
    await store.dispatch(connectorsApi.endpoints.listStateMaps.initiate(ID)).unwrap();
    await store
      .dispatch(
        connectorsApi.endpoints.listRuns.initiate({ id: ID, direction: "in", outcome: "dead_lettered", limit: 50 }),
      )
      .unwrap();
    await store.dispatch(connectorsApi.endpoints.listDeadLetters.initiate({ id: ID, resolution: "open" })).unwrap();
    await store.dispatch(connectorsApi.endpoints.ticketSync.initiate("t-1")).unwrap();
    expect(calls.map((call) => `${call.key}${call.search}`)).toEqual([
      "GET /v1/accounts/acct-1/connectors",
      "GET /v1/connectors/health",
      `GET /v1/connectors/${ID}/field-maps`,
      `GET /v1/connectors/${ID}/state-maps`,
      `GET /v1/connectors/${ID}/runs?direction=in&outcome=dead_lettered&limit=50`,
      `GET /v1/connectors/${ID}/dead-letters?resolution=open`,
      "GET /v1/tickets/t-1/sync",
    ]);
  });

  it("sends the instance mutations with the contract bodies", async () => {
    const calls = stubFetch({
      "POST /v1/accounts/acct-1/connectors/servicenow": () => json(anInstance(), 201),
      [`PATCH /v1/connectors/${ID}`]: () => json(anInstance({ mode: "off" })),
      [`POST /v1/connectors/${ID}/test-connection`]: () => json({ ok: true, fields: 120, latency_ms: 80 }),
      [`POST /v1/connectors/${ID}/kill-switch`]: () => json(anInstance({ kill_switch: "tripped" })),
      [`POST /v1/connectors/${ID}/watermark`]: () =>
        json({ preview: true, to: "2026-09-01T00:00:00.000Z", records: 12 }),
    });
    const store = makeStore();
    await store
      .dispatch(
        connectorsApi.endpoints.createServiceNowInstance.initiate({
          accountId: "acct-1",
          body: {
            name: "Brookfield CSM",
            base_url: "https://brookfield.service-now.com",
            auth_kind: "basic",
            credential: { username: "xms", password: "secret" },
            profile: "csm",
            poll_interval_seconds: 60,
          },
        }),
      )
      .unwrap();
    await store
      .dispatch(connectorsApi.endpoints.updateConnector.initiate({ id: ID, body: { version: 3, mode: "off" } }))
      .unwrap();
    await store.dispatch(connectorsApi.endpoints.testConnection.initiate(ID)).unwrap();
    await store
      .dispatch(connectorsApi.endpoints.killSwitch.initiate({ id: ID, action: "trip", reason: "Client outage" }))
      .unwrap();
    await store
      .dispatch(
        connectorsApi.endpoints.rewindWatermark.initiate({ id: ID, to: "2026-09-01T00:00:00.000Z", preview: true }),
      )
      .unwrap();
    await store
      .dispatch(connectorsApi.endpoints.rewindWatermark.initiate({ id: ID, to: "2026-09-01T00:00:00.000Z" }))
      .unwrap();
    expect(calls.map((call) => [call.key, call.body])).toEqual([
      [
        "POST /v1/accounts/acct-1/connectors/servicenow",
        {
          name: "Brookfield CSM",
          base_url: "https://brookfield.service-now.com",
          auth_kind: "basic",
          credential: { username: "xms", password: "secret" },
          profile: "csm",
          poll_interval_seconds: 60,
        },
      ],
      [`PATCH /v1/connectors/${ID}`, { version: 3, mode: "off" }],
      [`POST /v1/connectors/${ID}/test-connection`, undefined],
      [`POST /v1/connectors/${ID}/kill-switch`, { action: "trip", reason: "Client outage" }],
      [`POST /v1/connectors/${ID}/watermark`, { to: "2026-09-01T00:00:00.000Z", preview: true }],
      [`POST /v1/connectors/${ID}/watermark`, { to: "2026-09-01T00:00:00.000Z" }],
    ]);
  });

  it("sends the map lifecycle, samples and the dead-letter actions", async () => {
    const calls = stubFetch({
      [`POST /v1/connectors/${ID}/samples`]: () => json({ records: [], dictionary: [] }),
      [`POST /v1/connectors/${ID}/field-maps`]: () => json(aFieldMap(), 201),
      [`PUT /v1/connectors/${ID}/field-maps/${MAP}`]: () => json(aFieldMap()),
      [`POST /v1/connectors/${ID}/field-maps/${MAP}/validate`]: () =>
        json({ ok: true, problems: [], warnings: [], checked_samples: 5 }),
      [`POST /v1/connectors/${ID}/field-maps/${MAP}/activate`]: () => json(aFieldMap({ state: "active" })),
      [`POST /v1/connectors/${ID}/state-maps`]: () => json({ ...aFieldMap(), entries: {} }, 201),
      [`POST /v1/connectors/${ID}/dead-letters/replay`]: () => json({ results: [{ id: "dl-1", outcome: "replayed" }] }),
      [`POST /v1/connectors/${ID}/dead-letters/discard`]: () =>
        json({ results: [{ id: "dl-2", outcome: "discarded" }] }),
    });
    const store = makeStore();
    await store.dispatch(connectorsApi.endpoints.loadSamples.initiate({ id: ID, map_id: MAP })).unwrap();
    await store.dispatch(connectorsApi.endpoints.loadSamples.initiate({ id: ID })).unwrap();
    const entries = aFieldMap().entries;
    await store.dispatch(connectorsApi.endpoints.createMap.initiate({ id: ID, kind: "field", entries })).unwrap();
    await store
      .dispatch(connectorsApi.endpoints.updateMap.initiate({ id: ID, kind: "field", mapId: MAP, entries }))
      .unwrap();
    await store.dispatch(connectorsApi.endpoints.validateMap.initiate({ id: ID, kind: "field", mapId: MAP })).unwrap();
    await store.dispatch(connectorsApi.endpoints.activateMap.initiate({ id: ID, kind: "field", mapId: MAP })).unwrap();
    await store
      .dispatch(
        connectorsApi.endpoints.createMap.initiate({
          id: ID,
          kind: "state",
          entries: { incident: { inbound: {}, outbound: {} } },
        }),
      )
      .unwrap();
    await store.dispatch(connectorsApi.endpoints.replayDeadLetters.initiate({ id: ID, ids: ["dl-1"] })).unwrap();
    await store
      .dispatch(
        connectorsApi.endpoints.discardDeadLetters.initiate({ id: ID, ids: ["dl-2"], reason: "Duplicate of CS0001" }),
      )
      .unwrap();
    expect(calls.map((call) => [call.key, call.body])).toEqual([
      [`POST /v1/connectors/${ID}/samples`, { map_id: MAP }],
      [`POST /v1/connectors/${ID}/samples`, {}],
      [`POST /v1/connectors/${ID}/field-maps`, { entries }],
      [`PUT /v1/connectors/${ID}/field-maps/${MAP}`, { entries }],
      [`POST /v1/connectors/${ID}/field-maps/${MAP}/validate`, undefined],
      [`POST /v1/connectors/${ID}/field-maps/${MAP}/activate`, undefined],
      [`POST /v1/connectors/${ID}/state-maps`, { entries: { incident: { inbound: {}, outbound: {} } } }],
      [`POST /v1/connectors/${ID}/dead-letters/replay`, { ids: ["dl-1"] }],
      [`POST /v1/connectors/${ID}/dead-letters/discard`, { ids: ["dl-2"], reason: "Duplicate of CS0001" }],
    ]);
  });

  it("reads the outbound queue, filters it by status and retries one settled row", async () => {
    const row = anOutboundRow({ status: "failed", attempts: 3, last_error: "HTTP 503 from the instance" });
    const calls = stubFetch({
      [`GET /v1/connectors/${ID}/outbound`]: () => json([anOutboundRow(), row]),
      [`POST /v1/connectors/${ID}/outbound/${row.id}/retry`]: () => json({ id: row.id, outcome: "requeued" }, 201),
    });
    const store = makeStore();
    const all = await store.dispatch(connectorsApi.endpoints.listOutbound.initiate({ id: ID })).unwrap();
    expect(all).toHaveLength(2);
    expect(all[1].conflict).toBeNull();
    await store.dispatch(connectorsApi.endpoints.listOutbound.initiate({ id: ID, status: "failed" })).unwrap();
    const retried = await store
      .dispatch(connectorsApi.endpoints.retryOutbound.initiate({ id: ID, outboundId: row.id }))
      .unwrap();
    expect(retried).toEqual({ id: row.id, outcome: "requeued" });
    expect(calls.map((call) => `${call.key}${call.search}`)).toEqual([
      `GET /v1/connectors/${ID}/outbound`,
      `GET /v1/connectors/${ID}/outbound?status=failed`,
      `POST /v1/connectors/${ID}/outbound/${row.id}/retry`,
    ]);
    expect(calls[2].body).toBeUndefined();
  });

  it("reloads the queue after a retry", async () => {
    let queue = 0;
    const row = anOutboundRow({ status: "dead_lettered" });
    stubFetch({
      [`GET /v1/connectors/${ID}/outbound`]: () => {
        queue += 1;
        return json([row]);
      },
      [`POST /v1/connectors/${ID}/outbound/${row.id}/retry`]: () => json({ id: row.id, outcome: "requeued" }, 201),
    });
    const store = makeStore();
    const subscription = store.dispatch(connectorsApi.endpoints.listOutbound.initiate({ id: ID }));
    await subscription.unwrap();
    await store.dispatch(connectorsApi.endpoints.retryOutbound.initiate({ id: ID, outboundId: row.id })).unwrap();
    await vi.waitFor(() => expect(queue).toBe(2));
    subscription.unsubscribe();
  });

  it("carries the outbound half of each Sync card link", async () => {
    stubFetch({
      "GET /v1/tickets/t-2/sync": () =>
        json({
          links: [
            aLink({
              mode: "bidirectional",
              outbound: aSyncCardOutbound({ pending: 2, failed: 1, last_error: "HTTP 401 from the instance" }),
            }),
          ],
          runs: [],
        }),
    });
    const store = makeStore();
    const sync = await store.dispatch(connectorsApi.endpoints.ticketSync.initiate("t-2")).unwrap();
    expect(sync.links[0].outbound).toEqual({
      last_pushed_at: "2026-09-07T09:40:00Z",
      pending: 2,
      failed: 1,
      last_error: "HTTP 401 from the instance",
    });
  });

  it("refreshes the health list after an instance mutation", async () => {
    let health = 0;
    stubFetch({
      "GET /v1/connectors/health": () => {
        health += 1;
        return json([aHealthRow()]);
      },
      [`POST /v1/connectors/${ID}/kill-switch`]: () => json(anInstance({ kill_switch: "tripped" })),
    });
    const store = makeStore();
    const subscription = store.dispatch(connectorsApi.endpoints.connectorHealth.initiate());
    await subscription.unwrap();
    await store
      .dispatch(connectorsApi.endpoints.killSwitch.initiate({ id: ID, action: "trip", reason: "Client outage" }))
      .unwrap();
    await vi.waitFor(() => expect(health).toBe(2));
    subscription.unsubscribe();
  });
});

describe("connector errors", () => {
  it("parses the typed 409 and 400 bodies into fixed copy", () => {
    expect(describeConnectorError(connectorError({ status: 409, data: { code: "no_active_field_map" } }))).toBe(
      "Activate a field map before switching the mode on.",
    );
    expect(describeConnectorError(connectorError({ status: 409, data: { code: "no_active_state_map" } }))).toBe(
      "Bidirectional mode sends XMS states to the client, so activate a state map first.",
    );
    const untested = connectorError({
      status: 409,
      data: { code: "credential_not_valid", credential_state: "unknown" },
    });
    expect(untested.credential_state).toBe("unknown");
    expect(describeConnectorError(untested)).toContain("Run Test connection first");
    const refused = connectorError({
      status: 409,
      data: { code: "credential_not_valid", credential_state: "invalid" },
    });
    expect(describeConnectorError(refused)).toBe(
      "The instance refused this credential. Fix it in Settings, then test the connection again.",
    );
    expect(
      describeConnectorError(
        connectorError({ status: 400, data: { code: "bad_status", allowed: ["pending", "sent"] } }),
      ),
    ).toBe("That is not a status the outbound queue keeps.");
    const immutable = connectorError({ status: 409, data: { code: "map_immutable", state: "retired" } });
    expect(describeConnectorError(immutable)).toBe("This version is retired and cannot be edited. Create a new draft.");
    expect(
      describeConnectorError(connectorError({ status: 409, data: { code: "map_not_validated", state: "draft" } })),
    ).toBe("Validate this version before activating it.");
    const credential = connectorError({
      status: 400,
      data: { code: "credential_incomplete", needs: ["client_id", "client_secret"] },
    });
    expect(credential.needs).toEqual(["client_id", "client_secret"]);
    expect(describeConnectorError(credential)).toBe("The credential needs client_id and client_secret.");
    expect(describeConnectorError(connectorError({ status: 409, data: { code: "stale_version" } }))).toBe(
      "Someone else changed this record. It has been reloaded.",
    );
  });

  it("builds the ServiceNow record URL and formats lag", () => {
    expect(externalRecordUrl("https://brookfield.service-now.com/", "sn_customerservice_case", "abc123")).toBe(
      "https://brookfield.service-now.com/nav_to.do?uri=sn_customerservice_case.do%3Fsys_id%3Dabc123",
    );
    expect(formatSeconds(45)).toBe("45s");
    expect(formatSeconds(125)).toBe("2m 5s");
    expect(formatSeconds(3 * 3600 + 12 * 60)).toBe("3h 12m");
  });

  // The instance base URL is server-supplied and lands in an href, so it is
  // validated here rather than trusted from a DTO three services away
  // (security review finding 26).
  it("refuses a record URL built on a base that is not a web address", () => {
    for (const base of ["javascript:alert(1)", "data:text/html,x", "//evil.test", "", "not a url"]) {
      expect(externalRecordUrl(base, "sn_customerservice_case", "abc123"), base).toBeNull();
    }
  });
});
