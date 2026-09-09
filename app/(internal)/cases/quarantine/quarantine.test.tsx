import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuarantineDecisionPanel, decisionCopy, reasonCopy } from "@/app/(internal)/cases/quarantine/page";
import type { QuarantineItem } from "@/redux/emailApi";

const item: QuarantineItem = {
  id: "q-1",
  reason: "unknown_sender",
  state: "open",
  decision: null,
  from_address: "newperson@client.test",
  from_name: "New Person",
  subject: "Access request",
  received_at: "2026-09-07T09:00:00Z",
  stripped_body_text: "Please grant me access to the planning cube.",
  created_at: "2026-09-07T09:00:00Z",
  resulting_ticket_id: null,
};

describe("quarantine decisions", () => {
  it("has the copy for reasons and decisions", () => {
    expect(reasonCopy("unknown_sender")).toBe("Unknown sender");
    expect(reasonCopy("scan_quarantined")).toBe("Malware scan");
    expect(decisionCopy("create_contact_and_ticket")).toBe("Contact and ticket created");
    expect(decisionCopy(null)).toBe("Open");
  });

  it("shows the stripped body, decides directly for the creating actions and asks a confirm for the destructive ones", () => {
    const onDecide = vi.fn();
    render(<QuarantineDecisionPanel item={item} onDecide={onDecide} onClose={() => undefined} />);
    expect(screen.getByText("Please grant me access to the planning cube.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create contact and ticket" }));
    expect(onDecide).toHaveBeenLastCalledWith("create_contact_and_ticket");
    fireEvent.click(screen.getByRole("button", { name: "Create ticket once" }));
    expect(onDecide).toHaveBeenLastCalledWith("create_ticket_once");

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onDecide).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "Confirm discard" }));
    expect(onDecide).toHaveBeenLastCalledWith("discard");

    fireEvent.click(screen.getByRole("button", { name: "Mark spam" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm mark spam" }));
    expect(onDecide).toHaveBeenLastCalledWith("mark_spam");
  });

  it("shows the decision instead of the buttons once decided", () => {
    render(
      <QuarantineDecisionPanel
        item={{ ...item, state: "decided", decision: "discard" }}
        onDecide={() => undefined}
        onClose={() => undefined}
      />,
    );
    expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();
    expect(screen.getByText("Discarded")).toBeInTheDocument();
  });
});
