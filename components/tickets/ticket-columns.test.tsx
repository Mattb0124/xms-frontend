import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QUEUE_DEFAULT_SORT, ticketColumns } from "@/components/tickets/ticket-columns";
import { DenseTable } from "@/components/xms/dense-table";
import type { ClockView } from "@/lib/tickets/sla";
import { aTicketView } from "@/test-kit/tickets";
import type { TicketView } from "@/redux/ticketsApi";

const accounts = new Map();

function clock(remainingMinutes: number): ClockView {
  return {
    kind: "resolution",
    dueAt: new Date(Date.now() + remainingMinutes * 60_000).toISOString(),
    remainingMinutes,
    paused: false,
    breached: false,
    met: false,
    targetMinutes: 480,
    pausedTotalMinutes: 0,
  };
}

const ROWS: TicketView[] = [
  aTicketView({ key: "CS1000001", sla: { resolution: clock(600) } }),
  aTicketView({ key: "CS1000002", sla: { resolution: clock(20) } }),
  aTicketView({ key: "CS1000003", sla: { resolution: clock(180) } }),
];

/**
 * Review finding 20: the built column order was Key, Type, Short
 * description, Account, State, Priority, Assignee, SLA, Updated, and the
 * list did not open on SLA. The prototype (Wireframes section 3.1) is Key,
 * Short description, Account, Type, Priority, State, Assignee, SLA,
 * Updated, and "SLA is the default sort".
 */
describe("the Queue columns", () => {
  it("runs in the prototype's order", () => {
    expect(ticketColumns({ accounts }).map((column) => column.title)).toEqual([
      "Key",
      "Short description",
      "Account",
      "Type",
      "Priority",
      "State",
      "Assignee",
      "SLA",
      "Updated",
    ]);
  });

  it("drops only the account column on a single-account list", () => {
    expect(ticketColumns({ accounts, hideAccount: true }).map((column) => column.key)).toEqual([
      "key",
      "short_description",
      "type",
      "priority",
      "state",
      "assignee",
      "sla",
      "updated",
    ]);
  });

  // The v3 render (01) ends the table at Assignee, so SLA is carried as a
  // hidden column: still sorted on, not drawn, and one click away on the card
  // header column control.
  it("keeps SLA and Updated hidden unless the clocks are asked for", () => {
    const quiet = ticketColumns({ accounts });
    expect(quiet.filter((column) => column.hidden).map((column) => column.key)).toEqual(["sla", "updated"]);
    const loud = ticketColumns({ accounts, showClocks: true });
    expect(loud.filter((column) => column.hidden)).toEqual([]);
  });

  it("opens on SLA with the tightest clock first", () => {
    expect(QUEUE_DEFAULT_SORT).toEqual({ key: "sla", direction: "asc" });
    render(
      <DenseTable<TicketView>
        title="Count"
        count={ROWS.length}
        columns={ticketColumns({ accounts, showClocks: true })}
        rows={ROWS}
        rowKey={(row) => row.key}
        defaultSort={QUEUE_DEFAULT_SORT}
      />,
    );
    const keys = screen
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.getAttribute("data-row-key"));
    expect(keys).toEqual(["CS1000002", "CS1000003", "CS1000001"]);
    expect(screen.getByRole("columnheader", { name: /SLA/ })).toHaveAttribute("aria-sort", "ascending");
  });

  it("leaves a table with no default sort in the order it was given", () => {
    render(
      <DenseTable<TicketView>
        title="Count"
        count={ROWS.length}
        columns={ticketColumns({ accounts })}
        rows={ROWS}
        rowKey={(row) => row.key}
      />,
    );
    const keys = screen
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.getAttribute("data-row-key"));
    expect(keys).toEqual(["CS1000001", "CS1000002", "CS1000003"]);
  });
});
