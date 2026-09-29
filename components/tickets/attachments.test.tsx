import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AttachmentRow, ScanChip, UploadList } from "@/components/tickets/attachments";
import { Composer } from "@/components/tickets/conversation-tab";
import type { Attachment } from "@/redux/attachmentsApi";

const attachment = (overrides: Partial<Attachment> = {}): Attachment => ({
  id: "att-1",
  ticket_id: "t-1",
  comment_id: null,
  work_note_id: null,
  file_name: "job.log",
  content_type: "text/plain",
  size_bytes: "2048",
  scan_state: "clean",
  scan_detail: null,
  origin: "email",
  visibility: "public",
  uploaded_by: "u-1",
  uploaded_by_name: "Pat Client",
  created_at: "2026-09-07T09:00:00Z",
  ...overrides,
});

describe("scan chips and rows", () => {
  it("renders the three scan states with the placeholder for a quarantined file", () => {
    render(
      <>
        <ScanChip state="pending" />
        <ScanChip state="clean" />
        <ScanChip state="quarantined" />
      </>,
    );
    expect(screen.getByText("Scanning")).toBeInTheDocument();
    expect(screen.getByText("Clean")).toBeInTheDocument();
    expect(screen.getByText("Quarantined")).toHaveAttribute("data-scan", "quarantined");
  });

  it("disables download unless clean, shows the origin and visibility chips and the quarantine placeholder", () => {
    const onDownload = vi.fn();
    render(
      <ul>
        <AttachmentRow attachment={attachment()} onDownload={onDownload} />
        <AttachmentRow
          attachment={attachment({
            id: "att-2",
            scan_state: "quarantined",
            origin: "portal",
            visibility: "internal",
            size_bytes: "5000000",
          })}
          onDownload={onDownload}
        />
      </ul>,
    );
    const buttons = screen.getAllByRole("button", { name: "Download" });
    expect(buttons[0]).toBeEnabled();
    expect(buttons[1]).toBeDisabled();
    fireEvent.click(buttons[0]);
    expect(onDownload).toHaveBeenCalledWith(expect.objectContaining({ id: "att-1" }));
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Portal")).toBeInTheDocument();
    expect(screen.getByText("Client visible")).toBeInTheDocument();
    expect(screen.getByText("Internal")).toBeInTheDocument();
    expect(screen.getByText("This file was quarantined by the malware scan")).toBeInTheDocument();
    expect(screen.getByText("2 KB")).toBeInTheDocument();
  });

  it("lists uploads with their stage and lets finished ones be dismissed", () => {
    const onRemove = vi.fn();
    render(
      <UploadList
        items={[
          { id: "u1", name: "a.png", size: 10, stage: "uploading", percent: 40 },
          { id: "u2", name: "b.png", size: 10, stage: "clean", percent: 100 },
          { id: "u3", name: "c.exe", size: 10, stage: "failed", percent: 0, error: "That file type is not accepted." },
        ]}
        onRemove={onRemove}
      />,
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "40");
    expect(screen.getByRole("alert")).toHaveTextContent("That file type is not accepted.");
    const dismiss = screen.getAllByRole("button", { name: "Dismiss" });
    expect(dismiss).toHaveLength(2);
    fireEvent.click(dismiss[0]);
    expect(onRemove).toHaveBeenCalledWith("u2");
  });
});

describe("Composer with a pending scan", () => {
  it("blocks Send and shows the reason until the acknowledgement lifts it", () => {
    const onSend = vi.fn(async () => undefined);
    const { rerender } = render(
      <Composer
        onSend={onSend}
        recipientLine="Emails the requester"
        blockedReason="A file is still being scanned."
        attachments={<span>files</span>}
      />,
    );
    fireEvent.change(screen.getByLabelText("Public reply"), { target: { value: "Here is the log" } });
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(screen.getByText("A file is still being scanned.")).toBeInTheDocument();
    expect(screen.getByText("files")).toBeInTheDocument();
    rerender(<Composer onSend={onSend} recipientLine="Emails the requester" attachments={<span>files</span>} />);
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  });
});
