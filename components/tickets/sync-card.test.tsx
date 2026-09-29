import { render, screen, waitFor } from "@testing-library/react";
import { formatMoment } from "@/lib/format/date";
import { afterEach, describe, expect, it, vi } from "vitest";
import { modeNotice, SyncCard, SyncCardView } from "@/components/tickets/sync-card";
import { aLink, aRun, aSyncCardOutbound } from "@/test-kit/connectors";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

describe("SyncCardView", () => {
  it("shows the external number as plain text when the instance base URL is not a web address", () => {
    // The base URL is server-supplied and lands in an href (security review
    // finding 26); a hostile one must not become a link.
    render(<SyncCardView links={[aLink({ base_url: "javascript:alert(1)" })]} runs={[aRun()]} />);
    expect(screen.queryByRole("link", { name: "CS0012345" })).not.toBeInTheDocument();
    expect(screen.getByText("CS0012345")).toBeInTheDocument();
  });

  /**
   * Render 07 draws the tab as two blocks: what a person needs to be told,
   * on the note ground, then the facts in mono, one a line. They used to be
   * scattered through the card at 11 and 12px between sentences.
   */
  it("draws the tab as one note block and one block of facts", () => {
    const { container } = render(<SyncCardView links={[aLink()]} runs={[aRun()]} flush />);
    const note = container.querySelector(".xms-note");
    expect(note).not.toBeNull();
    expect(note).toHaveTextContent("Synced with Brookfield CSM.");
    expect(note).toHaveTextContent("Updates are not sent to ServiceNow.");
    const facts = container.querySelector(".xms-mono");
    expect(facts).not.toBeNull();
    expect(facts).toHaveTextContent("external record:");
    expect(facts).toHaveTextContent("direction: ingest only");
    expect(facts).toHaveTextContent("kill switch armed, not tripped");
    // The rail keeps its compact stack: 262px has room for neither block.
    const { container: rail } = render(<SyncCardView links={[aLink()]} runs={[aRun()]} />);
    expect(rail.querySelector(".xms-note")).toBeNull();
  });

  it("renders nothing without links", () => {
    const { container } = render(<SyncCardView links={[]} runs={[aRun()]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("links the external number to the ServiceNow record and states the ingest-only notice", () => {
    render(
      <SyncCardView
        links={[aLink()]}
        runs={[aRun(), aRun({ id: "run-2", direction: "out", outcome: "skipped_mode" })]}
      />,
    );
    const link = screen.getByRole("link", { name: "CS0012345" });
    expect(link).toHaveAttribute(
      "href",
      "https://brookfield.service-now.com/nav_to.do?uri=sn_customerservice_case.do%3Fsys_id%3Dabc123",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("Linked")).toHaveAttribute("data-state", "complete");
    expect(screen.getByText("Brookfield CSM, ingest only, healthy")).toBeInTheDocument();
    expect(screen.getByText("Updates are not sent to ServiceNow.")).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`last in ${formatMoment("2026-09-07T09:12:00Z")}`))).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Recent runs" }).children).toHaveLength(2);
    expect(screen.getByText("Skipped (mode)")).toHaveAttribute("data-state", "ready");
  });

  it("shows the conflict fields when the link is in conflict and the tripped notice when the switch tripped", () => {
    render(
      <SyncCardView
        links={[
          aLink({
            state: "conflict",
            health: "tripped",
            last_conflict: { fields: ["category", "short_description"], at: "2026-09-07T09:30:00Z" },
          }),
        ]}
        runs={[]}
      />,
    );
    expect(screen.getByText("Conflict")).toHaveAttribute("data-state", "overdue");
    expect(screen.getByText(/ServiceNow changed category, short_description that XMS owns/)).toHaveAttribute(
      "data-conflict",
      "category,short_description",
    );
    expect(screen.getByText(/Kill switch tripped/)).toBeInTheDocument();
    expect(modeNotice(aLink({ mode: "off" }))).toBe("Sync is off for this instance.");
    expect(modeNotice(aLink({ mode: "bidirectional" }))).toBeNull();
  });

  it("shows the outbound state: the last push, what is waiting and the last send error", () => {
    render(
      <SyncCardView
        links={[
          aLink({
            mode: "bidirectional",
            outbound: aSyncCardOutbound({
              last_pushed_at: "2026-09-07T09:40:00Z",
              pending: 2,
              failed: 1,
              last_error: "HTTP 401 from the instance",
            }),
          }),
        ]}
        runs={[]}
      />,
    );
    expect(screen.getByText(new RegExp(`last pushed ${formatMoment("2026-09-07T09:40:00Z")}`))).toBeInTheDocument();
    expect(screen.getByText("2 changes waiting to send, 1 failed")).toBeInTheDocument();
    expect(screen.getByText(/HTTP 401 from the instance/)).toHaveAttribute("data-outbound-error");
  });

  it("says nothing about sending when the instance has never sent and nothing waits", () => {
    render(
      <SyncCardView
        links={[aLink({ mode: "ingest_only", outbound: aSyncCardOutbound({ last_pushed_at: null }) })]}
        runs={[]}
      />,
    );
    expect(screen.queryByText(/waiting to send/)).not.toBeInTheDocument();
    expect(screen.queryByText(/last pushed/)).not.toBeInTheDocument();
  });

  it("keeps the queue in view on an instance dropped back to ingest only", () => {
    render(
      <SyncCardView
        links={[aLink({ mode: "ingest_only", outbound: aSyncCardOutbound({ last_pushed_at: null, pending: 3 }) })]}
        runs={[]}
      />,
    );
    expect(screen.getByText("Updates are not sent to ServiceNow.")).toBeInTheDocument();
    expect(screen.getByText("3 changes waiting to send")).toBeInTheDocument();
    expect(screen.getByText(/last pushed never/)).toBeInTheDocument();
  });

  it("words a conflict the last push lost, rather than the inbound one", () => {
    render(
      <SyncCardView
        links={[
          aLink({
            mode: "bidirectional",
            state: "conflict",
            last_conflict: { direction: "out", fields: ["short_description"], at: "2026-09-07T09:45:00Z" },
            outbound: aSyncCardOutbound({ pending: 0 }),
          }),
        ]}
        runs={[]}
      />,
    );
    const note = screen.getByText(/The last push left short_description behind/);
    expect(note).toHaveAttribute("data-conflict-direction", "out");
    expect(note).toHaveAttribute("data-conflict", "short_description");
    expect(note.textContent).toContain("ServiceNow owns that field");
  });
});

describe("SyncCard", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("stays hidden when the ticket has no links and renders once a link arrives", async () => {
    const calls = stubFetch({ "GET /v1/tickets/t-1/sync": () => json({ links: [], runs: [] }) });
    const hidden = renderDesk(<SyncCard ticketId="t-1" />);
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(hidden.container.querySelector("section")).toBeNull();
    hidden.unmount();
    vi.unstubAllGlobals();

    stubFetch({ "GET /v1/tickets/t-2/sync": () => json({ links: [aLink()], runs: [aRun()] }) });
    renderDesk(<SyncCard ticketId="t-2" />);
    await screen.findByRole("link", { name: "CS0012345" });
    expect(screen.getByLabelText("Sync")).toBeInTheDocument();
  });
});
