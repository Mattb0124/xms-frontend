import { describe, expect, it } from "vitest";
import {
  OUTBOUND_STATUSES,
  conflictSummary,
  dropReasonLabel,
  droppedFields,
  isRetryable,
  keptFields,
  outboundEventLabel,
  outboundStatusLabel,
  outboundStatusTone,
  pendingLabel,
} from "@/lib/connectors/outbound";
import { aConflictOutcome } from "@/test-kit/connectors";

describe("the outbound queue vocabulary", () => {
  it("puts each status on a signal tone and names it", () => {
    expect(OUTBOUND_STATUSES.map((entry) => entry.value)).toEqual([
      "pending",
      "sent",
      "failed",
      "dead_lettered",
      "skipped",
    ]);
    expect(outboundStatusLabel("dead_lettered")).toBe("Dead lettered");
    expect(outboundStatusLabel("skipped")).toBe("Skipped by policy");
    expect(outboundStatusTone("sent")).toBe("complete");
    expect(outboundStatusTone("pending")).toBe("ready");
    expect(outboundStatusTone("failed")).toBe("needs-input");
    expect(outboundStatusTone("dead_lettered")).toBe("overdue");
    expect(outboundStatusTone("skipped")).toBe("blocked");
  });

  it("offers a retry only on a settled failure", () => {
    expect(isRetryable("failed")).toBe(true);
    expect(isRetryable("dead_lettered")).toBe(true);
    expect(isRetryable("pending")).toBe(false);
    expect(isRetryable("sent")).toBe(false);
    expect(isRetryable("skipped")).toBe(false);
  });

  it("names each event and leaves an unknown one as it came", () => {
    expect(outboundEventLabel("ticket.transitioned")).toBe("State changed");
    expect(outboundEventLabel("work_note.created")).toBe("Work note");
    expect(outboundEventLabel("attachment.scanned")).toBe("Attachment");
    expect(outboundEventLabel("something.new")).toBe("something.new");
  });

  it("counts what is waiting to send", () => {
    expect(pendingLabel(0)).toBe("Nothing waiting to send");
    expect(pendingLabel(1)).toBe("1 change waiting to send");
    expect(pendingLabel(4)).toBe("4 changes waiting to send");
  });
});

describe("the conflict outcome", () => {
  it("reads the kept and dropped fields the worker recorded", () => {
    const conflict = aConflictOutcome();
    expect(keptFields(conflict)).toEqual(["short_description"]);
    expect(droppedFields(conflict)).toEqual([{ field: "client_notes", policy: "external", reason: "external_owned" }]);
    expect(conflictSummary(conflict)).toBe("The last push kept short_description and dropped client_notes.");
  });

  it("says nothing when the row was never contested", () => {
    expect(conflictSummary(null)).toBeNull();
    expect(conflictSummary({})).toBeNull();
    expect(keptFields(undefined)).toEqual([]);
    expect(droppedFields(undefined)).toEqual([]);
    expect(conflictSummary(aConflictOutcome({ kept: [], dropped: [] }))).toBeNull();
  });

  it("words each drop reason and passes an unknown one through", () => {
    expect(dropReasonLabel("external_owned")).toBe("ServiceNow owns this field");
    expect(dropReasonLabel("older")).toBe("the client's change is newer");
    expect(dropReasonLabel("none")).toBe("this field is never sent");
    expect(dropReasonLabel("brand_new")).toBe("brand_new");
  });

  it("summarizes a push that only dropped", () => {
    const conflict = aConflictOutcome({
      kept: [],
      dropped: [
        { field: "short_description", policy: "external", reason: "external_owned" },
        { field: "impact", policy: "newest", reason: "older" },
      ],
    });
    expect(conflictSummary(conflict)).toBe("The last push dropped short_description, impact.");
  });
});
