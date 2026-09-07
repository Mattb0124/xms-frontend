"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getBearerToken } from "@/lib/auth/token";
import { activityLabel, readAxelStream, type AxelFrame } from "@/lib/axel/sse";
import { API_BASE_URL } from "@/redux/api";
import type { SuggestionView } from "@/redux/aiApi";

export type TranscriptItem =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "assistant"; text: string }
  | { id: string; kind: "activity"; label: string }
  | { id: string; kind: "attachment"; filename: string; mimeType: string; size: number }
  | { id: string; kind: "notice"; code: string; text: string }
  | { id: string; kind: "suggestion"; suggestion: SuggestionView };

export interface AxelTurnOptions {
  ticketId: string;
  /** The thread to continue; null starts a new one. */
  initialThreadId?: string | null;
  endpoint?: string;
  getToken?: () => Promise<string | null>;
  onSuggestion?: (suggestion: SuggestionView) => void;
  onThreadCreated?: (threadId: string) => void;
}

export interface AxelTurn {
  items: TranscriptItem[];
  streaming: boolean;
  streamId: string | null;
  threadId: string | null;
  /** Set when the turn could not run at all; every human control stays usable. */
  unavailable: boolean;
  send: (message: string) => Promise<void>;
  cancel: () => Promise<void>;
  /** Switches to another thread (or a new one) and clears the transcript. */
  resume: (threadId: string | null) => void;
}

let counter = 0;
const nextId = () => `t${++counter}`;

/** The human-readable notice for an error frame. */
export function noticeText(code: string, error: string): string {
  switch (code) {
    case "withheld":
      return `Axel withheld this turn: ${error.replace(/_/g, " ")}.`;
    case "unavailable":
      return "Axel is unavailable. Everything else on this ticket still works.";
    case "not_found":
      return "This ticket is not visible to Axel.";
    default:
      return error || `Axel reported ${code}.`;
  }
}

/**
 * One assistant turn at a time against `POST /v1/axel/turns`: the answer
 * text streams into the last assistant item, activity frames become muted
 * lines, attachments become metadata rows, `xms_suggestion` frames become
 * cards and error frames inline notices. Cancel asks the adapter to stop
 * the stream and aborts the read; unmounting aborts too.
 */
export function useAxelTurn(options: AxelTurnOptions): AxelTurn {
  const { ticketId, endpoint = API_BASE_URL, getToken = getBearerToken, onSuggestion, onThreadCreated } = options;
  const [items, setItems] = useState<TranscriptItem[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(options.initialThreadId ?? null);
  const [unavailable, setUnavailable] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const streamRef = useRef<string | null>(null);
  const threadRef = useRef<string | null>(options.initialThreadId ?? null);
  const callbacks = useRef({ onSuggestion, onThreadCreated });
  useEffect(() => {
    callbacks.current = { onSuggestion, onThreadCreated };
  }, [onSuggestion, onThreadCreated]);

  useEffect(() => () => controller.current?.abort(), []);

  const append = useCallback((item: TranscriptItem) => setItems((current) => [...current, item]), []);
  const appendText = useCallback(
    (assistantId: string, content: string) =>
      setItems((current) =>
        current.map((item) =>
          item.id === assistantId && item.kind === "assistant" ? { ...item, text: item.text + content } : item,
        ),
      ),
    [],
  );

  const send = useCallback(
    async (message: string) => {
      const text = message.trim();
      if (!text || controller.current) return;
      const abort = new AbortController();
      controller.current = abort;
      const assistantId = nextId();
      setItems((current) => [
        ...current,
        { id: nextId(), kind: "user", text },
        { id: assistantId, kind: "assistant", text: "" },
      ]);
      setStreaming(true);
      setUnavailable(false);
      let cancelledSeen = false;
      const onFrame = (frame: AxelFrame) => {
        switch (frame.kind) {
          case "content":
            appendText(assistantId, frame.content);
            return;
          case "stream_started":
            streamRef.current = frame.streamId;
            setStreamId(frame.streamId);
            return;
          case "thread_created":
            threadRef.current = frame.threadId;
            setThreadId(frame.threadId);
            callbacks.current.onThreadCreated?.(frame.threadId);
            return;
          case "attachment":
            append({
              id: nextId(),
              kind: "attachment",
              filename: frame.filename,
              mimeType: frame.mimeType,
              size: frame.size,
            });
            return;
          case "error":
            if (frame.code === "unavailable") setUnavailable(true);
            append({ id: nextId(), kind: "notice", code: frame.code, text: noticeText(frame.code, frame.error) });
            return;
          case "suggestion":
            append({ id: nextId(), kind: "suggestion", suggestion: frame.suggestion });
            callbacks.current.onSuggestion?.(frame.suggestion);
            return;
          case "cancelled":
            cancelledSeen = true;
            append({ id: nextId(), kind: "notice", code: "cancelled", text: "Cancelled." });
            return;
          case "activity":
            append({ id: nextId(), kind: "activity", label: activityLabel(frame.type, frame.data) });
            return;
          default:
            return;
        }
      };
      try {
        const token = await getToken();
        const response = await fetch(`${endpoint}/v1/axel/turns`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "text/event-stream",
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            agent: "desk_assistant",
            message: text,
            ticket_id: ticketId,
            ...(threadRef.current ? { thread_id: threadRef.current } : {}),
          }),
          signal: abort.signal,
        });
        if (!response.ok || !response.body) {
          setUnavailable(true);
          append({ id: nextId(), kind: "notice", code: "unavailable", text: noticeText("unavailable", "") });
          return;
        }
        await readAxelStream(response.body, onFrame, abort.signal);
        if (abort.signal.aborted && !cancelledSeen)
          append({ id: nextId(), kind: "notice", code: "cancelled", text: "Cancelled." });
      } catch (error) {
        if (abort.signal.aborted) {
          if (!cancelledSeen) append({ id: nextId(), kind: "notice", code: "cancelled", text: "Cancelled." });
        } else {
          setUnavailable(true);
          append({
            id: nextId(),
            kind: "notice",
            code: "unavailable",
            text: noticeText("unavailable", (error as Error).message),
          });
        }
      } finally {
        if (controller.current === abort) controller.current = null;
        streamRef.current = null;
        setStreamId(null);
        setStreaming(false);
      }
    },
    [append, appendText, endpoint, getToken, ticketId],
  );

  const cancel = useCallback(async () => {
    const active = controller.current;
    const id = streamRef.current;
    if (!active) return;
    if (id) {
      try {
        const token = await getToken();
        await fetch(`${endpoint}/v1/axel/turns/${encodeURIComponent(id)}/cancel`, {
          method: "POST",
          headers: token ? { authorization: `Bearer ${token}` } : {},
        });
      } catch {
        // the abort below still stops the read
      }
    }
    active.abort();
  }, [endpoint, getToken]);

  const resume = useCallback((next: string | null) => {
    controller.current?.abort();
    threadRef.current = next;
    setThreadId(next);
    setItems([]);
    setUnavailable(false);
  }, []);

  return { items, streaming, streamId, threadId, unavailable, send, cancel, resume };
}
