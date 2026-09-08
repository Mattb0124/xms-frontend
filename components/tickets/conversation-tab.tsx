"use client";

import { useState, type ReactNode } from "react";
import { DropZone, ScanAcknowledgement, UploadList, useUploads } from "@/components/tickets/attachments";
import { ActorChip, type ActorKind } from "@/components/xms/actor-chip";
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
      className={cn("xms-card flex flex-col", note && "border-xms-line-strong bg-xms-tint")}
      onSubmit={async (event) => {
        event.preventDefault();
        if (!body.trim() || blockedReason) return;
        await onSend(mode, body.trim());
        setBody("");
      }}
    >
      <div
        className="border-xms-line flex items-center gap-2 border-b px-3 py-2"
        role="tablist"
        aria-label="Composer mode"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "reply"}
          onClick={() => setMode("reply")}
          className={cn(
            "h-[28px] rounded-[999px] px-[14px] text-[13px] font-medium",
            mode === "reply" ? "bg-xms-accent text-white" : "text-xms-body hover:bg-xms-tint",
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
            "h-[28px] rounded-[999px] px-[14px] text-[13px] font-medium",
            note ? "bg-xms-navy text-white" : "text-xms-body hover:bg-xms-tint",
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
            className="border-xms-line bg-xms-card text-xms-body h-[28px] rounded-[6px] border px-3 text-[13px] disabled:opacity-50"
          >
            Draft with Axel
          </button>
          <button
            type="button"
            disabled
            title="There is no reply template catalog on the API yet."
            className="border-xms-line bg-xms-card text-xms-body h-[28px] rounded-[6px] border px-3 text-[13px] disabled:opacity-50"
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
        className="text-xms-ink w-full resize-y bg-transparent px-3 py-2 text-[13px] outline-none"
      />
      {attachments ? <div className="border-xms-line flex flex-col gap-2 border-t px-3 py-2">{attachments}</div> : null}
      <div className="border-xms-line flex items-center gap-2 border-t px-3 py-2">
        <span className="text-xms-label text-[12px]">
          {blockedReason ?? (note ? "Visible to the team only" : recipientLine)}
        </span>
        <button
          type="submit"
          disabled={readOnly || pending || !body.trim() || Boolean(blockedReason)}
          className={cn(
            "ml-auto h-[32px] rounded-[6px] px-4 text-[13px] font-semibold text-white disabled:opacity-50",
            note ? "bg-xms-navy" : "bg-xms-accent hover:bg-xms-accent-hover",
          )}
        >
          {note ? "Add note" : "Send"}
        </button>
      </div>
    </form>
  );
}

function actorKind(kind: string | undefined): ActorKind {
  switch (kind) {
    case "portal_user":
    case "system":
    case "ai":
    case "api_client":
    case "sync":
      return kind;
    default:
      return "user";
  }
}

export function formatStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.toISOString().slice(0, 10)} ${date.toISOString().slice(11, 16)}`;
}

/** One message in the thread; work notes take the tint and the Internal chip. */
export function MessageRow({ item, viaEmail }: { item: TimelineItem; viaEmail?: boolean }) {
  const note = item.kind === "work_note";
  return (
    <article
      data-kind={item.kind}
      className={cn(
        "flex flex-col gap-2 rounded-[6px] px-4 py-3",
        note ? "bg-xms-tint border-xms-line border" : "xms-card",
      )}
    >
      <header className="flex flex-wrap items-center gap-2 text-[12px]">
        <ActorChip name={item.actor_name ?? "Unknown"} kind={actorKind(item.actor_kind)} />
        <span
          className={cn(
            "rounded-[999px] px-2 py-[1px] text-[11px]",
            note ? "bg-xms-navy text-white" : "bg-xms-accent-tint text-xms-accent",
          )}
        >
          {note ? "Internal" : `Public${item.source ? ` · ${item.source}` : ""}`}
        </span>
        {item.is_first_response ? (
          <span className="aix-state-pill" data-state="complete">
            First response
          </span>
        ) : null}
        {viaEmail ? (
          <span className="bg-xms-tint text-xms-label rounded-[999px] px-2 py-[1px] text-[11px]" data-via="email">
            via email
          </span>
        ) : null}
        <span className="xms-mono text-xms-label ml-auto">{formatStamp(item.created_at)}</span>
      </header>
      <p className="text-xms-ink text-[13px] whitespace-pre-wrap">{item.body}</p>
    </article>
  );
}

export interface ConversationTabProps {
  ticketKey: string;
  requesterLine: string;
  readOnly?: boolean;
}

/** Public comments and work notes interleaved (User Experience section 10 default), newest last. */
export function ConversationTab({ ticketKey, requesterLine, readOnly }: ConversationTabProps) {
  const { data, isLoading } = useGetTimelineQuery(ticketKey, { refetchOnFocus: true });
  const [addComment, comment] = useAddCommentMutation();
  const [addNote, note] = useAddWorkNoteMutation();
  const { push } = useToast();
  const trackReply = useTrack("reply.send");
  const trackNote = useTrack("note.add");
  const [showNotes, setShowNotes] = useState(true);
  const [mode, setMode] = useState<ComposerMode>("reply");
  const [acknowledged, setAcknowledged] = useState(false);
  const uploads = useUploads(ticketKey, { visibility: () => (mode === "note" ? "internal" : "public") });
  const { data: email } = useGetTicketEmailQuery(ticketKey);
  const emailComments = new Set((email?.inbound ?? []).map((row) => row.comment_id).filter(Boolean));
  const messages = (data ?? []).filter((item) => item.kind === "comment" || (showNotes && item.kind === "work_note"));
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
      <div className="flex items-center gap-2 text-[12px]">
        <span className="xms-caption">Thread</span>
        <label className="text-xms-label ml-auto flex items-center gap-1">
          <input type="checkbox" checked={showNotes} onChange={(event) => setShowNotes(event.target.checked)} />
          Show work notes
        </label>
      </div>
      {isLoading ? <Skeleton lines={4} /> : null}
      {messages.map((item) => (
        <MessageRow key={item.id} item={item} viaEmail={emailComments.has(item.id)} />
      ))}
      {data && messages.length === 0 ? <p className="text-xms-label text-[13px]">No messages yet.</p> : null}
    </div>
  );
}
