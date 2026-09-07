import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Composer, MessageRow } from "@/components/tickets/conversation-tab";

describe("Composer", () => {
  it("switches between a public reply and a work note and sends the mode with the body", async () => {
    const onSend = vi.fn(async () => undefined);
    render(<Composer onSend={onSend} recipientLine="Emails the requester" />);
    const form = screen.getByRole("form", { name: "Composer" });
    expect(form).toHaveAttribute("data-mode", "reply");
    expect(screen.getByText("Emails the requester")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Work note" }));
    expect(form).toHaveAttribute("data-mode", "note");
    expect(screen.getByText("Internal, never leaves")).toBeInTheDocument();
    expect(screen.getByText("Visible to the team only")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Work note"), { target: { value: "Client admin is slow" } });
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    await waitFor(() => expect(onSend).toHaveBeenCalledWith("note", "Client admin is slow"));
    expect(screen.getByLabelText("Work note")).toHaveValue("");

    fireEvent.click(screen.getByRole("tab", { name: "Reply to client" }));
    fireEvent.change(screen.getByLabelText("Public reply"), { target: { value: "On it" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(onSend).toHaveBeenLastCalledWith("reply", "On it"));
  });

  it("does not send an empty body", () => {
    const onSend = vi.fn(async () => undefined);
    render(<Composer onSend={onSend} recipientLine="x" />);
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });
});

describe("MessageRow", () => {
  it("labels a work note as internal and a comment as public with its first-response marker", () => {
    render(
      <>
        <MessageRow
          item={{
            kind: "work_note",
            id: "n1",
            actor_name: "Cara Lee",
            actor_kind: "user",
            body: "note",
            created_at: "2026-09-07T10:00:00Z",
          }}
        />
        <MessageRow
          item={{
            kind: "comment",
            id: "c1",
            actor_name: "Cara Lee",
            actor_kind: "user",
            body: "reply",
            source: "internal",
            is_first_response: true,
            created_at: "2026-09-07T10:05:00Z",
          }}
        />
      </>,
    );
    expect(screen.getByText("Internal")).toBeInTheDocument();
    expect(screen.getByText("Public · internal")).toBeInTheDocument();
    expect(screen.getByText("First response")).toBeInTheDocument();
  });
});
