import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InboundRow, OutboundRow, dispositionCopy, matchedByCopy } from "@/components/tickets/email-panel";

describe("email panel copy", () => {
  it("describes how a message matched and what became of it", () => {
    expect(matchedByCopy(null, "created")).toBe("Created this ticket");
    expect(matchedByCopy("plus_token", "appended")).toBe("Matched by the reply address");
    expect(matchedByCopy("in_reply_to", "appended")).toBe("Matched by In-Reply-To");
    expect(matchedByCopy("references", "appended")).toBe("Matched by the References chain");
    expect(matchedByCopy("subject_key", "appended")).toBe("Matched by the subject key");
    expect(matchedByCopy(null, "quarantined")).toBe("No thread match");
    expect(dispositionCopy("suppressed")).toBe("Suppressed");
    expect(dispositionCopy("appended")).toBe("Appended as a reply");
  });

  it("renders an inbound row with loop chips and a raw action, and an outbound row with its delivery state", () => {
    const onViewRaw = vi.fn();
    render(
      <ul>
        <InboundRow
          row={{
            id: "in-1",
            message_id: "<a@x>",
            from_address: "pat@client.test",
            from_name: "Pat Client",
            subject: "Cube refresh fails",
            received_at: "2026-09-07T09:00:00Z",
            sender_resolution: "known_contact",
            disposition: "suppressed",
            matched_by: null,
            loop_score: 150,
            loop_signals: ["auto_submitted", "auto_reply_subject"],
            attachment_count: 2,
            comment_id: null,
          }}
          onViewRaw={onViewRaw}
        />
        <OutboundRow
          row={{
            id: "out-1",
            kind: "public_comment",
            message_id: "<b@xms>",
            from_address: "brk@mail.xms.local",
            to_addresses: ["pat@client.test"],
            subject: "Re: [CS0001001] Cube refresh fails",
            created_at: "2026-09-07T09:05:00Z",
            state: "bounced",
          }}
        />
      </ul>,
    );
    expect(screen.getByText("Pat Client")).toBeInTheDocument();
    expect(screen.getByText("Suppressed")).toBeInTheDocument();
    expect(screen.getByText("auto submitted")).toBeInTheDocument();
    expect(screen.getByText("auto reply subject")).toBeInTheDocument();
    expect(screen.getByText("· 2 attachments")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View raw" }));
    expect(onViewRaw).toHaveBeenCalledWith(expect.objectContaining({ id: "in-1" }));
    expect(screen.getByText("Reply")).toBeInTheDocument();
    expect(screen.getByText("bounced")).toHaveAttribute("data-state", "awaiting-client");
  });
});
