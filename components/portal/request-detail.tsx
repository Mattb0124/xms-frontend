"use client";

import { useState } from "react";
import { formatMoment } from "@/lib/format/date";
import {
  ClientStatusPill,
  PORTAL_DANGER,
  PORTAL_PRIMARY,
  PORTAL_SECONDARY,
  PortalCard,
} from "@/components/portal/primitives";
import { PortalAttachmentList, PortalUploadControl, usePortalUploads } from "@/components/portal/attachments";
import { CommentComposer, RequestThread } from "@/components/portal/request-thread";
import { Skeleton } from "@/components/xms/skeleton";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import { formatDateTime, isTerminal, priorityLabel } from "@/lib/portal/client-language";
import { useTrack } from "@/lib/telemetry/provider";
import {
  useAddPortalCommentMutation,
  usePortalMeQuery,
  usePortalTicketQuery,
  usePortalTimelineQuery,
  usePortalTransitionMutation,
  usePortalTransitionsQuery,
  type PortalTransition,
  usePortalScopeRecordQuery,
} from "@/redux/portalApi";

/**
 * The request page (User Experience 4.4, Client Portal 5.5): header, the
 * description, the public thread, a composer and the actions the state
 * machine allows a portal user (cancel, confirm closure, reopen). A stale
 * version reloads the record instead of guessing.
 */
export function RequestDetail({ requestKey }: { requestKey: string }) {
  const ticket = usePortalTicketQuery(requestKey);
  const timeline = usePortalTimelineQuery(requestKey);
  const transitions = usePortalTransitionsQuery(requestKey);
  const me = usePortalMeQuery();
  const [addComment, commentState] = useAddPortalCommentMutation();
  const [transition, transitionState] = usePortalTransitionMutation();
  const { push } = useToast();
  const trackComment = useTrack("portal.comment");
  const trackSolved = useTrack("portal.solved_it");
  const [confirming, setConfirming] = useState<PortalTransition | null>(null);
  const uploads = usePortalUploads(requestKey);
  const scope = usePortalScopeRecordQuery(requestKey);

  if (ticket.isLoading) return <Skeleton lines={6} className="max-w-xl" />;
  if (ticket.isError || !ticket.data) {
    const error = apiError(ticket.error);
    return (
      <p role="alert" className="text-[14px] text-[color:var(--state-overdue-text)]">
        {error.status === 404 ? "We could not find that request." : describeError(error)}
      </p>
    );
  }
  const record = ticket.data;
  const requesterName = me.data?.principal.displayName ?? "";

  const send = async (body: string): Promise<boolean> => {
    try {
      await addComment({ key: requestKey, body }).unwrap();
      trackComment({ request: record.key });
      push({ title: "Reply sent", tone: "success" });
      return true;
    } catch (error) {
      push({ title: "Not sent", detail: describeError(apiError(error)), tone: "error" });
      return false;
    }
  };

  const run = async (target: PortalTransition) => {
    try {
      await transition({ key: requestKey, version: record.version, to: target.to }).unwrap();
      if (target.to === "closed") trackSolved({ request: record.key });
      push({ title: target.label, tone: "success" });
    } catch (error) {
      const parsed = apiError(error);
      if (parsed.code === "stale_version") {
        push({
          title: "Reloaded",
          detail: "This request changed while you were looking. It has been reloaded.",
          tone: "error",
        });
        void ticket.refetch();
      } else {
        push({ title: "Not done", detail: describeError(parsed), tone: "error" });
      }
    } finally {
      setConfirming(null);
    }
  };

  const actions = transitions.data?.transitions ?? [];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="xms-mono text-xms-label text-[14px]">{record.key}</p>
        <h1 className="text-xms-ink text-[22px] font-semibold">{record.short_description}</h1>
        <div className="flex flex-wrap items-center gap-3 text-[14px]">
          <ClientStatusPill state={record.state} />
          <span className="text-xms-label">Priority {priorityLabel(record.priority)}</span>
          <span className="text-xms-label">
            Opened <time dateTime={record.created_at}>{formatDateTime(record.created_at)}</time>
          </span>
          {record.category ? <span className="text-xms-label">Area: {record.category}</span> : null}
        </div>
      </header>

      {record.description ? (
        <PortalCard title="Details">
          <p className="text-xms-body text-[14px] whitespace-pre-wrap">{record.description}</p>
        </PortalCard>
      ) : null}

      {/* What was decided about this request's scope (TM-11). The server
          answers with the decided rows only, so nothing here is an argument
          still in progress, and none of it can be edited afterwards. */}
      {scope.data && scope.data.length > 0 ? (
        <PortalCard title="Scope decisions">
          <ol className="flex flex-col gap-3">
            {scope.data.map((row) => (
              <li key={row.id} className="flex flex-col gap-1">
                <p className="text-xms-ink text-[14px]">
                  {row.event === "approved" ? "Approved as extra work" : "Declined as outside the contract"}
                  {row.allowance_minutes > 0
                    ? `, with ${Math.round((row.allowance_minutes / 60) * 10) / 10} h added to your period`
                    : ""}
                </p>
                {row.reason ? <p className="text-xms-body text-[14px]">Raised because: {row.reason}</p> : null}
                {row.note ? <p className="text-xms-body text-[14px]">{row.note}</p> : null}
                <p className="text-xms-label text-[14px]">{formatMoment(row.at)}</p>
              </li>
            ))}
          </ol>
        </PortalCard>
      ) : null}

      {actions.length > 0 ? (
        <section aria-label="Actions" className="flex flex-wrap items-center gap-2">
          {actions.map((action) => (
            <button
              key={action.to}
              type="button"
              onClick={() => setConfirming(action)}
              className={
                action.to === "cancelled" ? PORTAL_DANGER : action.to === "closed" ? PORTAL_PRIMARY : PORTAL_SECONDARY
              }
              disabled={transitionState.isLoading}
            >
              {actionLabel(action)}
            </button>
          ))}
        </section>
      ) : null}

      {confirming ? (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby="confirm-title"
          className="xms-card border-xms-accent-border flex flex-col gap-3 border p-4"
        >
          <p id="confirm-title" className="text-xms-ink text-[14px] font-medium">
            {confirmCopy(confirming)}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className={confirming.to === "cancelled" ? PORTAL_DANGER : PORTAL_PRIMARY}
              onClick={() => void run(confirming)}
              disabled={transitionState.isLoading}
            >
              Yes, {actionLabel(confirming).toLowerCase()}
            </button>
            <button type="button" className={PORTAL_SECONDARY} onClick={() => setConfirming(null)}>
              Keep as is
            </button>
          </div>
        </div>
      ) : null}

      <PortalCard title="Files">
        <PortalAttachmentList requestKey={requestKey} />
        {isTerminal(record.state) ? null : (
          <PortalUploadControl
            onFiles={(files) => void uploads.add(files)}
            items={uploads.items}
            disabled={uploads.busy}
          />
        )}
      </PortalCard>

      <PortalCard title="Conversation">
        {timeline.isLoading ? (
          <Skeleton lines={4} />
        ) : (
          <RequestThread items={timeline.data ?? []} requesterName={requesterName} />
        )}
        <div className="border-xms-line mt-2 border-t pt-4">
          <CommentComposer
            onSend={send}
            sending={commentState.isLoading}
            disabledReason={
              isTerminal(record.state) ? "This request is closed. Open a new request if you need more help." : undefined
            }
          />
        </div>
      </PortalCard>
    </div>
  );
}

function actionLabel(action: PortalTransition): string {
  if (action.to === "cancelled") return "Cancel request";
  if (action.to === "closed") return "Confirm closure";
  if (action.reopen) return "Reopen";
  return action.label;
}

function confirmCopy(action: PortalTransition): string {
  if (action.to === "cancelled") return "Cancel this request? Your support team will stop working on it.";
  if (action.to === "closed") return "Confirm the request is resolved? It will be closed.";
  if (action.reopen) return "Reopen this request? Your support team will pick it up again.";
  return `${action.label}?`;
}
