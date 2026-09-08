"use client";

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
  hasSavedEdit,
  isEmptySection,
  isHeld,
  NARRATIVE_SECTIONS,
  narrativeBody,
  narrativeChanged,
  narrativeDraft,
  narrativeSectionsOf,
  narrativeSourceLine,
  needsRegenerate,
  packSections,
  reviewError,
  reviewMoment,
  reviewPill,
  UNRENDERED_EDIT_NOTE,
  type NarrativeDraft,
  type ReviewSection,
} from "@/lib/reporting/review";
import { requestedByLabel } from "@/lib/reporting/schedules";
import { EXTERNAL_REL, safeHref } from "@/lib/safe-url";
import { useTrack } from "@/lib/telemetry/provider";
import { cn } from "@/lib/utils";
import {
  useApproveReportRunMutation,
  useCancelReportRunMutation,
  useEditRunNarrativeMutation,
  useRegenerateReportRunMutation,
  useReviewRunQuery,
  type NarrativeSection,
  type ReviewRun,
} from "@/redux/reportingApi";

const HEAD = "text-xms-ink px-3 py-2 text-left text-[12px] font-semibold whitespace-nowrap";
const CELL = "text-xms-ink px-3 py-2 align-top text-[13px]";

/**
 * Review before send (Dashboards & Report Packs functional 5.8, DR-05): one
 * held run, read before anything is sent to a client.
 *
 * The screen shows the run's status and its deadline, the narrative in an
 * editable panel, the numbers exactly as the two renditions present them, a
 * link to open each rendition, and the decisions the API takes: approve,
 * which delivers the pack, and cancel, which records a reason and sends
 * nothing.
 *
 * The numbers are read only, because they were frozen when the run rendered
 * and a review that could move one would not be a review. The prose is
 * editable section by section: "Regenerate with my edits" saves it and
 * rebuilds both renditions from the same frozen numbers, and either approve
 * button ships the words in the panel, the API rebuilding an edit nobody
 * regenerated before it delivers. While the panel holds the prose the
 * section panels below carry the numbers alone, so the same paragraph is
 * never shown twice.
 *
 * The screen is mounted by a gate on `reports:manage`, which is the one key
 * all five routes stand on, so nothing is asked before the browser has
 * decided (`components/admin/fail-closed.test.ts`).
 */
export function ReportRunReview({ runId }: { runId: string }) {
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
  const narrative = narrativeSectionsOf(run);
  // While the panel above holds the prose, the sections below carry the
  // numbers alone; once the run is decided there is nothing to edit and the
  // words are printed with them, as the renditions print them.
  const sections = run.pack ? packSections(run.pack, held ? [] : narrative) : [];
  const visible = held ? sections.filter((section) => section.key !== "headline") : sections;

  const onApprove = async (via: "with_edits" | "as_written") => {
    setProblem(null);
    try {
      const sent = await approve({ id: run.id, accountId: run.account_id }).unwrap();
      track({
        account_id: run.account_id,
        run_id: run.id,
        decision: "approved",
        status: sent.status,
        via,
        narrative_source: run.narrative_source ?? "templated",
      });
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

      {held && run.pack ? (
        <NarrativePanel
          // A saved edit is a new version, and a new version is a new panel:
          // the draft is reseeded from what the server now holds rather than
          // kept from before the save.
          key={run.narrative_version ?? 0}
          run={run}
          sections={narrative}
        />
      ) : null}

      {held ? (
        <Decisions
          hasEdit={hasSavedEdit(run)}
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
          onApprove={(via) => void onApprove(via)}
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
        visible.map((section) => <SectionPanel key={section.title} section={section} />)
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

/**
 * The two ways to send and the one way not to (functional 5.8). Both send
 * buttons call the same route, which is the honest shape: the API ships the
 * narrative the pack now carries either way, rebuilding the two files first
 * where an edit was never regenerated. "Approve and send" is the one to press
 * having rewritten something, so it waits for an edit to exist; "Send without
 * changes" is for a reviewer who accepts the narrative as written.
 */
function Decisions({
  hasEdit,
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
  hasEdit: boolean;
  approving: boolean;
  cancelling: boolean;
  cancelOpen: boolean;
  reason: string;
  problem: string | null;
  onOpenCancel: () => void;
  onCloseCancel: () => void;
  onReason: (value: string) => void;
  onApprove: (via: "with_edits" | "as_written") => void;
  onCancel: () => void;
}) {
  return (
    <Panel
      title="Decision"
      caption="Approve or cancel"
      subtitle={
        hasEdit
          ? "Both buttons send the narrative in the panel above, which a reviewer has rewritten; the API rebuilds the two files first if the edit was never regenerated. Cancel sends nothing."
          : "Nobody has rewritten the narrative, so there is nothing to send but the pack as it was rendered. Cancel sends nothing."
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={PRIMARY_BUTTON}
            onClick={() => onApprove("with_edits")}
            disabled={!hasEdit || approving || cancelling}
            title={hasEdit ? undefined : "Nothing has been rewritten yet, so there are no edits to send."}
          >
            {approving ? "Sending" : "Approve and send"}
          </button>
          <button
            type="button"
            className={hasEdit ? SECONDARY_BUTTON : PRIMARY_BUTTON}
            onClick={() => onApprove("as_written")}
            disabled={approving || cancelling}
          >
            Send without changes
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
 * The narrative panel (functional 5.8): the prose of the pack, one box per
 * section of the renditions, with the source of the words said above it.
 *
 * "Regenerate with my edits" is two calls in one press, because that is what
 * the phrase means: the edit is saved to the pack, and both renditions are
 * rebuilt from the numbers already frozen and the words just written. The
 * links are minted fresh by that route, and the run is read again, so the
 * Open PDF and Open slides links on this screen point at the new files
 * rather than the ones they were signed against.
 */
function NarrativePanel({ run, sections }: { run: ReviewRun; sections: NarrativeSection[] }) {
  const [draft, setDraft] = useState<NarrativeDraft>(() => narrativeDraft(sections));
  const [edit, editing] = useEditRunNarrativeMutation();
  const [regenerate, regenerating] = useRegenerateReportRunMutation();
  const { push } = useToast();
  const track = useTrack("report.review.regenerate");
  const [problem, setProblem] = useState<string | null>(null);

  const changed = narrativeChanged(draft, sections);
  const busy = editing.isLoading || regenerating.isLoading;

  const onRegenerate = async () => {
    setProblem(null);
    try {
      const saved = await edit({
        id: run.id,
        accountId: run.account_id,
        sections: narrativeBody(draft),
      }).unwrap();
      await regenerate({ id: run.id, accountId: run.account_id }).unwrap();
      track({ account_id: run.account_id, run_id: run.id, version: saved.narrative_version });
      push({
        title: "Regenerated with your edits",
        detail: "Both renditions were rebuilt from the same numbers, and the links refreshed.",
        tone: "success",
      });
    } catch (caught) {
      setProblem(describeReviewError(reviewError(caught)));
    }
  };

  return (
    <Panel title="Narrative" caption="The words, not the numbers" subtitle={narrativeSourceLine(run)}>
      <div className="flex flex-col gap-3">
        {NARRATIVE_SECTIONS.map(({ key, title }) => (
          <label key={key} className="flex flex-col gap-1 text-[12px]">
            <span className="text-xms-label">{title}</span>
            <textarea
              aria-label={title}
              rows={key === "headline" ? 4 : 2}
              maxLength={6000}
              className={cn(INPUT, "h-auto py-1.5 text-[13px]")}
              value={draft[key]}
              onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
            />
          </label>
        ))}
        {needsRegenerate(run) ? <p className="text-xms-label text-[12px]">{UNRENDERED_EDIT_NOTE}</p> : null}
        <div>
          <button
            type="button"
            className={SECONDARY_BUTTON}
            onClick={() => void onRegenerate()}
            disabled={busy || (!changed && !needsRegenerate(run))}
            title={changed || needsRegenerate(run) ? undefined : "Nothing has been changed to regenerate with."}
          >
            {busy ? "Regenerating" : "Regenerate with my edits"}
          </button>
        </div>
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
  return (
    <Panel
      title={section.title}
      caption="From the pack"
      subtitle="The numbers were frozen when the run rendered; nothing here recomputes one."
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
