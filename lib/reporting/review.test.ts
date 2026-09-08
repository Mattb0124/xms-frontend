import { describe, expect, it } from "vitest";
import {
  CANCEL_REASON_MESSAGE,
  deadlineLine,
  describeReviewError,
  EMPTY_SECTION_LINE,
  isEmptySection,
  isHeld,
  latestNarrative,
  packSections,
  reviewError,
  reviewMoment,
  reviewPill,
  runStatusLabel,
} from "@/lib/reporting/review";
import { aHeldPack, aReviewRun } from "@/test-kit/reporting";

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
    expect(reviewMoment("2026-09-08T06:00:00Z")).toBe("2026-09-08 06:00");
    expect(reviewMoment(null)).toBeNull();
    expect(deadlineLine(aReviewRun())).toBe("Approve or cancel it before 2026-09-08 06:00.");
    expect(deadlineLine(aReviewRun({ status: "awaiting_review" }))).toBe(
      "The grace period passed at 2026-09-08 06:00 and nothing was sent. It is still yours to approve or cancel.",
    );
    expect(deadlineLine(aReviewRun({ review_due_at: null }))).toBe("No deadline was set on this run.");
    // A decided run has no deadline left to state.
    expect(deadlineLine(aReviewRun({ status: "sent", review_due_at: null }))).toBeNull();
  });

  it("reads the pack as the renditions present it, newest narrative first", () => {
    const pack = aHeldPack();
    expect(latestNarrative(pack)).toBe(
      "Volumes held steady and the consolidation cube incident is the only breach this week.",
    );
    expect(latestNarrative(aHeldPack({ narrative_versions: [] }))).toBe("");

    const sections = packSections(pack);
    expect(sections.map((section) => section.title)).toEqual([
      "Headline",
      "Service levels",
      "Backlog and notable requests",
      "Consumption",
    ]);
    expect(sections[0].paragraphs).toEqual([latestNarrative(pack)]);
    expect(sections[1].tiles).toContainEqual({ label: "Open requests", value: "120" });
    expect(sections[1].tiles).toContainEqual({ label: "Response met", value: "94%" });
    expect(sections[1].tiles).toContainEqual({ label: "Avg time to resolve", value: "11 h" });
    const tables = sections[2].tables;
    expect(tables.map((table) => table.caption)).toEqual(["Backlog by age", "Notable requests"]);
    expect(tables[0].rows).toContainEqual(["14 days or more", "18"]);
    expect(tables[1].rows[0]).toEqual(["CS0001204", "Consolidation cube will not load", "in progress", "P1", "2 d"]);
    expect(sections[3].paragraphs[0]).toBe("88 contract hours consumed this period; 100 hours logged in total.");
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

  it("words every refusal the three review routes answer", () => {
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
