"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AxelSuggestionCard } from "@/components/axel/suggestion-card";
import { decisionPermission } from "@/components/tickets/suggestions-strip";
import { ArrowUpIcon, ChevronDownIcon, CloseIcon, ICON, PlusIcon, StopIcon } from "@/components/xms/icons";
import { useAxelTurn, type TranscriptItem } from "@/lib/axel/use-axel-turn";
import { useAxelThreadsQuery, type AiCapability } from "@/redux/aiApi";
import { useMe } from "@/redux/me";
import { cn } from "@/lib/utils";

export interface AxelChatProps {
  /** The ticket the turn runs against, or null where there is no ticket in context. */
  ticketId: string | null;
  /** The key the greeting names, and the record a decision refetches. */
  ticketKey?: string;
  onClose: () => void;
}

/**
 * The three prompts under the greeting. They are capabilities the adapter
 * actually carries (AI functionality technical section 4), worded as a person
 * would ask for them, and each is sent as an ordinary message: nothing here
 * reaches a route the composer could not reach.
 */
const QUICK_STARTS = ["Summarize this ticket", "Draft a reply to the requester", "Find similar tickets and solutions"];

/** One kilobyte, two, then megabytes: the size beside an attachment's name. */
function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "Matt Brown" to "Matt", which is how the greeting reads. */
function firstName(displayName: string | undefined): string {
  return (displayName ?? "").trim().split(/\s+/)[0] ?? "";
}

/**
 * The full-screen Axel surface (AIBL-321), built to the AIXelerator reference
 * Matt supplied on 2026-09-11: everything below the finder bar, edge to edge,
 * with the bar itself left live above it so the reader can navigate away
 * without closing Axel first.
 *
 * The shape is the reference's. "New chat" and the conversations behind it on
 * the left, close on the right; the greeting, its sentence and the quick starts
 * centered in the space above; one composer docked at the bottom, which is the
 * same composer whether the conversation has started or not.
 *
 * It renders every kind `useAxelTurn` already produces. Nothing invents a frame
 * for something the stream does not send: the activity lines, the attachments
 * and the notices are the adapter's own, and a suggestion is the same card the
 * ticket's strip and panel draw, so a decision made here is the decision the
 * record shows.
 */
export function AxelChat({ ticketId, ticketKey, onClose }: AxelChatProps) {
  const me = useMe();
  const turn = useAxelTurn({ ticketId: ticketId ?? "" });
  const { items, streaming, threadId, send, cancel, resume } = turn;
  const scroller = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLDivElement>(null);
  const [threadsOpen, setThreadsOpen] = useState(false);

  // The conversations already held against this ticket. The picker behind
  // "New chat" is drawn only when there is something in it, so a chevron
  // never opens an empty menu.
  const { data: threads } = useAxelThreadsQuery(ticketId ?? "", { skip: !ticketId });
  const earlier = useMemo(() => (threads ?? []).filter((thread) => thread.thread_id !== threadId), [threads, threadId]);

  // Escape closes: the picker first if it is open, then the surface. The
  // shell's own Escape handler closes the finder and the palette, which are
  // not up while Axel is, so this one stops here rather than letting both fire.
  const onKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      if (threadsOpen) {
        setThreadsOpen(false);
        return;
      }
      onClose();
    },
    [onClose, threadsOpen],
  );
  useEffect(() => {
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onKey]);

  // Opening Axel moves the reader to a new surface, so the surface says its
  // own name first. Without this the focus stays on the header button and a
  // screen reader announces nothing at all.
  useEffect(() => heading.current?.focus(), []);

  // Follow the answer as it streams. `scrollTop` rather than scrollIntoView,
  // which on a fixed surface scrolls the document behind it as well.
  useEffect(() => {
    const node = scroller.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [items]);

  const started = items.length > 0;
  // The pill carries the conversation's own name, and "New chat" until the
  // adapter has opened one, which is what the reference's thread picker shows.
  const currentTitle = (threads ?? []).find((thread) => thread.thread_id === threadId)?.title ?? "New chat";
  const name = firstName(me.principal?.displayName);
  const greeting = name ? `Hey ${name}, I'm Axel.` : "Hi, I'm Axel.";

  return (
    <section className="xms-axel-full aibl-chat-min" aria-label="Axel" data-testid="axel-full">
      {/* The reference's conversation header: the thread pill on the left, the
          window controls on the right, one hairline under it. The sparkle and
          the title the docked panel carries are not repeated, because the
          button that opened this is still lit on the bar directly above.

          The reference also carries a debug-log control and a collapse to the
          corner panel. Neither is drawn: there is no debug panel in XMS, and
          the surface was asked for as full screen only, so a collapse would be
          a control with nowhere to go. */}
      <header data-chat-el="info-bar">
        <div className="relative flex min-w-0 items-center">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={threadsOpen}
            onClick={() => setThreadsOpen((open) => !open)}
            data-chat-el="thread-picker"
            data-testid="axel-thread-pill"
          >
            <span className="flex-1 truncate text-left">{currentTitle}</span>
            {/* The reference draws this at 12px. The icon scale here starts at
                14 and surfaces.test.tsx pins both that floor and the rule that
                the scale is the only way to size a mark, so the chevron keeps
                the scale and is 2px over. The type around it is the reference's;
                only this glyph is not. */}
            <ChevronDownIcon size={ICON.glyph} />
          </button>
          {threadsOpen ? (
            <ul
              role="menu"
              className="xms-card absolute top-[34px] left-0 z-10 max-h-[360px] w-[260px] overflow-y-auto"
              data-testid="axel-threads"
            >
              {/* The reference's first row, and the only one there is until a
                  conversation has been held against this ticket. */}
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    resume(null);
                    setThreadsOpen(false);
                  }}
                  className="border-xms-line hover:bg-xms-row-hover w-full border-b px-3 py-[10px] text-left"
                >
                  <span className="text-xms-ink block text-body font-semibold">New conversation</span>
                  <span className="text-xms-muted mt-[2px] block text-body">Start again from nothing</span>
                </button>
              </li>
              {earlier.map((thread) => (
                <li key={thread.thread_id} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      resume(thread.thread_id);
                      setThreadsOpen(false);
                    }}
                    className="border-xms-line text-xms-ink hover:bg-xms-row-hover w-full truncate border-b px-3 py-[10px] text-left text-body last:border-b-0"
                  >
                    {thread.title ?? "Untitled conversation"}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <button
          type="button"
          aria-label="Close"
          title="Close"
          onClick={onClose}
          data-chat-el="window-control"
          className="ml-auto"
        >
          <CloseIcon size={ICON.glyph} />
        </button>
      </header>

      {/* The space above the composer: the greeting while nothing has been
          asked, the conversation once something has. */}
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-5">
        {started ? (
          <div className="xms-axel-column flex flex-col gap-4 py-6">
            {items.map((item) => (
              <TranscriptRow
                key={item.id}
                item={item}
                ticketKey={ticketKey}
                // The same per-capability gate the ticket's own strip applies,
                // so a card offered in the chat is decidable exactly where it
                // would be decidable on the record and nowhere else.
                canDecide={(capability) => me.hasPermission(decisionPermission(capability))}
                streaming={streaming}
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-full flex-col items-center justify-center py-12 text-center">
            <div
              ref={heading}
              tabIndex={-1}
              role="heading"
              aria-level={2}
              data-chat-el="welcome-title"
              className="outline-none"
            >
              {greeting}
            </div>
            <p data-chat-el="welcome-subtitle">
              {ticketKey
                ? `Ask me anything about ${ticketKey}. I can summarize the thread, draft a reply, suggest a category and a priority, and find similar tickets and published solutions. Nothing I propose is applied until you accept it.`
                : "Open a ticket and ask me about it. I can summarize the thread, draft a reply, suggest a category and a priority, and find similar tickets and published solutions."}
            </p>
            {ticketId ? (
              <div data-chat-el="quick-starts">
                {QUICK_STARTS.map((prompt) => (
                  <button key={prompt} type="button" onClick={() => void send(prompt)} data-chat-el="quick-start">
                    {prompt}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* One composer, docked, whether or not the conversation has started. */}
      <div className="xms-axel-dock">
        <Composer disabled={!ticketId} streaming={streaming} onSend={send} onStop={cancel} />
      </div>
    </section>
  );
}

function TranscriptRow({
  item,
  ticketKey,
  canDecide,
  streaming,
}: {
  item: TranscriptItem;
  ticketKey?: string;
  canDecide: (capability: AiCapability) => boolean;
  streaming: boolean;
}) {
  switch (item.kind) {
    case "user":
      return (
        <p data-chat-el="user-bubble" className="ml-auto max-w-[80%] w-fit whitespace-pre-wrap">
          {item.text}
        </p>
      );
    case "assistant":
      // An empty assistant item is the one that is about to be written into,
      // so it says the turn has started rather than drawing a blank line.
      return item.text ? (
        <p data-chat-el="assistant-body" className="whitespace-pre-wrap">
          {item.text}
        </p>
      ) : streaming ? (
        <p data-chat-el="work-trace">Working...</p>
      ) : null;
    case "activity":
      return <p data-chat-el="work-trace">{item.label}</p>;
    case "attachment":
      return (
        <p data-chat-el="work-trace">
          {item.filename} {fileSize(item.size)}
        </p>
      );
    case "notice":
      return (
        <p
          className="border-xms-note-line bg-xms-note-bg text-xms-note-ink rounded-card border p-3 text-body"
          data-code={item.code}
        >
          {item.text}
        </p>
      );
    case "suggestion":
      return (
        <AxelSuggestionCard
          suggestion={item.suggestion}
          ticketKey={ticketKey}
          canDecide={canDecide(item.suggestion.capability)}
          source="panel"
        />
      );
    default:
      return null;
  }
}

/**
 * The composer: an auto-growing field in a pill, with one round button that is
 * send until a turn starts and stop while it runs. Enter sends, Shift+Enter
 * takes a new line, which is the convention every chat in the building uses.
 *
 * The plus is the reference's attach affordance. A ticket's files are added on
 * its own Attachments card, which scans them before anything may read them, so
 * the mark is drawn where the reference draws it and says where to go rather
 * than opening a second upload path around the scanner.
 */
function Composer({
  disabled,
  streaming,
  onSend,
  onStop,
  className,
}: {
  disabled: boolean;
  streaming: boolean;
  onSend: (message: string) => void;
  onStop: () => void;
  className?: string;
}) {
  const [value, setValue] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);

  const grow = useCallback(() => {
    const node = field.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }, []);

  const submit = useCallback(() => {
    const text = value.trim();
    if (!text || streaming || disabled) return;
    onSend(text);
    setValue("");
    requestAnimationFrame(() => {
      const node = field.current;
      if (!node) return;
      node.style.height = "auto";
      node.focus();
    });
  }, [value, streaming, disabled, onSend]);

  return (
    <div className={cn("xms-axel-column", className)}>
      <div data-chat-el="composer">
        <span
          aria-hidden
          title="Files are added on the ticket's Attachments card, which scans them first"
          data-chat-el="composer-attach"
        >
          <PlusIcon size={ICON.row} />
        </span>
        <label className="sr-only" htmlFor="axel-chat-field">
          Ask Axel
        </label>
        <textarea
          id="axel-chat-field"
          // The hook is what keeps the scope's sunken-field recipe off it: a
          // composer is a pill, not a well, and the vendored skin draws it.
          data-chat-el="composer-field"
          ref={field}
          rows={1}
          value={value}
          disabled={disabled}
          onChange={(event) => {
            setValue(event.target.value);
            grow();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Ask Axel"
        />
        {streaming ? (
          <button type="button" onClick={onStop} aria-label="Stop" data-chat-el="composer-send">
            <StopIcon size={ICON.row} />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={disabled || !value.trim()}
            aria-label="Send"
            data-chat-el="composer-send"
          >
            <ArrowUpIcon size={ICON.row} />
          </button>
        )}
      </div>
      {/* The turn route takes a ticket and nothing else, so a chat opened off
          a record says why it cannot send rather than failing on submit. */}
      <p data-chat-el="composer-note">
        {disabled
          ? "Axel answers against a ticket. Open one and ask from there."
          : "Answers can be wrong. Nothing applies without a click, and every accept, edit and reject lands in Activity."}
      </p>
    </div>
  );
}
