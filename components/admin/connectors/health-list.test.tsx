import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConnectorHealthList } from "@/components/admin/connectors/health-list";
import { HealthPill, LinkStatePill, ModePill, OutcomePill } from "@/components/admin/connectors/pills";
import { aHealthRow } from "@/test-kit/connectors";

describe("connector pills", () => {
  it("puts health, mode, link state and outcome on the signal trios", () => {
    render(
      <>
        <HealthPill health="healthy" />
        <HealthPill health="degraded" />
        <HealthPill health="failing" />
        <HealthPill health="tripped" reason="Client outage" />
        <ModePill mode="off" />
        <ModePill mode="ingest_only" />
        <LinkStatePill state="conflict" />
        <LinkStatePill state="pending_external" />
        <OutcomePill outcome="dead_lettered" />
        <OutcomePill outcome="skipped_policy" />
      </>,
    );
    expect(screen.getByText("Healthy")).toHaveAttribute("data-state", "complete");
    expect(screen.getByText("Degraded")).toHaveAttribute("data-state", "needs-input");
    expect(screen.getByText("Failing")).toHaveAttribute("data-state", "overdue");
    expect(screen.getByText("Tripped")).toHaveAttribute("data-state", "overdue");
    expect(screen.getByText("Tripped")).toHaveAttribute("title", "Client outage");
    expect(screen.getByText("Off")).toHaveAttribute("data-state", "blocked");
    expect(screen.getByText("Ingest only")).toHaveAttribute("data-state", "ready");
    expect(screen.getByText("Conflict")).toHaveAttribute("data-state", "overdue");
    expect(screen.getByText("Pending in ServiceNow")).toHaveAttribute("data-state", "needs-input");
    expect(screen.getByText("Dead lettered")).toHaveAttribute("data-state", "overdue");
    expect(screen.getByText("Skipped (policy)")).toHaveAttribute("data-state", "ready");
  });
});

describe("ConnectorHealthList", () => {
  it("renders one row per instance with the account name, the counts, the lag and a link to the record", () => {
    render(
      <ConnectorHealthList
        accountNames={{ "acct-1": "Brookfield UK" }}
        rows={[
          aHealthRow({ id: "i-1", name: "Brookfield CSM", inbound_lag_seconds: 125 }),
          aHealthRow({
            id: "i-2",
            account_id: "acct-2",
            name: "Dev ITSM",
            health: "failing",
            mode: "off",
            pending_inbox: 7,
            open_dead_letters: 3,
            last_error: "HTTP 500 from the instance",
          }),
        ]}
      />,
    );
    expect(screen.getByText("Brookfield UK")).toBeInTheDocument();
    expect(screen.getByText("acct-2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Brookfield CSM" })).toHaveAttribute("href", "/admin/connectors/i-1");
    expect(screen.getByText("Failing")).toHaveAttribute("data-state", "overdue");
    expect(screen.getByText("2m 5s")).toBeInTheDocument();
    expect(screen.getByText("3")).toHaveAttribute("data-dead-letters", "3");
    expect(screen.getByText("HTTP 500 from the instance")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("draws the outbound columns on every list now that the route answers them", () => {
    render(<ConnectorHealthList rows={[aHealthRow({ id: "i-1", mode: "bidirectional" })]} />);
    expect(screen.getByText("Outbound pending")).toBeInTheDocument();
    expect(screen.getByText("Outbound dead lettered")).toBeInTheDocument();
  });

  it("prints a blank, never a zero, for a count an older API did not answer", () => {
    const row = aHealthRow({ id: "i-1", mode: "bidirectional" });
    delete row.pending_outbound;
    delete row.dead_lettered_outbound;
    const { container } = render(<ConnectorHealthList rows={[row]} />);
    expect(screen.getByText("Outbound pending")).toBeInTheDocument();
    const pending = container.querySelector("[data-pending-outbound]");
    const dead = container.querySelector("[data-dead-lettered-outbound]");
    expect(pending).toHaveAttribute("data-pending-outbound", "");
    expect(pending).toHaveTextContent("");
    expect(dead).toHaveAttribute("data-dead-lettered-outbound", "");
    expect(dead).toHaveTextContent("");
  });

  it("shows the outbound backlog beside the ingest figures where the API sends it", () => {
    render(
      <ConnectorHealthList
        rows={[
          aHealthRow({ id: "i-1", mode: "bidirectional", pending_inbox: 1, pending_outbound: 4 }),
          aHealthRow({
            id: "i-2",
            name: "Dev ITSM",
            mode: "bidirectional",
            pending_outbound: 0,
            dead_lettered_outbound: 2,
          }),
        ]}
      />,
    );
    expect(screen.getByText("Outbound pending")).toBeInTheDocument();
    // The Count card's own total prints the same digits, so the cells are
    // read by the attribute they carry.
    const cell = (label: string, attribute: string) =>
      screen.getAllByText(label).find((element) => element.hasAttribute(attribute));
    expect(cell("4", "data-pending-outbound")).toBeInTheDocument();
    expect(cell("2", "data-dead-lettered-outbound")).toBeInTheDocument();
  });

  it("shows the empty state when there are no instances", () => {
    render(<ConnectorHealthList rows={[]} />);
    expect(screen.getByText(/No connector instances/)).toBeInTheDocument();
  });
});
