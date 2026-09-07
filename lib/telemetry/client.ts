import { currentRequestId } from "@/lib/telemetry/request-id";

/**
 * Usage event types the browser may emit (Audit & Analytics section 4.2).
 * Anything else is rejected here and by the API's catalog validation.
 */
export const USAGE_EVENT_TYPES = [
  "screen.view",
  "screen.leave",
  "action.completed",
  "action.abandoned",
  "search.run",
  "axel.suggestion.shown",
  "axel.suggestion.decided",
  "axel.panel.opened",
  "axel.turn.completed",
  "ui.error.shown",
] as const;
export type UsageEventType = (typeof USAGE_EVENT_TYPES)[number];

/** Structured facts only: identifiers, names from registries, counts, durations. Never free text. */
export type UsageAttrs = Record<string, string | number | boolean | null>;

export interface UsageEvent {
  event_type: UsageEventType;
  screen?: string;
  attrs: UsageAttrs;
  client_ts: string;
  request_id: string | null;
}

export interface TelemetryTransport {
  /** Resolves true when the batch was accepted; false to retry. */
  send(events: UsageEvent[], options: { keepalive: boolean }): Promise<boolean>;
}

export interface TelemetryOptions {
  transport: TelemetryTransport;
  flushIntervalMs?: number;
  maxBatch?: number;
  /** Disabled when the account setting or the role forbids usage analytics. */
  enabled?: boolean;
  now?: () => Date;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export class TelemetryClient {
  private queue: UsageEvent[] = [];
  private timer: unknown = null;
  private inflight = false;
  private readonly flushIntervalMs: number;
  private readonly maxBatch: number;
  private enabled: boolean;
  private readonly now: () => Date;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;
  dropped = 0;

  constructor(private readonly options: TelemetryOptions) {
    this.flushIntervalMs = options.flushIntervalMs ?? 10_000;
    this.maxBatch = options.maxBatch ?? 50;
    this.enabled = options.enabled ?? true;
    this.now = options.now ?? (() => new Date());
    this.setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.queue = [];
  }

  get pending(): number {
    return this.queue.length;
  }

  track(type: UsageEventType, attrs: UsageAttrs = {}, screen?: string): void {
    if (!this.enabled) return;
    if (!(USAGE_EVENT_TYPES as readonly string[]).includes(type)) return;
    this.queue.push({
      event_type: type,
      screen,
      attrs,
      client_ts: this.now().toISOString(),
      request_id: currentRequestId(),
    });
    if (this.queue.length >= this.maxBatch) {
      void this.flush();
      return;
    }
    if (this.timer === null) {
      this.timer = this.setTimer(() => {
        this.timer = null;
        void this.flush();
      }, this.flushIntervalMs);
    }
  }

  /** Sends what is queued. `keepalive` is used on unload so the batch survives navigation. */
  async flush(options: { keepalive?: boolean } = {}): Promise<void> {
    if (this.timer !== null) {
      this.clearTimer(this.timer);
      this.timer = null;
    }
    if (this.inflight || this.queue.length === 0) return;
    const batch = this.queue.splice(0, this.maxBatch);
    this.inflight = true;
    try {
      const ok = await this.options.transport.send(batch, { keepalive: options.keepalive ?? false });
      if (!ok) {
        // Retry once by re-queuing at the front; a second failure is counted, not hidden.
        if (batch.length + this.queue.length <= this.maxBatch * 4) this.queue.unshift(...batch);
        else this.dropped += batch.length;
      }
    } catch {
      this.dropped += batch.length;
    } finally {
      this.inflight = false;
    }
    if (this.queue.length >= this.maxBatch) void this.flush(options);
  }
}

/** Default transport: POST /v1/telemetry with the bearer; 2xx means accepted. */
export function fetchTransport(baseUrl: string, getToken: () => Promise<string | null>): TelemetryTransport {
  return {
    async send(events, { keepalive }) {
      const token = await getToken();
      if (!token) return false;
      const response = await fetch(`${baseUrl}/v1/telemetry`, {
        method: "POST",
        keepalive,
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ events }),
      });
      return response.ok;
    },
  };
}
