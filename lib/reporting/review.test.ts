import { describe, expect, it } from "vitest";
import { formatMoment } from "@/lib/format/date";
import {
  CANCEL_REASON_MESSAGE,
  deadlineLine,
  describeReviewError,
  EMPTY_SECTION_LINE,
  hasSavedEdit,
  isEmptySection,
  isHeld,
  latestNarrative,
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
  runStatusLabel,
} from "@/lib/reporting/review";
import { aHeldPack, anEditedReviewRun, aReviewRun } from "@/test-kit/reporting";

describe("the review vocabulary", () => {
  it("knows which statuses are still held and words each one", () => {
    expect(isHeld("ready_for_review")).toBe(true);
    expect(isHeld("awaiting_review")).toBe(true);
    expect(isHeld("sent")).toBe(false);
    expect(isHeld("skipped")).toBe(false);
    expect(runStatusLabel("awaiting_review")).toBe("Awaiting review");
    expect(runStatusLabel("skipped")).toBe("Cancelled");
    expect(runStatusLabel("something_new")).toBe("something new");
  });

  it("puts the review state on the signal trios and leaves an untouched run without a pill", () => {
    expect(reviewPill("ready_for_review")).toEqual({ tone: "needs-input", label: "Ready for review" });
    expect(reviewPill("awaiting_review")).toEqual({ tone: "overdue", label: "Awaiting review" });
    expect(reviewPill("approved")).toEqual({ tone: "ready", label: "Approved" });
    expect(reviewPill("skipped")).toEqual({ tone: "blocked", label: "Cancelled" });
    // A run that never went through review carries no review pill at all.
    expect(reviewPill("sent")).toBeNull();
    expect(reviewPill("failed")).toBeNull();
    expect(reviewPill("generating")).toBeNull();
  });

  it("says when the decision is due, and that a passed deadline sent nothing", () => {
    expect(reviewMoment("2026-09-08T06:00:00Z")).toBe(formatMoment("2026-09-08T06:00:00Z"));
    expect(reviewMoment(null)).toBeNull();
    expect(deadlineLine(aReviewRun())).toBe(`Approve or cancel it before ${formatMoment("2026-09-08T06:00:00Z")}.`);
    expect(deadlineLine(aReviewRun({ status: "awaiting_review" }))).toBe(
      `The grace period passed at ${formatMoment("2026-09-08T06:00:00Z")} and nothing was sent. It is still yours to approve or cancel.`,
    );
    expect(deadlineLine(aReviewRun({ review_due_at: null }))).toBe("No deadline was set on this run.");
    // A decided run has no deadline left to state.
    expect(deadlineLine(aReviewRun({ status: "sent", review_due_at: null }))).toBeNull();
  });

  it("reads the pack as the renditions present it, with the prose the run carries", () => {
    const pack = aHeldPack();
    expect(latestNarrative(pack)).toBe(
      "Volumes held steady and the consolidation cube incident is the only breach this week.",
    );
    expect(latestNarrative(aHeldPack({ narrative_versions: [] }))).toBe("");

    const sections = packSections(pack, narrativeSectionsOf(aReviewRun()));
    expect(sections.map((section) => section.title)).toEqual([
      "Headline",
      "Service levels",
      "Backlog and notable requests",
      "Consumption",
    ]);
    expect(sections.map((section) => section.key)).toEqual(["headline", "service_levels", "backlog", "consumption"]);
    expect(sections[0].paragraphs).toEqual([
      "Volumes held steady and the consolidation cube incident is the only breach.",
    ]);
    expect(sections[1].tiles).toContainEqual({ label: "Open requests", value: "120" });
    expect(sections[1].tiles).toContainEqual({ label: "Response met", value: "94%" });
    expect(sections[1].tiles).toContainEqual({ label: "Avg time to resolve", value: "11 h" });
    const tables = sections[2].tables;
    expect(tables.map((table) => table.caption)).toEqual(["Backlog by age", "Notable requests"]);
    expect(tables[0].rows).toContainEqual(["14 days or more", "18"]);
    expect(tables[1].rows[0]).toEqual(["CS0001204", "Consolidation cube will not load", "in progress", "P1", "2 d"]);
    // The section's own prose comes first and the measure sentence follows it,
    // rather than one replacing the other.
    expect(sections[3].paragraphs).toEqual([
      "Consumption is tracking to plan.",
      "88 contract hours consumed this period; 100 hours logged in total.",
    ]);
    // With no narrative passed the numbers stand alone, which is what the
    // screen draws while the editable panel is holding the prose.
    expect(packSections(pack)[0].paragraphs).toEqual([]);
  });

  /**
   * The narrative panel (functional 5.8). The four keys are the renditions'
   * own sections, the draft is what the reviewer is typing, and "my edits"
   * means the draft differs from what the pack holds.
   */
  describe("the narrative panel", () => {
    it("reads the run's sections, and falls back to the pack on an API older than the editor", () => {
      expect(narrativeSectionsOf(aReviewRun())).toEqual(aReviewRun().narrative!.sections);
      const older = aReviewRun({ narrative: undefined });
      expect(narrativeSectionsOf(older)).toEqual([{ key: "headline", text: latestNarrative(aHeldPack()) }]);
      expect(narrativeSectionsOf(aReviewRun({ narrative: undefined, pack: null }))).toEqual([]);
    });

    it("fills every key of the draft and writes each one back exactly once", () => {
      const draft = narrativeDraft(aReviewRun().narrative!.sections);
      expect(draft).toEqual({
        headline: "Volumes held steady and the consolidation cube incident is the only breach.",
        service_levels: "",
        backlog: "",
        consumption: "Consumption is tracking to plan.",
      });
      const body = narrativeBody({ ...draft, backlog: "The backlog is flat." });
      expect(body.map((section) => section.key)).toEqual(["headline", "service_levels", "backlog", "consumption"]);
      expect(new Set(body.map((section) => section.key)).size).toBe(body.length);
      expect(body[2]).toEqual({ key: "backlog", text: "The backlog is flat." });
    });

    it("knows when the panel holds something the pack does not", () => {
      const saved = aReviewRun().narrative!.sections;
      const draft = narrativeDraft(saved);
      expect(narrativeChanged(draft, saved)).toBe(false);
      // Whitespace either side of the same words is not an edit.
      expect(narrativeChanged({ ...draft, headline: `  ${draft.headline}  ` }, saved)).toBe(false);
      expect(narrativeChanged({ ...draft, backlog: "The backlog is flat." }, saved)).toBe(true);
      // Clearing a section is an edit: leaving it out is how the panel clears it.
      expect(narrativeChanged({ ...draft, headline: "" }, saved)).toBe(true);
    });

    it("says whose words these are, and that AI is off for the account", () => {
      expect(narrativeSourceLine(aReviewRun())).toBe(
        "These words came from the template. AI is off for this account, so Axel wrote nothing here.",
      );
      expect(narrativeSourceLine(aReviewRun({ ai_enabled: true }))).toBe("These words came from the template.");
      expect(narrativeSourceLine(aReviewRun({ narrative_source: "ai", ai_enabled: true }))).toBe(
        "Axel wrote these words.",
      );
      expect(narrativeSourceLine(anEditedReviewRun({ ai_enabled: true }))).toBe(
        "A reviewer rewrote these words. Version 3. The edit is not in the two files yet.",
      );
      // A run with no pack has no narrative to account for at all.
      expect(narrativeSourceLine(aReviewRun({ narrative_source: null }))).toMatch(/stored no pack/);
    });

    it("knows a saved edit from one still waiting to reach the files", () => {
      expect(hasSavedEdit(aReviewRun())).toBe(false);
      expect(hasSavedEdit(anEditedReviewRun())).toBe(true);
      expect(needsRegenerate(aReviewRun())).toBe(false);
      expect(needsRegenerate(anEditedReviewRun())).toBe(true);
      // An API that answers nothing about rendering is not claiming a stale edit.
      expect(needsRegenerate(aReviewRun({ narrative_rendered: undefined }))).toBe(false);
    });
  });

  it("leaves a table out when it has no rows and marks a section that carries nothing", () => {
    const bare = aHeldPack({
      narrative_versions: [],
      notable: [],
      measures: {
        ...aHeldPack().measures,
        backlog_by_age: { "0_1d": 0, "1_3d": 0, "3_7d": 0, "7_14d": 0, "14d_plus": 0 },
        mttr_minutes: null,
      },
    });
    const sections = packSections(bare);
    expect(sections[2].tables).toEqual([]);
    expect(isEmptySection(sections[0])).toBe(true);
    expect(isEmptySection(sections[2])).toBe(true);
    // Tiles always carry a figure, so service levels is never the empty line.
    expect(isEmptySection(sections[1])).toBe(false);
    expect(sections[1].tiles).toContainEqual({ label: "Avg time to resolve", value: "n/a" });
    expect(EMPTY_SECTION_LINE).toBe("No activity this period.");
  });

  it("words every refusal the five review routes answer", () => {
    expect(describeReviewError(reviewError({ status: 400, data: { code: "duplicate_section" } }))).toMatch(
      /same section twice, so nothing was saved/,
    );
    const notUnderReview = reviewError({ status: 409, data: { code: "not_under_review", status: "sent" } });
    expect(notUnderReview.status_now).toBe("sent");
    expect(describeReviewError(notUnderReview)).toBe(
      "This run is no longer waiting on a reviewer: it is sent. It has been reloaded.",
    );
    expect(describeReviewError(reviewError({ status: 409, data: { code: "not_under_review" } }))).toBe(
      "This run is no longer waiting on a reviewer. It has been reloaded.",
    );
    expect(describeReviewError(reviewError({ status: 409, data: { code: "run_without_schedule" } }))).toMatch(
      /generated by hand/,
    );
    expect(describeReviewError(reviewError({ status: 409, data: { code: "run_without_pack" } }))).toMatch(
      /nothing to send/,
    );
    expect(describeReviewError(reviewError({ status: 404, data: { code: "not_found" } }))).toMatch(/no longer exists/);
    expect(
      describeReviewError(reviewError({ status: 400, data: { code: "validation_failed", details: ["reason"] } })),
    ).toBe("reason");
    expect(describeReviewError(reviewError({ status: 400, data: { code: "validation_failed" } }))).toBe(
      CANCEL_REASON_MESSAGE,
    );
  });
});
