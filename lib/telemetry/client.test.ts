import { describe, expect, it, vi } from "vitest";
import { TelemetryClient, type TelemetryTransport, type UsageEvent } from "@/lib/telemetry/client";
import { rememberRequestId } from "@/lib/telemetry/request-id";

function harness(overrides: Partial<{ ok: boolean }> = {}) {
  const sent: UsageEvent[][] = [];
  const keepalives: boolean[] = [];
  const transport: TelemetryTransport = {
    send: vi.fn(async (events, { keepalive }) => {
      sent.push(events);
      keepalives.push(keepalive);
      return overrides.ok ?? true;
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
    client.track("screen.view", { screen: "queue" }, "queue");
    client.track("action.completed", { action: "ticket.create" }, "queue");
    expect(sent).toHaveLength(0);
    client.track("search.run", { scope: "global", result_count: 3 });
    await Promise.resolve();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toHaveLength(3);
    expect(sent[0][0]).toMatchObject({
      event_type: "screen.view",
      screen: "queue",
      client_ts: "2026-09-07T10:00:00.000Z",
    });
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
