import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QUEUE_DEFAULT_SORT, attentionColumns, openedDate, ticketColumns } from "@/components/tickets/ticket-columns";
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
 * Updated, and "SLA is the default sort". Opened was added after it, between
 * State and Assignee, on the reviewer's ask.
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
      "Opened",
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
      "opened",
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
        title="Queue"
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
        title="Queue"
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

  // The reviewer asked for the date the request arrived: "Updated" answers a
  // different question and a queue read for age could not answer this one.
  it("dates the Opened cell in mono, sorted on the instant and not the words", () => {
    const columns = ticketColumns({ accounts });
    const opened = columns.find((column) => column.key === "opened");
    expect(opened?.mono).toBe(true);
    expect(opened?.sortValue?.(aTicketView({ created_at: "2026-08-25T09:00:00Z" }))).toBe("2026-08-25T09:00:00Z");
    render(
      <DenseTable<TicketView>
        title="Queue"
        columns={columns}
        rows={[aTicketView({ key: "CS1000004", created_at: "2026-08-25T09:00:00Z" })]}
        rowKey={(row) => row.key}
      />,
    );
    expect(screen.getByText("25 Aug")).toBeInTheDocument();
  });

  it("names the year on a ticket opened in another one", () => {
    const now = new Date("2026-09-08T00:00:00Z");
    expect(openedDate("2026-08-25T09:00:00Z", now)).toBe("25 Aug");
    expect(openedDate("2025-12-31T09:00:00Z", now)).toBe("31 Dec 25");
    expect(openedDate("not a date", now)).toBe("");
  });

  // The reviewer took the colour off these two, on every list and not only on
  // the Queue: a row carries state, priority and the clock, and nothing else
  // competes with them.
  it("draws Account and Type as plain text, on the Queue and on Needs attention alike", () => {
    const rows = [aTicketView({ key: "CS1000005", type: "incident" })];
    const { unmount } = render(
      <DenseTable<TicketView> title="Queue" columns={ticketColumns({ accounts })} rows={rows} rowKey={(r) => r.key} />,
    );
    expect(screen.getByText("Incident")).not.toHaveClass("xms-type");
    expect(document.querySelector(".xms-account")).toBeNull();
    unmount();

    render(
      <DenseTable<TicketView>
        title="Needs attention"
        columns={attentionColumns({ accounts })}
        rows={rows}
        rowKey={(r) => r.key}
      />,
    );
    expect(document.querySelector(".xms-account")).toBeNull();
  });

  // Render 08's clock column: the time remaining, never the word "Breached",
  // and never the time elapsed.
  it("counts a breached clock down past zero rather than naming it", () => {
    const overdue = aTicketView({
      key: "CS1000006",
      sla: {
        resolution: {
          kind: "resolution",
          dueAt: new Date(Date.now() - 38 * 60_000).toISOString(),
          remainingMinutes: -38,
          paused: false,
          breached: true,
          met: false,
          targetMinutes: 480,
          pausedTotalMinutes: 0,
        },
      },
    });
    render(
      <DenseTable<TicketView>
        title="Needs attention"
        columns={attentionColumns({ accounts })}
        rows={[overdue]}
        rowKey={(r) => r.key}
      />,
    );
    expect(screen.queryByText("Breached")).not.toBeInTheDocument();
    expect(screen.getByText("-0h 38m")).toHaveAttribute("data-tone", "breach");
  });
});
