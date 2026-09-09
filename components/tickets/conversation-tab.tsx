"use client";

import { useState, type ReactNode } from "react";
import { DropZone, ScanAcknowledgement, UploadList, useUploads } from "@/components/tickets/attachments";
import { Skeleton } from "@/components/xms/skeleton";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import { useTrack } from "@/lib/telemetry/provider";
import { cn } from "@/lib/utils";
import { useGetTicketEmailQuery } from "@/redux/emailApi";
import {
  useAddCommentMutation,
  useAddWorkNoteMutation,
  useGetTimelineQuery,
  type TimelineItem,
} from "@/redux/ticketsApi";

export type ComposerMode = "reply" | "note";

export interface ComposerProps {
  onSend: (mode: ComposerMode, body: string) => Promise<void>;
  pending?: boolean;
  recipientLine: string;
  readOnly?: boolean;
  /** Attachment controls rendered between the text and the footer. */
  attachments?: ReactNode;
  /** When set, Send is disabled and this reason is shown (a scan is pending). */
  blockedReason?: string;
  onModeChange?: (mode: ComposerMode) => void;
}

/** The composer with its Public reply / Work note toggle (Wireframes v2 section 3.2). */
export function Composer({
  onSend,
  pending,
  recipientLine,
  readOnly,
  attachments,
  blockedReason,
  onModeChange,
}: ComposerProps) {
  const [mode, setModeState] = useState<ComposerMode>("reply");
  const setMode = (next: ComposerMode) => {
    setModeState(next);
    onModeChange?.(next);
  };
  const [body, setBody] = useState("");
  const note = mode === "note";
  return (
    <form
      aria-label="Composer"
      data-mode={mode}
      // The prototype's composer (`proto-v3/template.pretty.html`): a card at
      // a 5px radius whose header stands on the quiet ground, not the record's
      // own 6px card with a tinted body for a note.
      className={cn(
        "border-xms-line bg-xms-card flex flex-col overflow-hidden rounded-[5px] border",
        note && "border-xms-line-strong",
      )}
      onSubmit={async (event) => {
        event.preventDefault();
        if (!body.trim() || blockedReason) return;
        await onSend(mode, body.trim());
        setBody("");
      }}
    >
      <div
        className="border-xms-line bg-xms-quiet-bg flex items-center gap-2 border-b px-[14px] py-3"
        role="tablist"
        aria-label="Composer mode"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "reply"}
          onClick={() => setMode("reply")}
          className={cn(
            "rounded-[999px] px-[13px] py-[7px] text-[12px] leading-none",
            mode === "reply"
              ? "bg-xms-accent font-semibold text-white"
              : "text-xms-body hover:bg-xms-row-hover font-medium",
          )}
        >
          Public reply
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={note}
          onClick={() => setMode("note")}
          className={cn(
            "rounded-[999px] px-[13px] py-[7px] text-[12px] leading-none",
            note ? "bg-xms-navy font-semibold text-white" : "text-xms-body hover:bg-xms-row-hover font-medium",
          )}
        >
          Work note
        </button>
        {note ? <span className="xms-caption ml-2">Internal, never leaves</span> : null}
        {/* Draft with Axel and Template sit on the right of the composer's own
            header in the render (02). Neither has a route behind it yet: the
            Axel turn surface is held and there is no template catalog, so both
            are drawn disabled with the reason on them rather than as controls
            that do nothing when clicked. */}
        <span className="ml-auto flex items-center gap-2">
          <button
            type="button"
            disabled
            title="The Axel drafting turn is not wired yet."
            className="border-xms-note-line bg-xms-quiet-fill text-xms-body rounded-[4px] border px-[11px] py-[7px] text-[12px] leading-none font-medium disabled:opacity-50"
          >
            Draft with Axel
          </button>
          <button
            type="button"
            disabled
            title="There is no reply template catalog on the API yet."
            className="border-xms-line-strong bg-xms-card text-xms-body rounded-[4px] border px-[11px] py-[7px] text-[12px] leading-none font-medium disabled:opacity-50"
          >
            Template
          </button>
        </span>
      </div>
      <textarea
        aria-label={note ? "Work note" : "Public reply"}
        rows={4}
        value={body}
        disabled={readOnly || pending}
        placeholder={note ? "Internal note for the team" : "Reply to the requester"}
        onChange={(event) => setBody(event.target.value)}
        className="text-xms-ink min-h-[76px] w-full resize-y bg-transparent px-[14px] py-[14px] text-[13px] outline-none"
      />
      {attachments ? (
        <div className="border-xms-line flex flex-col gap-2 border-t px-[14px] py-3">{attachments}</div>
      ) : null}
      <div className="border-xms-line flex items-center gap-[10px] border-t px-[14px] py-3">
        <span className="text-xms-muted text-[12px] leading-none">
          {blockedReason ?? (note ? "Visible to the team only" : recipientLine)}
        </span>
        <button
          type="submit"
          disabled={readOnly || pending || !body.trim() || Boolean(blockedReason)}
          className={cn(
            "ml-auto rounded-[4px] px-4 py-[10px] text-[13px] leading-none font-semibold text-white disabled:opacity-50",
            note ? "bg-xms-navy" : "bg-xms-accent hover:bg-xms-accent-hover",
          )}
        >
          {note ? "Add note" : "Send"}
        </button>
      </div>
    </form>
  );
}

export function formatStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.toISOString().slice(0, 10)} ${date.toISOString().slice(11, 16)}`;
}

/** The two letters the prototype's 34px avatar carries. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const letters = parts.length === 1 ? parts[0].slice(0, 2) : `${parts[0][0]}${parts[parts.length - 1][0]}`;
  return letters.toUpperCase();
}

const THREAD_PILL = "rounded-[999px] px-[9px] py-[4px] text-[11px] leading-none font-medium whitespace-nowrap";

/**
 * One message in the thread, measured off the prototype's own markup: a 34px
 * initials circle, then the author at `600 14px/1.3`, a channel pill, an
 * optional marker pill and the instant, over the body. Rows are separated by
 * a hairline and by nothing else.
 *
 * The built row was a card per message, tinted for a work note, so a thread of
 * four read as four stacked cards inside the work area's own card.
 */
export function MessageRow({ item, viaEmail }: { item: TimelineItem; viaEmail?: boolean }) {
  const note = item.kind === "work_note";
  const name = item.actor_name ?? "Unknown";
  return (
    <article data-kind={item.kind} className="border-xms-line-row flex gap-[13px] border-b py-4 last:border-b-0">
      <span
        aria-hidden
        className={cn(
          "xms-mono h-[34px] w-[34px] flex-none rounded-[999px] text-center text-[11px] leading-[34px] font-semibold",
          note ? "bg-xms-navy text-white" : "bg-xms-nav-wash text-xms-accent-hover",
        )}
      >
        {initialsOf(name)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-[9px]">
          <span className="text-xms-ink text-[14px] leading-[1.3] font-semibold">{name}</span>
          <span className={cn(THREAD_PILL, note ? "bg-xms-navy text-white" : "bg-xms-chip text-xms-label")}>
            {note ? "Internal" : `Public${item.source ? ` · ${item.source}` : ""}`}
          </span>
          {item.is_first_response ? (
            <span className={cn(THREAD_PILL, "bg-xms-accent-tint text-xms-accent-hover")}>First response</span>
          ) : null}
          {viaEmail ? (
            <span className={cn(THREAD_PILL, "bg-xms-chip text-xms-label")} data-via="email">
              via email
            </span>
          ) : null}
          <span className="text-xms-muted text-[12px] leading-none">{formatStamp(item.created_at)}</span>
        </header>
        <p className="text-xms-ink mt-[10px] text-[14px] leading-[1.6] whitespace-pre-wrap">{item.body}</p>
      </div>
    </article>
  );
}

export interface ConversationTabProps {
  ticketKey: string;
  requesterLine: string;
  readOnly?: boolean;
  /** What the strip's filter says the thread holds. */
  shows?: "all" | "replies" | "notes";
  /** What the strip's search field is looking for in it. */
  find?: string;
}

/** Public comments and work notes interleaved (User Experience section 10 default), newest last. */
export function ConversationTab({
  ticketKey,
  requesterLine,
  readOnly,
  shows = "all",
  find = "",
}: ConversationTabProps) {
  const { data, isLoading } = useGetTimelineQuery(ticketKey, { refetchOnFocus: true });
  const [addComment, comment] = useAddCommentMutation();
  const [addNote, note] = useAddWorkNoteMutation();
  const { push } = useToast();
  const trackReply = useTrack("reply.send");
  const trackNote = useTrack("note.add");
  const [mode, setMode] = useState<ComposerMode>("reply");
  const [acknowledged, setAcknowledged] = useState(false);
  const uploads = useUploads(ticketKey, { visibility: () => (mode === "note" ? "internal" : "public") });
  const { data: email } = useGetTicketEmailQuery(ticketKey);
  const emailComments = new Set((email?.inbound ?? []).map((row) => row.comment_id).filter(Boolean));
  // The strip states what the thread holds and what to find in it. The
  // prototype draws no toggle over the thread, and the strip is where a
  // screen says what it is showing.
  const needle = find.trim().toLowerCase();
  const messages = (data ?? [])
    .filter((item) =>
      shows === "replies"
        ? item.kind === "comment"
        : shows === "notes"
          ? item.kind === "work_note"
          : item.kind === "comment" || item.kind === "work_note",
    )
    .filter((item) => (needle ? `${item.body ?? ""} ${item.actor_name ?? ""}`.toLowerCase().includes(needle) : true));
  const blockedReason = uploads.scanning && !acknowledged ? "A file is still being scanned." : undefined;
  return (
    <div className="flex flex-col gap-4">
      <Composer
        readOnly={readOnly}
        pending={comment.isLoading || note.isLoading}
        recipientLine={requesterLine}
        onModeChange={setMode}
        blockedReason={blockedReason}
        attachments={
          readOnly ? null : (
            <>
              <DropZone
                onFiles={uploads.add}
                label={mode === "note" ? "Attach internal files" : "Attach files for the client"}
              />
              <UploadList items={uploads.items} onRemove={uploads.remove} />
              {uploads.scanning ? <ScanAcknowledgement checked={acknowledged} onChange={setAcknowledged} /> : null}
            </>
          )
        }
        onSend={async (mode, body) => {
          try {
            if (mode === "reply") {
              await addComment({ key: ticketKey, body }).unwrap();
              trackReply({ ticket: ticketKey });
            } else {
              await addNote({ key: ticketKey, body }).unwrap();
              trackNote({ ticket: ticketKey });
            }
          } catch (error) {
            push({ title: "Not sent", detail: describeError(apiError(error)), tone: "error" });
          }
        }}
      />
      {isLoading ? <Skeleton lines={4} /> : null}
      <div className="flex flex-col">
        {messages.map((item) => (
          <MessageRow key={item.id} item={item} viaEmail={emailComments.has(item.id)} />
        ))}
      </div>
      {data && messages.length === 0 ? <p className="text-xms-label text-[13px]">No messages yet.</p> : null}
    </div>
  );
}
