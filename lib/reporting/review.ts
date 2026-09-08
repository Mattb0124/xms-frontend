import type { SignalTone } from "@/components/xms/signal-pill";
import { apiError, describeError, type ApiError } from "@/lib/admin/api-error";
import type { HeldPack, Measures, Notable, ReviewRun } from "@/redux/reportingApi";

/**
 * Review before send (Dashboards & Report Packs functional 5.8, DR-05): the
 * vocabulary the review screen and the run history share.
 *
 * A run of a schedule with review required is rendered and then held. It sits
 * at `ready_for_review` until its deadline and at `awaiting_review` after the
 * sweep expires the hold; both are approvable and neither has delivered
 * anything, because unreviewed narrative never reaches a client. Approve
 * sends the pack that was held. Cancel records a reason and the run takes the
 * closed `skipped` status.
 *
 * The pack itself is read only here. The API has no narrative edit and no
 * regenerate route, so the spec's editable panel and "Regenerate with my
 * edits" are not offered; the screen says so rather than showing a control
 * that would refuse.
 */
export const REVIEW_STATE_LABELS: Record<string, string> = {
  ready_for_review: "Ready for review",
  awaiting_review: "Awaiting review",
  approved: "Approved",
  sending: "Sending",
  sent: "Sent",
  skipped: "Cancelled",
  failed: "Failed",
  generating: "Generating",
};

export function runStatusLabel(status: string): string {
  return REVIEW_STATE_LABELS[status] ?? status.replace(/_/g, " ");
}

/** True while the run is waiting on a reviewer and has delivered nothing. */
export function isHeld(status: string): boolean {
  return status === "ready_for_review" || status === "awaiting_review";
}

export interface ReviewPill {
  tone: SignalTone;
  label: string;
}

/**
 * The review state as a pill on the `--state-*` signal trios, or null for a
 * run that review never touched. Waiting inside its grace period needs
 * somebody; past it, the deadline has already passed with nothing sent.
 */
export function reviewPill(status: string): ReviewPill | null {
  switch (status) {
    case "ready_for_review":
      return { tone: "needs-input", label: "Ready for review" };
    case "awaiting_review":
      return { tone: "overdue", label: "Awaiting review" };
    case "approved":
    case "sending":
      return { tone: "ready", label: REVIEW_STATE_LABELS[status] };
    case "skipped":
      return { tone: "blocked", label: "Cancelled" };
    default:
      return null;
  }
}

/** "2026-09-08 06:00" from the ISO instant the API sends. */
export function reviewMoment(at: string | null | undefined): string | null {
  if (!at) return null;
  return at.slice(0, 16).replace("T", " ");
}

/**
 * The deadline in words. A held run says when it must be decided; a run past
 * its deadline says the grace period passed and that nothing was sent, which
 * is the fact a reviewer needs before deciding anything else.
 */
export function deadlineLine(run: Pick<ReviewRun, "status" | "review_due_at">): string | null {
  const due = reviewMoment(run.review_due_at);
  if (run.status === "ready_for_review") {
    return due ? `Approve or cancel it before ${due}.` : "No deadline was set on this run.";
  }
  if (run.status === "awaiting_review") {
    return due
      ? `The grace period passed at ${due} and nothing was sent. It is still yours to approve or cancel.`
      : "The grace period passed and nothing was sent. It is still yours to approve or cancel.";
  }
  return null;
}

// The pack as sections ----------------------------------------------------------------

/**
 * The pack read as the renditions present it (`src/domain/reporting/pdf.ts`
 * on the API side): the narrative, the service level tiles, the backlog and
 * notable tables, the consumption line. The numbers are the frozen ones on
 * the pack and nothing here recomputes a measure; the section order and the
 * titles are the deck's own, so a reviewer reads on the screen what the
 * client will read in the file.
 */
export interface ReviewTile {
  label: string;
  value: string;
}

export interface ReviewTable {
  caption: string;
  columns: string[];
  rows: string[][];
}

export interface ReviewSection {
  title: string;
  paragraphs: string[];
  tiles: ReviewTile[];
  tables: ReviewTable[];
}

export const EMPTY_SECTION_LINE = "No activity this period.";

const AGE_LABELS: Record<string, string> = {
  "0_1d": "0 to 1 days",
  "1_3d": "1 to 3 days",
  "3_7d": "3 to 7 days",
  "7_14d": "7 to 14 days",
  "14d_plus": "14 days or more",
};

/** The latest narrative version, which is the one the pack was rendered with. */
export function latestNarrative(pack: Pick<HeldPack, "narrative_versions"> | null | undefined): string {
  if (!pack || pack.narrative_versions.length === 0) return "";
  return [...pack.narrative_versions].sort((a, b) => b.version - a.version)[0]?.text ?? "";
}

function wholeHours(minutes: number): string {
  return String(Math.round(minutes / 60));
}

function attainment(ratio: Measures["sla_response_attainment"] | undefined): string {
  return !ratio || ratio.value === null ? "n/a" : `${ratio.value}%`;
}

function ageRows(backlog: Measures["backlog_by_age"] | undefined): string[][] {
  return Object.entries(backlog ?? {})
    .filter(([, count]) => count > 0)
    .map(([bucket, count]) => [AGE_LABELS[bucket] ?? bucket.replace(/_/g, " "), String(count)]);
}

function notableRows(notable: Notable[]): string[][] {
  return notable.map((row) => [
    row.key,
    row.title,
    row.state.replace(/_/g, " "),
    row.priority.toUpperCase(),
    `${row.age_days} d`,
  ]);
}

export function packSections(pack: HeldPack): ReviewSection[] {
  const measures = pack.measures;
  const narrative = latestNarrative(pack);
  const ages = ageRows(measures.backlog_by_age);
  const notable = notableRows(pack.notable ?? []);
  return [
    { title: "Headline", paragraphs: narrative ? [narrative] : [], tiles: [], tables: [] },
    {
      title: "Service levels",
      paragraphs: [],
      tiles: [
        { label: "Open requests", value: String(measures.open_tickets) },
        { label: "Past target", value: String(measures.breached_now) },
        { label: "At risk", value: String(measures.at_risk_now) },
        { label: "Response met", value: attainment(measures.sla_response_attainment) },
        { label: "Resolution met", value: attainment(measures.sla_resolution_attainment) },
        {
          label: "Avg time to resolve",
          value: measures.mttr_minutes === null ? "n/a" : `${wholeHours(measures.mttr_minutes)} h`,
        },
      ],
      tables: [],
    },
    {
      title: "Backlog and notable requests",
      paragraphs: [],
      tiles: [],
      tables: [
        ...(ages.length > 0 ? [{ caption: "Backlog by age", columns: ["Age", "Open"], rows: ages }] : []),
        ...(notable.length > 0
          ? [{ caption: "Notable requests", columns: ["Key", "Title", "State", "Priority", "Age"], rows: notable }]
          : []),
      ],
    },
    {
      title: "Consumption",
      paragraphs: [
        `${wholeHours(measures.consumption_minutes)} contract hours consumed this period; ${wholeHours(
          measures.time_logged_minutes,
        )} hours logged in total.`,
      ],
      tiles: [],
      tables: [],
    },
  ];
}

/** True when a section carries nothing, so the screen prints the empty line the deck prints. */
export function isEmptySection(section: ReviewSection): boolean {
  return (
    section.paragraphs.filter((line) => line.trim().length > 0).length === 0 &&
    section.tiles.length === 0 &&
    section.tables.filter((table) => table.rows.length > 0).length === 0
  );
}

// Errors ------------------------------------------------------------------------------

export interface ReviewError extends ApiError {
  /** `not_under_review` carries the status the run actually has. */
  status_now?: string;
}

export function reviewError(error: unknown): ReviewError {
  const parsed = apiError(error) as ReviewError;
  const data = (error as { data?: Record<string, unknown> })?.data;
  if (data && typeof data === "object" && typeof data.status === "string") parsed.status_now = data.status;
  return parsed;
}

/**
 * The cancel body's reason is required by the API's own DTO, which answers a
 * plain validation 400 rather than a typed code, so the screen refuses an
 * empty reason itself and the message never depends on that shape.
 */
export const CANCEL_REASON_MESSAGE = "Say why this pack is not being sent.";

/** Every refusal the three review routes can answer, in words. */
export function describeReviewError(error: ReviewError): string {
  switch (error.code) {
    case "not_under_review":
      return error.status_now
        ? `This run is no longer waiting on a reviewer: it is ${runStatusLabel(error.status_now).toLowerCase()}. It has been reloaded.`
        : "This run is no longer waiting on a reviewer. It has been reloaded.";
    case "run_without_schedule":
      return "This run was generated by hand, so it has no schedule and no recipients to send to.";
    case "run_without_pack":
      return "This run stored no pack, so there is nothing to send. Run the schedule again.";
    case "validation_failed":
      return error.details?.join("; ") ?? CANCEL_REASON_MESSAGE;
    case "not_found":
      return "This run no longer exists, or the account is not granted to you.";
    default:
      return describeError(error);
  }
}
