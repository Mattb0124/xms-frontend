import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { noticeText, useAxelTurn } from "@/lib/axel/use-axel-turn";

interface Recorded {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

function sse(frames: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(`data: ${frame}\n\n`));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
}

/** A hanging stream that only closes when cancelled, to exercise Cancel. */
function openStream(): { response: Response; opened: Promise<void> } {
  let opened: () => void = () => undefined;
  const wait = new Promise<void>((resolve) => (opened = resolve));
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"type":"stream_started","stream_id":"s-9"}\n\n'));
      opened();
    },
  });
  return { response: new Response(stream, { status: 200 }), opened: wait };
}

function stub(handler: (call: Recorded) => Response | Promise<Response>): Recorded[] {
  const calls: Recorded[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const call: Recorded = {
        url,
        method: init?.method ?? "GET",
        headers: (init?.headers as Record<string, string>) ?? {},
        body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
      };
      calls.push(call);
      return handler(call);
    }),
  );
  return calls;
}

const options = { ticketId: "t-1", endpoint: "http://api.test", getToken: async () => "tok" };

describe("useAxelTurn", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts the turn with the bearer, streams the answer, keeps the thread id and renders every frame kind", async () => {
    const calls = stub(() =>
      sse([
        '{"type":"stream_started","stream_id":"s-1"}',
        '{"type":"thread_created","thread_id":"th-1"}',
        '{"type":"thinking"}',
        '{"type":"tool_call","name":"search_solutions"}',
        '{"content":"The ticket "}',
        '{"content":"is about HFM."}',
        '{"type":"attachment","filename":"notes.md","mimeType":"text/markdown","size":120}',
        '{"type":"xms_suggestion","suggestion":{"id":"sg-1","capability":"summarise","status":"offered","payload":{}}}',
        "[DONE]",
      ]),
    );
    const onSuggestion = vi.fn();
    const onThreadCreated = vi.fn();
    const { result } = renderHook(() => useAxelTurn({ ...options, onSuggestion, onThreadCreated }));
    await act(async () => {
      await result.current.send("  What is this about?  ");
    });
    expect(calls[0]).toMatchObject({
      url: "http://api.test/v1/axel/turns",
      method: "POST",
      headers: { authorization: "Bearer tok", accept: "text/event-stream" },
      body: { agent: "desk_assistant", message: "What is this about?", ticket_id: "t-1" },
    });
    expect(calls[0].body).not.toHaveProperty("thread_id");
    const kinds = result.current.items.map((item) => item.kind);
    expect(kinds).toEqual(["user", "assistant", "activity", "activity", "attachment", "suggestion"]);
    expect(result.current.items[1]).toMatchObject({ kind: "assistant", text: "The ticket is about HFM." });
    expect(result.current.items[3]).toMatchObject({ kind: "activity", label: "Calling search_solutions" });
    expect(result.current.items[4]).toMatchObject({ kind: "attachment", filename: "notes.md", size: 120 });
    expect(onSuggestion).toHaveBeenCalledWith(expect.objectContaining({ id: "sg-1" }));
    expect(onThreadCreated).toHaveBeenCalledWith("th-1");
    expect(result.current.threadId).toBe("th-1");
    expect(result.current.streaming).toBe(false);
    expect(result.current.streamId).toBeNull();
    expect(result.current.unavailable).toBe(false);

    await act(async () => {
      await result.current.send("And next?");
    });
    expect(calls[1].body).toMatchObject({ thread_id: "th-1", message: "And next?" });
  });

  it("shows an error frame as an inline notice and marks unavailable only for the unavailable code", async () => {
    stub(() => sse(['{"type":"error","code":"withheld","error":"switch_off"}', "[DONE]"]));
    const { result } = renderHook(() => useAxelTurn(options));
    await act(async () => {
      await result.current.send("hi");
    });
    expect(result.current.items.at(-1)).toMatchObject({
      kind: "notice",
      code: "withheld",
      text: "Axel withheld this turn: switch off.",
    });
    expect(result.current.unavailable).toBe(false);
  });

  it("marks Axel unavailable when the request fails, without throwing", async () => {
    stub(() => new Response(JSON.stringify({ code: "harness_down" }), { status: 502 }));
    const { result } = renderHook(() => useAxelTurn(options));
    await act(async () => {
      await result.current.send("hi");
    });
    expect(result.current.unavailable).toBe(true);
    expect(result.current.items.at(-1)).toMatchObject({ kind: "notice", code: "unavailable" });
    expect(result.current.streaming).toBe(false);
  });

  it("cancel posts to the cancel route with the stream id and ends the turn", async () => {
    const open = openStream();
    const calls = stub((call) => (call.url.endsWith("/cancel") ? new Response("{}") : open.response));
    const { result } = renderHook(() => useAxelTurn(options));
    let sending: Promise<void> = Promise.resolve();
    act(() => {
      sending = result.current.send("hi");
    });
    await open.opened;
    await waitFor(() => expect(result.current.streamId).toBe("s-9"));
    expect(result.current.streaming).toBe(true);
    await act(async () => {
      await result.current.cancel();
      await sending;
    });
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      "POST http://api.test/v1/axel/turns",
      "POST http://api.test/v1/axel/turns/s-9/cancel",
    ]);
    expect(result.current.streaming).toBe(false);
    expect(result.current.items.at(-1)).toMatchObject({ kind: "notice", code: "cancelled" });
  });

  it("aborts the in-flight read on unmount", async () => {
    const open = openStream();
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        signal = init?.signal ?? undefined;
        return open.response;
      }),
    );
    const { result, unmount } = renderHook(() => useAxelTurn(options));
    act(() => {
      void result.current.send("hi");
    });
    await open.opened;
    await waitFor(() => expect(signal).toBeDefined());
    unmount();
    expect(signal?.aborted).toBe(true);
  });

  it("resume switches thread and clears the transcript; send carries the chosen thread", async () => {
    const calls = stub(() => sse(['{"content":"ok"}', "[DONE]"]));
    const { result } = renderHook(() => useAxelTurn(options));
    await act(async () => {
      await result.current.send("first");
    });
    expect(result.current.items).toHaveLength(2);
    act(() => result.current.resume("th-old"));
    expect(result.current.items).toEqual([]);
    expect(result.current.threadId).toBe("th-old");
    await act(async () => {
      await result.current.send("again");
    });
    expect(calls[1].body).toMatchObject({ thread_id: "th-old" });
  });

  it("writes the notice copy per code", () => {
    expect(noticeText("unavailable", "x")).toBe("Axel is unavailable. Everything else on this ticket still works.");
    expect(noticeText("not_found", "")).toBe("This ticket is not visible to Axel.");
    expect(noticeText("odd", "")).toBe("Axel reported odd.");
  });
});
