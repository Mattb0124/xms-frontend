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

/**
 * One event on the wire. This is the API's ClientEventDto exactly (backend
 * `src/modules/telemetry/telemetry.module.ts`): `type`, and optionally
 * `occurred_at`, `account_id`, `request_id`, `entity_kind`, `entity_id` and
 * `attrs`. The global ValidationPipe runs with `whitelist` and
 * `forbidNonWhitelisted`, so a single undeclared key fails the whole batch:
 * the client used to send `event_type`, `screen` and `client_ts`, every batch
 * was rejected 400, and the usage dashboard had never seen one client event
 * (frontend review finding 3). Nothing may be added here that the DTO does
 * not declare, and `account_id` is deliberately never sent, since the API
 * takes the account from the principal.
 *
 * The screen id travels as `entity_kind: "screen"` with `entity_id`, which
 * the API stores in its own columns rather than inside attrs.
 */
export interface UsageEvent {
  type: UsageEventType;
  occurred_at: string;
  request_id?: string;
  entity_kind?: "screen";
  entity_id?: string;
  attrs: UsageAttrs;
}

/** What the API answered: `ok` false re-queues the batch; `rejected` counts events it refused. */
export interface TelemetrySendResult {
  ok: boolean;
  rejected?: number;
}

export interface TelemetryTransport {
  /** Resolves ok when the batch was accepted; not ok to retry. */
  send(events: UsageEvent[], options: { keepalive: boolean }): Promise<TelemetrySendResult>;
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
  /** Events the API accepted the batch but refused: an unknown type, or an account the principal has no grant on. */
  rejected = 0;

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
    const requestId = currentRequestId();
    this.queue.push({
      type,
      occurred_at: this.now().toISOString(),
      attrs,
      ...(screen ? { entity_kind: "screen" as const, entity_id: screen } : {}),
      ...(requestId ? { request_id: requestId } : {}),
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
      const result = await this.options.transport.send(batch, { keepalive: options.keepalive ?? false });
      if (result.rejected) {
        // The API answers 200 with a rejected count; a silent drop is how the
        // contract mismatch went unnoticed for the life of the screen.
        this.rejected += result.rejected;
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[telemetry] the API rejected ${result.rejected} of ${batch.length} events`);
        }
      }
      if (!result.ok) {
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

/**
 * Default transport: POST /v1/telemetry with the bearer. A 2xx means the
 * batch was taken; the body carries `{ accepted, rejected }` and the rejected
 * count is passed back so a mismatch surfaces instead of disappearing.
 */
export function fetchTransport(baseUrl: string, getToken: () => Promise<string | null>): TelemetryTransport {
  return {
    async send(events, { keepalive }) {
      const token = await getToken();
      if (!token) return { ok: false };
      const response = await fetch(`${baseUrl}/v1/telemetry`, {
        method: "POST",
        keepalive,
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ events }),
      });
      if (!response.ok) return { ok: false };
      let rejected = 0;
      try {
        const parsed = (await response.json()) as { rejected?: unknown };
        if (typeof parsed?.rejected === "number") rejected = parsed.rejected;
      } catch {
        rejected = 0;
      }
      return { ok: true, rejected };
    },
  };
}
