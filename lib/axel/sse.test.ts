import { describe, expect, it } from "vitest";
import { activityLabel, parseAxelFrame, readAxelStream, SseLineParser, type AxelFrame } from "@/lib/axel/sse";

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

describe("SseLineParser", () => {
  it("carries a partial line across chunks and emits one payload per blank-line-terminated event", () => {
    const parser = new SseLineParser();
    expect(parser.push('data: {"content":"Hel')).toEqual([]);
    expect(parser.push('lo"}\n\ndata: {"con')).toEqual(['{"content":"Hello"}']);
    expect(parser.push('tent":" world"}\n\n')).toEqual(['{"content":" world"}']);
  });

  it("skips heartbeats, strips CRLF and joins multi-line data with a newline", () => {
    const parser = new SseLineParser();
    expect(parser.push(": ping\r\n\r\ndata: a\r\ndata: b\r\n\r\n")).toEqual(["a\nb"]);
  });

  it("ignores event and id fields and flushes a trailing event on end", () => {
    const parser = new SseLineParser();
    expect(parser.push("event: message\nid: 7\ndata: last")).toEqual([]);
    expect(parser.end()).toEqual(["last"]);
    expect(parser.end()).toEqual([]);
  });
});

describe("parseAxelFrame", () => {
  it("treats an untyped frame with content as answer text", () => {
    expect(parseAxelFrame('{"content":"Hi"}')).toEqual({ kind: "content", content: "Hi" });
  });

  it("maps the typed frames the adapter relays", () => {
    expect(parseAxelFrame('{"type":"stream_started","stream_id":"s-1"}')).toEqual({
      kind: "stream_started",
      streamId: "s-1",
    });
    expect(parseAxelFrame('{"type":"thread_created","thread_id":"th-1"}')).toEqual({
      kind: "thread_created",
      threadId: "th-1",
    });
    expect(parseAxelFrame('{"type":"attachment","filename":"a.pdf","mimeType":"application/pdf","size":12}')).toEqual({
      kind: "attachment",
      filename: "a.pdf",
      mimeType: "application/pdf",
      size: 12,
    });
    expect(parseAxelFrame('{"type":"error","code":"withheld","error":"switch_off"}')).toEqual({
      kind: "error",
      code: "withheld",
      error: "switch_off",
    });
    expect(parseAxelFrame('{"type":"cancelled","reason":"user"}')).toEqual({ kind: "cancelled", reason: "user" });
    expect(parseAxelFrame('{"type":"xms_suggestion","suggestion":{"id":"sg-1"}}')).toMatchObject({
      kind: "suggestion",
      suggestion: { id: "sg-1" },
    });
    expect(parseAxelFrame('{"type":"tool_call","name":"search_solutions"}')).toEqual({
      kind: "activity",
      type: "tool_call",
      data: { type: "tool_call", name: "search_solutions" },
    });
    expect(parseAxelFrame("[DONE]")).toEqual({ kind: "done" });
  });

  it("returns null for unparsable or shapeless payloads", () => {
    expect(parseAxelFrame("not json")).toBeNull();
    expect(parseAxelFrame("[1,2]")).toBeNull();
    expect(parseAxelFrame('{"foo":1}')).toBeNull();
    expect(parseAxelFrame('{"type":"xms_suggestion"}')).toBeNull();
  });
});

describe("readAxelStream", () => {
  it("dispatches frames in order and stops at [DONE] even when more bytes follow", async () => {
    const frames: AxelFrame[] = [];
    const body = streamOf([
      'data: {"type":"stream_started","stream_id":"s-1"}\n\n',
      'data: {"content":"Hel',
      'lo"}\n\n: keepalive\n\ndata: {"content":" there"}\n\n',
      'data: [DONE]\n\ndata: {"content":"ignored"}\n\n',
    ]);
    await readAxelStream(body, (frame) => frames.push(frame));
    expect(frames).toEqual([
      { kind: "stream_started", streamId: "s-1" },
      { kind: "content", content: "Hello" },
      { kind: "content", content: " there" },
      { kind: "done" },
    ]);
  });

  it("flushes a final event when the body ends without a blank line", async () => {
    const frames: AxelFrame[] = [];
    await readAxelStream(streamOf(['data: {"content":"tail"}']), (frame) => frames.push(frame));
    expect(frames).toEqual([{ kind: "content", content: "tail" }]);
  });
});

describe("activityLabel", () => {
  it("names the tool and never echoes payload text", () => {
    expect(activityLabel("tool_call", { name: "search_solutions", args: { query: "secret" } })).toBe(
      "Calling search_solutions",
    );
    expect(activityLabel("tool_result", { tool: "search_solutions" })).toBe("search_solutions answered");
    expect(activityLabel("thinking", {})).toBe("Thinking");
    expect(activityLabel("todo_update", {})).toBe("Updating the plan");
    expect(activityLabel("some_new_thing", {})).toBe("some new thing");
  });
});
