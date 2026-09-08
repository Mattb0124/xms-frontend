import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { modeNotice, SyncCard, SyncCardView } from "@/components/tickets/sync-card";
import { aLink, aRun } from "@/redux/connectorsApi.test";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

describe("SyncCardView", () => {
  it("shows the external number as plain text when the instance base URL is not a web address", () => {
    // The base URL is server-supplied and lands in an href (security review
    // finding 26); a hostile one must not become a link.
    render(<SyncCardView links={[aLink({ base_url: "javascript:alert(1)" })]} runs={[aRun()]} />);
    expect(screen.queryByRole("link", { name: "CS0012345" })).not.toBeInTheDocument();
    expect(screen.getByText("CS0012345")).toBeInTheDocument();
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
    expect(screen.getByText(/last in 2026-09-07 09:12/)).toBeInTheDocument();
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
