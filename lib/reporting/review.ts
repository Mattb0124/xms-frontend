import type { SignalTone } from "@/components/xms/signal-pill";
import { formatMoment } from "@/lib/format/date";
import { apiError, describeError, type ApiError } from "@/lib/admin/api-error";
import type {
  HeldPack,
  Measures,
  NarrativeSection,
  NarrativeSectionKey,
  Notable,
  ReviewRun,
} from "@/redux/reportingApi";

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
 * The numbers are read only: they were frozen when the run rendered, and a
 * review that could move one would not be a review. The prose is not: the
 * narrative is edited section by section, regenerated into both renditions,
 * and shipped by either approve button.
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
  return formatMoment(at);
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
  /** The narrative key of this section, which is what the editor writes to. */
  key: NarrativeSectionKey;
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

/**
 * The pack as the renditions present it. `narrative` is the prose to print
 * with the numbers: the review screen passes none while it is holding that
 * prose in the editable panel above, and passes the run's own narrative once
 * the run is decided and there is nothing left to edit.
 */
export function packSections(pack: HeldPack, narrative: readonly NarrativeSection[] = []): ReviewSection[] {
  const measures = pack.measures;
  const prose = (key: NarrativeSectionKey): string[] => {
    const text = narrative.find((section) => section.key === key)?.text.trim();
    return text ? [text] : [];
  };
  const ages = ageRows(measures.backlog_by_age);
  const notable = notableRows(pack.notable ?? []);
  return [
    { key: "headline", title: "Headline", paragraphs: prose("headline"), tiles: [], tables: [] },
    {
      key: "service_levels",
      title: "Service levels",
      paragraphs: prose("service_levels"),
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
      key: "backlog",
      title: "Backlog and notable requests",
      paragraphs: prose("backlog"),
      tiles: [],
      tables: [
        ...(ages.length > 0 ? [{ caption: "Backlog by age", columns: ["Age", "Open"], rows: ages }] : []),
        ...(notable.length > 0
          ? [{ caption: "Notable requests", columns: ["Key", "Title", "State", "Priority", "Age"], rows: notable }]
          : []),
      ],
    },
    {
      key: "consumption",
      title: "Consumption",
      paragraphs: [
        ...prose("consumption"),
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

// The narrative panel (functional 5.8) -------------------------------------------------

/** The four sections the API keys the narrative by, in the deck's own order. */
export const NARRATIVE_SECTIONS: Array<{ key: NarrativeSectionKey; title: string }> = [
  { key: "headline", title: "Headline" },
  { key: "service_levels", title: "Service levels" },
  { key: "backlog", title: "Backlog and notable requests" },
  { key: "consumption", title: "Consumption" },
];

export type NarrativeDraft = Record<NarrativeSectionKey, string>;

export const EMPTY_NARRATIVE: NarrativeDraft = {
  headline: "",
  service_levels: "",
  backlog: "",
  consumption: "",
};

/**
 * The narrative the run stands on. A run read from an API older than the
 * editor answers no `narrative`, and its words are the newest version on the
 * pack, which was written as one paragraph: that is the headline.
 */
export function narrativeSectionsOf(run: Pick<ReviewRun, "narrative" | "pack">): NarrativeSection[] {
  const sent = run.narrative?.sections;
  if (sent) return sent;
  const text = latestNarrative(run.pack);
  return text ? [{ key: "headline", text }] : [];
}

/** Those sections as the panel's draft: every key present, missing ones empty. */
export function narrativeDraft(sections: readonly NarrativeSection[]): NarrativeDraft {
  const draft = { ...EMPTY_NARRATIVE };
  for (const section of sections) {
    if (section.key in draft) draft[section.key] = section.text;
  }
  return draft;
}

/** The PATCH body: every section once, in the deck's order, so no key is sent twice. */
export function narrativeBody(draft: NarrativeDraft): NarrativeSection[] {
  return NARRATIVE_SECTIONS.map(({ key }) => ({ key, text: draft[key] }));
}

/** True when the panel holds something the pack does not: what "my edits" means. */
export function narrativeChanged(draft: NarrativeDraft, saved: readonly NarrativeSection[]): boolean {
  const from = narrativeDraft(saved);
  return NARRATIVE_SECTIONS.some(({ key }) => draft[key].trim() !== from[key].trim());
}

/** True once a reviewer's edit is on the pack, which is what "Approve and send" ships. */
export function hasSavedEdit(run: Pick<ReviewRun, "narrative_source">): boolean {
  return run.narrative_source === "edited";
}

/** True while an edit is on the pack but not yet in the two files. */
export function needsRegenerate(run: Pick<ReviewRun, "narrative_rendered">): boolean {
  return run.narrative_rendered === false;
}

const SOURCE_LINE: Record<string, string> = {
  templated: "These words came from the template.",
  ai: "Axel wrote these words.",
  edited: "A reviewer rewrote these words.",
};

/**
 * Where the words in front of the reviewer came from, and why. An account
 * with Axel off is told so, rather than being left to wonder why the
 * narrative reads like a template: it is one, and nothing was going to write
 * it otherwise.
 */
export function narrativeSourceLine(
  run: Pick<ReviewRun, "narrative_source" | "narrative_version" | "ai_enabled" | "narrative_rendered">,
): string {
  if (!run.narrative_source) return "This run stored no pack, so there is no narrative to read.";
  const parts = [SOURCE_LINE[run.narrative_source] ?? SOURCE_LINE.templated];
  if (run.narrative_source === "edited" && run.narrative_version) parts.push(`Version ${run.narrative_version}.`);
  if (run.ai_enabled === false) parts.push("AI is off for this account, so Axel wrote nothing here.");
  if (needsRegenerate(run)) parts.push("The edit is not in the two files yet.");
  return parts.join(" ");
}

/** What the panel says it does with an edit that has not been regenerated. */
export const UNRENDERED_EDIT_NOTE =
  "Regenerate to see it in the PDF and the slides; approving rebuilds them first either way, so the words below are the words that ship.";

// Errors ------------------------------------------------------------------------------

export interface ReviewError extends ApiError {
  /** `not_under_review` carries the status the run actually has. */
  status_now?: string;
  /** `requester_cannot_approve` names who asked for the run. */
  requested_by?: string;
}

export function reviewError(error: unknown): ReviewError {
  const parsed = apiError(error) as ReviewError;
  const data = (error as { data?: Record<string, unknown> })?.data;
  if (data && typeof data === "object" && typeof data.status === "string") parsed.status_now = data.status;
  if (data && typeof data === "object" && typeof data.requested_by === "string")
    parsed.requested_by = data.requested_by;
  return parsed;
}

/**
 * The cancel body's reason is required by the API's own DTO, which answers a
 * plain validation 400 rather than a typed code, so the screen refuses an
 * empty reason itself and the message never depends on that shape.
 */
export const CANCEL_REASON_MESSAGE = "Say why this pack is not being sent.";

/** Every refusal the five review routes can answer, in words. */
export function describeReviewError(error: ReviewError): string {
  switch (error.code) {
    // The panel writes each section once, so this is a build that lost that
    // rule rather than anything the reviewer did.
    case "duplicate_section":
      return "The narrative was sent with the same section twice, so nothing was saved. Reload the screen and write it again.";
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
    // A reviewer is a second pair of eyes, so the person who asked for the
    // run is not the person who may approve it.
    case "requester_cannot_approve":
      return "You asked for this run, so somebody else has to approve it. Cancel it instead, or ask another reviewer.";
    case "not_found":
      return "This run no longer exists, or the account is not granted to you.";
    default:
      return describeError(error);
  }
}
