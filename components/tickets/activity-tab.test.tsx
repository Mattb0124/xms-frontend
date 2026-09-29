import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuditRow, changeSentence, isIdentifier } from "@/components/tickets/activity-tab";
import type { TimelineItem } from "@/redux/ticketsApi";

const ASSIGNEE = "e783a8ab-8d9b-4ad2-a7a6-dd4aadc5753c";

function anAudit(overrides: Partial<TimelineItem> = {}): TimelineItem {
  return {
    kind: "audit",
    id: "a-1",
    actor_name: "Dev Administrator",
    actor_kind: "user",
    event_type: "ticket.updated",
    created_at: "2026-09-08T14:05:00Z",
    ...overrides,
  };
}

/**
 * The record showed "changed assignee id [empty]
 * e783a8ab-8d9b-4ad2-a7a6-dd4aadc5753c" on the running stack. A uuid says
 * nothing a reader can use, and the timeline carries no name to put in its
 * place, so the row says what happened and stops there.
 */
describe("an activity row whose values are identifiers", () => {
  it("recognises a uuid and nothing else", () => {
    expect(isIdentifier(ASSIGNEE)).toBe(true);
    expect(isIdentifier("Consolidation")).toBe(false);
    expect(isIdentifier(null)).toBe(false);
    expect(isIdentifier(4)).toBe(false);
  });

  it("says what happened, and drops the column's id suffix", () => {
    expect(changeSentence("assignee_id", null, ASSIGNEE)).toBe("set assignee");
    expect(changeSentence("assignee_id", ASSIGNEE, null)).toBe("cleared assignee");
    expect(changeSentence("group_id", ASSIGNEE, "11111111-1111-4111-8111-111111111111")).toBe("changed group");
    // A readable change is still spelled out in full, both values shown.
    expect(changeSentence("category", "Reporting", "Consolidation")).toBeNull();
  });

  it("draws no identifier in the row, and keeps a readable diff whole", () => {
    const { container: opaque } = render(
      <ul>
        <AuditRow item={anAudit({ field: "assignee_id", old_value: null, new_value: ASSIGNEE })} />
      </ul>,
    );
    expect(opaque.textContent).not.toContain(ASSIGNEE);
    expect(screen.getByText("set assignee")).toBeInTheDocument();

    render(
      <ul>
        <AuditRow item={anAudit({ id: "a-2", field: "category", old_value: "Reporting", new_value: "Close" })} />
      </ul>,
    );
    expect(screen.getByText("Reporting")).toHaveClass("line-through");
    expect(screen.getByText("Close")).toBeInTheDocument();
  });
});
