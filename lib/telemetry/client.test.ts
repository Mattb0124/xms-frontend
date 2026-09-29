import { describe, expect, it, vi } from "vitest";
import {
  TelemetryClient,
  fetchTransport,
  type TelemetrySendResult,
  type TelemetryTransport,
  type UsageEvent,
} from "@/lib/telemetry/client";
import { rememberRequestId } from "@/lib/telemetry/request-id";

/**
 * The API's ClientEventDto, transcribed from
 * backend/src/modules/telemetry/telemetry.module.ts. The global
 * ValidationPipe runs with `whitelist` and `forbidNonWhitelisted`, so an
 * undeclared key fails the whole batch with 400: that is exactly how every
 * telemetry batch the browser sent was dropped (frontend review finding 3).
 */
const DTO_KEYS = new Set(["type", "occurred_at", "account_id", "request_id", "entity_kind", "entity_id", "attrs"]);
/** The API's own attrs key rule; a key outside it is dropped server-side. */
const ATTR_KEY = /^[a-z][a-z0-9_]{0,40}$/;

function assertPassesDto(event: UsageEvent): void {
  for (const key of Object.keys(event)) {
    expect(DTO_KEYS.has(key), `"${key}" is not on ClientEventDto and would fail forbidNonWhitelisted`).toBe(true);
  }
  expect(event).toHaveProperty("type");
  expect(typeof event.type).toBe("string");
  expect(event.type.length).toBeLessThanOrEqual(60);
  expect(Number.isNaN(Date.parse(event.occurred_at))).toBe(false);
  if (event.request_id !== undefined) {
    expect(typeof event.request_id).toBe("string");
    expect(event.request_id.length).toBeLessThanOrEqual(128);
  }
  if (event.entity_kind !== undefined) expect(event.entity_kind.length).toBeLessThanOrEqual(60);
  if (event.entity_id !== undefined) expect(event.entity_id.length).toBeLessThanOrEqual(128);
  for (const key of Object.keys(event.attrs)) expect(ATTR_KEY.test(key), `attrs key "${key}"`).toBe(true);
}

function harness(overrides: Partial<TelemetrySendResult> = {}) {
  const sent: UsageEvent[][] = [];
  const keepalives: boolean[] = [];
  const transport: TelemetryTransport = {
    send: vi.fn(async (events: UsageEvent[], { keepalive }: { keepalive: boolean }) => {
      sent.push(events);
      keepalives.push(keepalive);
      return { ok: overrides.ok ?? true, rejected: overrides.rejected };
    }),
  };
  const timers: Array<() => void> = [];
  const client = new TelemetryClient({
    transport,
    flushIntervalMs: 10_000,
    maxBatch: 3,
    now: () => new Date("2026-09-07T10:00:00Z"),
    setTimer: (fn) => {
      timers.push(fn);
      return timers.length;
    },
    clearTimer: () => {},
  });
  return { client, sent, keepalives, timers, transport };
}

describe("TelemetryClient", () => {
  it("batches up to maxBatch and flushes when the batch is full", async () => {
    const { client, sent } = harness();
    client.track("screen.view", { path_template: "/cases" }, "queue");
    client.track("action.completed", { action: "ticket.create" }, "queue");
    expect(sent).toHaveLength(0);
    client.track("search.run", { scope: "global", result_count: 3 });
    await Promise.resolve();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toHaveLength(3);
    expect(sent[0][0]).toEqual({
      type: "screen.view",
      occurred_at: "2026-09-07T10:00:00.000Z",
      entity_kind: "screen",
      entity_id: "queue",
      attrs: { path_template: "/cases" },
    });
  });

  it("sends the shape the API's ClientEventDto declares and nothing else", async () => {
    const { client, sent } = harness();
    rememberRequestId("req-abc");
    client.track("screen.view", { path_template: "/accounts/[id]" }, "account");
    client.track("action.completed", { action: "export.run", row_count: 42 }, "queue");
    client.track("ui.error.shown", {});
    await Promise.resolve();
    expect(sent[0]).toHaveLength(3);
    for (const event of sent[0]) assertPassesDto(event);
    // The three keys that made every batch a 400 must be gone.
    for (const event of sent[0]) {
      expect(event).not.toHaveProperty("event_type");
      expect(event).not.toHaveProperty("screen");
      expect(event).not.toHaveProperty("client_ts");
    }
    // An event with no screen omits the entity pair rather than sending null.
    expect(sent[0][2]).not.toHaveProperty("entity_kind");
    expect(sent[0][2]).not.toHaveProperty("entity_id");
  });

  it("carries the screen as the entity, so the API stores it in its own columns", async () => {
    const { client, sent } = harness();
    client.track("screen.view", {}, "admin.usage");
    await client.flush();
    expect(sent[0][0].entity_kind).toBe("screen");
    expect(sent[0][0].entity_id).toBe("admin.usage");
  });

  it("flushes on the interval timer when the batch is not full", async () => {
    const { client, sent, timers } = harness();
    client.track("screen.view", {}, "my_work");
    expect(timers).toHaveLength(1);
    timers[0]();
    await Promise.resolve();
    expect(sent).toHaveLength(1);
    expect(client.pending).toBe(0);
  });

  it("carries the last API request id and passes keepalive on unload", async () => {
    const { client, sent, keepalives } = harness();
    rememberRequestId("req-123");
    client.track("action.completed", { action: "reply.send" }, "ticket");
    await client.flush({ keepalive: true });
    expect(sent[0][0].request_id).toBe("req-123");
    expect(keepalives).toEqual([true]);
  });

  it("re-queues a rejected batch once instead of dropping it silently", async () => {
    const { client, transport } = harness({ ok: false });
    client.track("screen.view", {}, "queue");
    await client.flush();
    expect(transport.send).toHaveBeenCalledTimes(1);
    expect(client.pending).toBe(1);
    expect(client.dropped).toBe(0);
  });

  it("counts the events the API refused rather than losing them in silence", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { client } = harness({ ok: true, rejected: 2 });
    client.track("screen.view", {}, "queue");
    await client.flush();
    expect(client.rejected).toBe(2);
    expect(client.pending).toBe(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("drops everything when disabled by the account setting or role", () => {
    const { client } = harness();
    client.track("screen.view", {}, "queue");
    client.setEnabled(false);
    client.track("screen.view", {}, "queue");
    expect(client.pending).toBe(0);
  });

  it("ignores event types outside the catalog", () => {
    const { client } = harness();
    client.track("ticket.title.typed" as never, { text: "leak" });
    expect(client.pending).toBe(0);
  });
});

describe("fetchTransport", () => {
  const event: UsageEvent = { type: "screen.view", occurred_at: "2026-09-07T10:00:00.000Z", attrs: {} };

  it("posts { events } with the bearer and reads the rejected count out of the body", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchStub = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ accepted: 0, rejected: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchStub);
    const result = await fetchTransport("http://api.test", async () => "tok").send([event], { keepalive: false });
    expect(result).toEqual({ ok: true, rejected: 1 });
    expect(calls[0].url).toBe("http://api.test/v1/telemetry");
    expect(calls[0].init.headers).toMatchObject({ authorization: "Bearer tok" });
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ events: [event] });
    vi.unstubAllGlobals();
  });

  it("asks for a retry on a 400 and sends nothing without a token", async () => {
    const fetchStub = vi.fn(async () => new Response("{}", { status: 400 }));
    vi.stubGlobal("fetch", fetchStub);
    expect(await fetchTransport("http://api.test", async () => "tok").send([event], { keepalive: false })).toEqual({
      ok: false,
    });
    expect(await fetchTransport("http://api.test", async () => null).send([event], { keepalive: false })).toEqual({
      ok: false,
    });
    expect(fetchStub).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
