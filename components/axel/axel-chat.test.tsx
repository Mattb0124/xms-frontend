import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AxelChat } from "@/components/axel/axel-chat";
import { renderDesk } from "@/test-kit/desk";

const TICKET_ID = "6b0d6c1d-258c-42ae-b0f9-8af931066500";

/** One turn's worth of frames, delivered as the adapter delivers them. */
function sse(frames: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(`data: ${frame}\n\n`));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
}

interface Sent {
  url: string;
  body: unknown;
}

function stubTurn(frames: string[]): Sent[] {
  const sent: Sent[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      sent.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      return sse(frames);
    }),
  );
  return sent;
}

afterEach(() => vi.unstubAllGlobals());

describe("AxelChat", () => {
  it("greets the reader by name and offers the quick starts", () => {
    renderDesk(<AxelChat ticketId={TICKET_ID} ticketKey="CS1000008" onClose={() => {}} />);
    // No principal is loaded in a bare render, so the greeting falls back
    // rather than saying "Hey , I'm Axel."
    expect(screen.getByRole("heading", { name: "Hi, I'm Axel." })).toBeInTheDocument();
    expect(screen.getByText(/Ask me anything about CS1000008/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Summarise this ticket" })).toBeInTheDocument();
    expect(screen.getByLabelText("Ask Axel")).toBeEnabled();
  });

  it("sends a quick start as an ordinary message", async () => {
    const sent = stubTurn(['{"content":"Here is the summary."}']);
    renderDesk(<AxelChat ticketId={TICKET_ID} ticketKey="CS1000008" onClose={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Summarise this ticket" }));

    await waitFor(() => expect(screen.getByText("Here is the summary.")).toBeInTheDocument());
    expect(sent[0]?.body).toMatchObject({ message: "Summarise this ticket", ticket_id: TICKET_ID });
  });

  it("streams the answer into the transcript and keeps what was asked", async () => {
    const sent = stubTurn([
      '{"type":"thread_created","thread_id":"th-1"}',
      // Answer text is a frame carrying `content` and no `type` at all,
      // which is the adapter's own shape (lib/axel/sse.ts).
      '{"content":"The report is slow because "}',
      '{"content":"the cube is stale."}',
    ]);
    renderDesk(<AxelChat ticketId={TICKET_ID} ticketKey="CS1000008" onClose={() => {}} />);

    fireEvent.change(screen.getByLabelText("Ask Axel"), { target: { value: "Why is this slow?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(screen.getByText("The report is slow because the cube is stale.")).toBeInTheDocument());
    expect(screen.getByText("Why is this slow?")).toBeInTheDocument();
    // The greeting steps aside once there is a conversation to show, but the
    // composer below it is the same composer and stays put.
    expect(screen.queryByRole("heading", { name: "Hi, I'm Axel." })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Ask Axel")).toBeInTheDocument();
    // The turn goes to the adapter against the ticket in context, as the
    // route requires, and never with a ticket the surface invented.
    expect(sent[0]?.url).toContain("/v1/axel/turns");
    expect(sent[0]?.body).toMatchObject({ agent: "desk_assistant", ticket_id: TICKET_ID });
  });

  it("says what an error frame said rather than failing silently", async () => {
    stubTurn(['{"type":"error","code":"withheld","error":"below_threshold"}']);
    renderDesk(<AxelChat ticketId={TICKET_ID} ticketKey="CS1000008" onClose={() => {}} />);

    fireEvent.change(screen.getByLabelText("Ask Axel"), { target: { value: "Summarise this" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(screen.getByText(/withheld this turn/i)).toBeInTheDocument());
  });

  it("refuses to send off a record, and offers no quick start it could not run", () => {
    renderDesk(<AxelChat ticketId={null} onClose={() => {}} />);
    expect(screen.getByText(/Open a ticket and ask me about it/)).toBeInTheDocument();
    expect(screen.getByLabelText("Ask Axel")).toBeDisabled();
    expect(screen.getByText(/Axel answers against a ticket/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Summarise this ticket" })).not.toBeInTheDocument();
  });

  it("closes on the control and on Escape", () => {
    const onClose = vi.fn();
    renderDesk(<AxelChat ticketId={TICKET_ID} ticketKey="CS1000008" onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("names itself when it opens, so the move is announced", () => {
    renderDesk(<AxelChat ticketId={TICKET_ID} ticketKey="CS1000008" onClose={() => {}} />);
    expect(screen.getByRole("heading", { name: "Hi, I'm Axel." })).toHaveFocus();
  });
});
