"use client";

import Link from "next/link";
import { useState } from "react";
import { INPUT, InlineError, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { DeliveryList } from "@/components/reporting/delivery-list";
import { RunStatusPill } from "@/components/reporting/reports-card";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { Panel } from "@/components/xms/panel";
import { SignalPill } from "@/components/xms/signal-pill";
import { Skeleton } from "@/components/xms/skeleton";
import { useToast } from "@/components/xms/toast";
import {
  CANCEL_REASON_MESSAGE,
  deadlineLine,
  describeReviewError,
  EMPTY_SECTION_LINE,
  isEmptySection,
  isHeld,
  packSections,
  reviewError,
  reviewMoment,
  reviewPill,
  type ReviewSection,
} from "@/lib/reporting/review";
import { requestedByLabel } from "@/lib/reporting/schedules";
import { EXTERNAL_REL, safeHref } from "@/lib/safe-url";
import { useTrack } from "@/lib/telemetry/provider";
import { cn } from "@/lib/utils";
import { useMe } from "@/redux/me";
import {
  useApproveReportRunMutation,
  useCancelReportRunMutation,
  useReviewRunQuery,
  type ReviewRun,
} from "@/redux/reportingApi";

const HEAD = "text-xms-ink px-3 py-2 text-left text-[12px] font-semibold whitespace-nowrap";
const CELL = "text-xms-ink px-3 py-2 align-top text-[13px]";

/**
 * Review before send (Dashboards & Report Packs functional 5.8, DR-05): one
 * held run, read before anything is sent to a client.
 *
 * The screen shows the run's status and its deadline, the pack exactly as the
 * two renditions present it, a link to open each rendition, and the two
 * decisions the API takes: approve, which delivers the pack that was held, and
 * cancel, which records a reason and sends nothing. The pack is read only: the
 * API has no narrative edit and no regenerate route, so the specification's
 * editable panel and "Regenerate with my edits" are not offered, and the
 * narrative panel says so rather than showing a control that would refuse.
 *
 * The screen is mounted by a gate on `reports:manage`, which is the one key
 * all three routes stand on, so nothing is asked before the browser has
 * decided (`components/admin/fail-closed.test.ts`).
 */
export function ReportRunReview({ runId }: { runId: string }) {
  const me = useMe();
  const { data: run, isLoading, isError, error } = useReviewRunQuery(runId);
  const [approve, approving] = useApproveReportRunMutation();
  const [cancel, cancelling] = useCancelReportRunMutation();
  const { push } = useToast();
  const track = useTrack("report.review.decide");
  const [reason, setReason] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (isLoading && !run) return <Skeleton lines={10} />;
  if (isError || !run) {
    return (
      <EmptyBanner
        title="This run is not available"
        detail={
          isError
            ? describeReviewError(reviewError(error))
            : "It may belong to an account you are not granted, or it may have been removed."
        }
      />
    );
  }

  const held = isHeld(run.status);
  const pill = reviewPill(run.status);
  const deadline = deadlineLine(run);
  const sections = run.pack ? packSections(run.pack) : [];

  const onApprove = async () => {
    setProblem(null);
    try {
      const sent = await approve({ id: run.id, accountId: run.account_id }).unwrap();
      track({ account_id: run.account_id, run_id: run.id, decision: "approved", status: sent.status });
      push({
        title: sent.status === "sent" ? "Report pack sent" : "Report pack approved, nobody reached",
        detail: `${sent.period.start} to ${sent.period.end}`,
        tone: sent.status === "sent" ? "success" : "error",
      });
    } catch (caught) {
      setProblem(describeReviewError(reviewError(caught)));
    }
  };

  const onCancel = async () => {
    if (!reason.trim()) {
      setProblem(CANCEL_REASON_MESSAGE);
      return;
    }
    setProblem(null);
    try {
      await cancel({ id: run.id, accountId: run.account_id, reason: reason.trim() }).unwrap();
      track({ account_id: run.account_id, run_id: run.id, decision: "cancelled", status: "skipped" });
      push({ title: "Report pack cancelled", detail: "Nothing was sent.", tone: "success" });
      setCancelOpen(false);
      setReason("");
    } catch (caught) {
      setProblem(describeReviewError(reviewError(caught)));
    }
  };

  return (
    <div className="flex flex-col gap-4" data-testid="run-review" data-status={run.status}>
      <div className="flex flex-wrap items-center gap-3">
        {me.hasPermission("admin:accounts") ? (
          <Link
            href={`/admin/accounts/${run.account_id}?tab=reports`}
            className="text-xms-label hover:text-xms-ink text-[12px]"
          >
            ← Report packs
          </Link>
        ) : null}
        <h1 className="text-xms-ink text-[18px] font-semibold">Report review</h1>
        <span className="xms-mono text-xms-label text-[12px]">
          {run.period_start} to {run.period_end}
        </span>
        <RunStatusPill status={run.status} />
        {pill ? <SignalPill tone={pill.tone} label={pill.label} /> : null}
        <RenditionLinks files={run.files} />
      </div>

      <Panel
        title="This run"
        caption="Held before sending"
        subtitle={deadline ?? "This run has been decided; nothing here changes it."}
      >
        <dl className="grid gap-3 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Requested" value={`${requestedByLabel(run.requested_by)}, ${reviewMoment(run.created_at)}`} />
          <Fact label="Review due" value={reviewMoment(run.review_due_at) ?? "No deadline"} />
          <Fact label="Decided" value={reviewMoment(run.reviewed_at) ?? "Not yet"} />
          <Fact label="Recipients told" value={run.delivery ? `${run.delivery.length}` : "Nobody yet"} />
        </dl>
        {run.review_note ? (
          <p className="text-xms-ink mt-3 text-[13px]">
            <span className="text-xms-label">Cancelled because: </span>
            {run.review_note}
          </p>
        ) : null}
        {run.error ? <p className="text-xms-muted mt-3 text-[13px]">{run.error}</p> : null}
      </Panel>

      {held ? (
        <Decisions
          approving={approving.isLoading}
          cancelling={cancelling.isLoading}
          cancelOpen={cancelOpen}
          reason={reason}
          problem={problem}
          onOpenCancel={() => {
            setProblem(null);
            setCancelOpen(true);
          }}
          onCloseCancel={() => {
            setProblem(null);
            setCancelOpen(false);
          }}
          onReason={setReason}
          onApprove={() => void onApprove()}
          onCancel={() => void onCancel()}
        />
      ) : (
        <Panel title="Decision" caption="Already taken" subtitle="This run is no longer waiting on a reviewer.">
          {run.delivery ? (
            <DeliveryList delivery={run.delivery} />
          ) : (
            <p className="text-xms-label text-[13px]">Nothing was delivered.</p>
          )}
        </Panel>
      )}

      {run.pack ? (
        sections.map((section) => <SectionPanel key={section.title} section={section} />)
      ) : (
        <Panel title="The pack" caption="Nothing stored">
          <p className="text-xms-label text-[13px]">
            This run stored no pack, so there is nothing to read and nothing to send.
          </p>
        </Panel>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xms-label text-[12px]">{label}</dt>
      <dd className="text-xms-ink xms-mono text-[13px]">{value}</dd>
    </div>
  );
}

/**
 * The two renditions of the held pack. Both URLs are presigned and
 * server-supplied, so each is validated before it reaches an href and carries
 * noreferrer as well as noopener, keeping the presigned path out of a Referer
 * (security review findings 26 and 38).
 */
function RenditionLinks({ files }: { files: ReviewRun["files"] }) {
  const pdf = safeHref(files.pdf);
  const pptx = safeHref(files.pptx);
  if (!pdf && !pptx) return null;
  return (
    <div className="ml-auto flex items-center gap-2">
      {pdf ? (
        <a href={pdf} target="_blank" rel={EXTERNAL_REL} className={`${SECONDARY_BUTTON} inline-flex items-center`}>
          Open PDF
        </a>
      ) : null}
      {pptx ? (
        <a href={pptx} target="_blank" rel={EXTERNAL_REL} className={`${SECONDARY_BUTTON} inline-flex items-center`}>
          Open slides
        </a>
      ) : null}
    </div>
  );
}

/** Approve and send, or cancel with a reason the API requires. */
function Decisions({
  approving,
  cancelling,
  cancelOpen,
  reason,
  problem,
  onOpenCancel,
  onCloseCancel,
  onReason,
  onApprove,
  onCancel,
}: {
  approving: boolean;
  cancelling: boolean;
  cancelOpen: boolean;
  reason: string;
  problem: string | null;
  onOpenCancel: () => void;
  onCloseCancel: () => void;
  onReason: (value: string) => void;
  onApprove: () => void;
  onCancel: () => void;
}) {
  return (
    <Panel
      title="Decision"
      caption="Approve or cancel"
      subtitle="Approve sends the pack exactly as it is below; nothing here rewrites it."
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={PRIMARY_BUTTON} onClick={onApprove} disabled={approving || cancelling}>
            {approving ? "Sending" : "Approve and send"}
          </button>
          <button
            type="button"
            className={SECONDARY_BUTTON}
            onClick={cancelOpen ? onCloseCancel : onOpenCancel}
            disabled={approving || cancelling}
          >
            {cancelOpen ? "Keep it waiting" : "Cancel"}
          </button>
        </div>
        {cancelOpen ? (
          <form
            className="flex flex-col gap-2"
            aria-label="Cancel this run"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              onCancel();
            }}
          >
            <label className="flex flex-col gap-1 text-[12px]">
              <span className="text-xms-label">Reason</span>
              <textarea
                aria-label="Reason"
                rows={2}
                className={cn(INPUT, "h-auto py-1.5")}
                value={reason}
                onChange={(event) => onReason(event.target.value)}
              />
            </label>
            <div>
              <button type="submit" className={PRIMARY_BUTTON} disabled={cancelling}>
                {cancelling ? "Cancelling" : "Cancel this run"}
              </button>
            </div>
          </form>
        ) : null}
        <InlineError message={problem} />
      </div>
    </Panel>
  );
}

/**
 * One section of the pack as read-only text: the paragraphs, the tiles and the
 * tables the renditions carry, in their order. A section with nothing in it
 * prints the line the deck prints rather than an empty frame.
 */
function SectionPanel({ section }: { section: ReviewSection }) {
  const isNarrative = section.title === "Headline";
  return (
    <Panel
      title={section.title}
      caption="From the pack"
      subtitle={isNarrative ? "Read only: the narrative cannot be edited or regenerated here yet." : undefined}
    >
      {isEmptySection(section) ? (
        <p className="text-xms-label text-[13px]">{EMPTY_SECTION_LINE}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {section.paragraphs.map((paragraph, index) => (
            <p key={index} className="text-xms-ink text-[14px] whitespace-pre-wrap">
              {paragraph}
            </p>
          ))}
          {section.tiles.length > 0 ? (
            <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" data-testid="review-tiles">
              {section.tiles.map((tile) => (
                <div key={tile.label} className="border-xms-line flex flex-col gap-1 rounded-[6px] border p-3">
                  <dt className="text-xms-label text-[12px]">{tile.label}</dt>
                  <dd className="text-xms-ink xms-mono text-[18px] font-semibold">{tile.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {section.tables.map((table) => (
            <div key={table.caption} className="overflow-x-auto">
              <table className="w-full border-collapse" aria-label={table.caption}>
                <caption className="xms-caption text-left">{table.caption}</caption>
                <thead className="bg-xms-card">
                  <tr className="border-xms-line border-b">
                    {table.columns.map((column) => (
                      <th key={column} className={HEAD}>
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, index) => (
                    <tr key={index} className="border-xms-line border-b">
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className={cn(CELL, cellIndex === 0 && "xms-mono whitespace-nowrap")}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
