"use client";

import { useState } from "react";
import { PORTAL_PRIMARY, PORTAL_TEXTAREA } from "@/components/portal/primitives";
import { clientStatus, formatDateTime } from "@/lib/portal/client-language";
import { cn } from "@/lib/utils";
import type { PortalTimelineItem } from "@/redux/portalApi";

/**
 * The public thread (Client Portal functional 5.5): comments as bubbles,
 * "You" for the requester's own messages, the consultant's name otherwise;
 * state changes as quiet inline rows in client language. Work notes never
 * arrive here because the API's public view has no such row.
 */
export function RequestThread({ items, requesterName }: { items: PortalTimelineItem[]; requesterName: string }) {
  if (items.length === 0) {
    return (
      <p role="status" className="text-xms-label text-[14px]">
        No messages yet. Your support team will reply here and by email.
      </p>
    );
  }
  return (
    <ol className="flex flex-col gap-3" aria-label="Conversation">
      {items.map((item) => {
        if (item.kind === "state_change") {
          return (
            <li key={item.item_id} className="text-xms-label flex items-center gap-2 text-[12px]">
              <span className="bg-xms-line h-px flex-1" aria-hidden />
              <span>
                {clientStatus(item.to_state ?? "")}
                {" at "}
                <time dateTime={item.created_at}>{formatDateTime(item.created_at)}</time>
              </span>
              <span className="bg-xms-line h-px flex-1" aria-hidden />
            </li>
          );
        }
        if (item.kind === "attachment") {
          return (
            <li key={item.item_id} className="text-xms-label text-[13px]">
              Attachment {item.file_name} added by {item.actor_name ?? "your support team"}{" "}
              <time dateTime={item.created_at}>{formatDateTime(item.created_at)}</time>
            </li>
          );
        }
        const mine = item.actor_name === requesterName;
        return (
          <li key={item.item_id} className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
            <p className="text-xms-label text-[12px]">
              <span className="text-xms-ink font-medium">{mine ? "You" : (item.actor_name ?? "Support team")}</span>{" "}
              <time dateTime={item.created_at}>{formatDateTime(item.created_at)}</time>
            </p>
            <div
              className={cn(
                "max-w-[85%] rounded-[8px] px-4 py-3 text-[14px] whitespace-pre-wrap",
                mine ? "bg-xms-accent-tint text-xms-ink" : "xms-card text-xms-body",
              )}
            >
              {item.body}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function CommentComposer({
  onSend,
  sending,
  disabledReason,
}: {
  onSend: (body: string) => Promise<boolean>;
  sending?: boolean;
  disabledReason?: string;
}) {
  const [body, setBody] = useState("");
  if (disabledReason) {
    return (
      <p role="status" className="text-xms-label text-[14px]">
        {disabledReason}
      </p>
    );
  }
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const text = body.trim();
        if (!text) return;
        if (await onSend(text)) setBody("");
      }}
    >
      <label htmlFor="reply" className="text-xms-ink text-[14px] font-medium">
        Reply
      </label>
      <textarea
        id="reply"
        rows={4}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        className={PORTAL_TEXTAREA}
        placeholder="Add details, answer a question, or tell us it is fixed."
        maxLength={50000}
      />
      <div>
        <button type="submit" className={PORTAL_PRIMARY} disabled={sending || body.trim().length === 0}>
          {sending ? "Sending..." : "Send reply"}
        </button>
      </div>
    </form>
  );
}
