import type { SuggestionView } from "@/redux/aiApi";

/**
 * The Axel turn stream (AI functionality technical section 4; AI Integration
 * section 3). The adapter answers `POST /v1/axel/turns` with
 * `text/event-stream`; every event is `data: <json>\n\n`, a line starting
 * with `:` is a heartbeat, and `data: [DONE]` ends the turn. A frame with
 * `content` and no `type` is answer text to concatenate. EventSource cannot
 * send a body, so the body stream is read here with a small line parser.
 */
export type AxelFrame =
  | { kind: "content"; content: string }
  | { kind: "stream_started"; streamId: string }
  | { kind: "thread_created"; threadId: string }
  | { kind: "attachment"; filename: string; mimeType: string; size: number }
  | { kind: "error"; code: string; error: string }
  | { kind: "suggestion"; suggestion: SuggestionView }
  | { kind: "cancelled"; reason: string | null }
  | { kind: "activity"; type: string; data: Record<string, unknown> }
  | { kind: "done" };

/**
 * Turns arbitrary chunks into the `data` payload of each complete event.
 * Chunks may split a line anywhere; the partial tail is carried to the next
 * push. Several `data:` lines in one event join with a newline (the SSE rule).
 */
export class SseLineParser {
  private tail = "";
  private dataLines: string[] = [];

  push(chunk: string): string[] {
    const events: string[] = [];
    const text = this.tail + chunk;
    const lines = text.split("\n");
    this.tail = lines.pop() ?? "";
    for (const raw of lines) {
      const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
      if (line === "") {
        if (this.dataLines.length > 0) {
          events.push(this.dataLines.join("\n"));
          this.dataLines = [];
        }
        continue;
      }
      if (line.startsWith(":")) continue;
      if (line.startsWith("data:")) {
        const value = line.slice(5);
        this.dataLines.push(value.startsWith(" ") ? value.slice(1) : value);
      }
      // event:, id:, retry: and unknown fields carry nothing the panel needs.
    }
    return events;
  }

  /** Flushes a final event that was not followed by a blank line. */
  end(): string[] {
    const events: string[] = [];
    if (this.tail) {
      events.push(...this.push("\n"));
      this.tail = "";
    }
    if (this.dataLines.length > 0) {
      events.push(this.dataLines.join("\n"));
      this.dataLines = [];
    }
    return events;
  }
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : value === undefined || value === null ? fallback : String(value);
}

/** One event payload to a typed frame; null when it is not JSON the panel can use. */
export function parseAxelFrame(data: string): AxelFrame | null {
  const trimmed = data.trim();
  if (trimmed === "[DONE]") return { kind: "done" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const frame = parsed as Record<string, unknown>;
  const type = typeof frame.type === "string" ? frame.type : undefined;
  if (!type) {
    return typeof frame.content === "string" ? { kind: "content", content: frame.content } : null;
  }
  switch (type) {
    case "stream_started":
      return { kind: "stream_started", streamId: asString(frame.stream_id) };
    case "thread_created":
      return { kind: "thread_created", threadId: asString(frame.thread_id) };
    case "attachment":
      return {
        kind: "attachment",
        filename: asString(frame.filename, "file"),
        mimeType: asString(frame.mimeType),
        size: typeof frame.size === "number" ? frame.size : 0,
      };
    case "error":
      return { kind: "error", code: asString(frame.code, "error"), error: asString(frame.error) };
    case "xms_suggestion":
      return typeof frame.suggestion === "object" && frame.suggestion !== null
        ? { kind: "suggestion", suggestion: frame.suggestion as SuggestionView }
        : null;
    case "cancelled":
      return { kind: "cancelled", reason: typeof frame.reason === "string" ? frame.reason : null };
    default:
      return { kind: "activity", type, data: frame };
  }
}

/**
 * Reads a turn's body stream to completion, calling `onFrame` for every
 * typed frame in order, and resolves after `[DONE]` or the end of the body.
 * Aborting the signal cancels the reader; the caller decides what to show.
 */
export async function readAxelStream(
  body: ReadableStream<Uint8Array>,
  onFrame: (frame: AxelFrame) => void,
  signal?: AbortSignal,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = new SseLineParser();
  const onAbort = () => void reader.cancel().catch(() => undefined);
  signal?.addEventListener("abort", onAbort);
  const dispatch = (events: string[]): boolean => {
    for (const event of events) {
      const frame = parseAxelFrame(event);
      if (!frame) continue;
      onFrame(frame);
      if (frame.kind === "done") return true;
    }
    return false;
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (dispatch(parser.push(decoder.decode(value, { stream: true })))) return;
    }
    dispatch(parser.end());
  } finally {
    signal?.removeEventListener("abort", onAbort);
    reader.releaseLock();
  }
}

/** A muted one-line label for an activity frame; identifiers only, never ticket text. */
export function activityLabel(type: string, data: Record<string, unknown>): string {
  const name = asString(data.name ?? data.tool ?? data.tool_name ?? data.function);
  switch (type) {
    case "thinking":
      return "Thinking";
    case "tool_call":
      return name ? `Calling ${name}` : "Calling a tool";
    case "tool_result":
      return name ? `${name} answered` : "Tool answered";
    case "todo_update":
      return "Updating the plan";
    case "delegation":
      return "Delegating";
    default:
      return type.replace(/_/g, " ");
  }
}
