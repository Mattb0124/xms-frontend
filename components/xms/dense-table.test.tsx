import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { KeyLink } from "@/components/xms/key-link";
import { SlaValue } from "@/components/xms/sla-value";

interface Row {
  key: string;
  title: string;
  updated: number;
  dueAt: string;
}

const ROWS: Row[] = [
  { key: "CS0001204", title: "HFM consolidation fails", updated: 3, dueAt: "2026-09-07T12:00:00Z" },
  { key: "CS0001199", title: "Azure Files mount", updated: 1, dueAt: "2026-09-08T12:00:00Z" },
  { key: "CS0001210", title: "User cannot sign in", updated: 2, dueAt: "2026-09-06T12:00:00Z" },
];

const COLUMNS: DenseColumn<Row>[] = [
  { key: "key", title: "Number", sortValue: (r) => r.key, render: (r) => <KeyLink ticketKey={r.key} /> },
  { key: "title", title: "Short description", sortValue: (r) => r.title },
  { key: "updated", title: "Updated", sortValue: (r) => r.updated },
  {
    key: "sla",
    title: "SLA",
    render: (r) => <SlaValue snapshot={{ dueAt: r.dueAt }} now={new Date("2026-09-07T10:00:00Z")} tickMs={0} />,
  },
];

function Harness() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  return (
    <DenseTable
      title="Queue"
      columns={COLUMNS}
      rows={ROWS}
      rowKey={(r) => r.key}
      selectable
      selected={selected}
      onSelectionChange={setSelected}
      banner={selected.size > 0 ? <div data-testid="banner">{selected.size} selected</div> : null}
    />
  );
}

function bodyKeys(): string[] {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => row.getAttribute("data-row-key") ?? "");
}

describe("DenseTable", () => {
  it("draws key links and mono SLA values, and no row count", () => {
    render(<Harness />);
    // The card header carried the row count beside the title. Both the badge
    // and the word "Count" that labelled it are gone: the reviewer reads the
    // number off the sidebar, not off three places at once.
    expect(screen.queryByText("42")).not.toBeInTheDocument();
    const link = screen.getByRole("link", { name: "CS0001204" });
    expect(link).toHaveAttribute("href", "/tickets/CS0001204");
    expect(link).toHaveClass("xms-link");
    expect(screen.getByText("2h 00m")).toHaveAttribute("data-tone", "ok");
    expect(screen.getByText("-22h 00m")).toHaveAttribute("data-tone", "breach");
  });

  it("sorts locally on a header click and toggles direction", () => {
    render(<Harness />);
    const header = screen.getByRole("button", { name: /Updated/ });
    fireEvent.click(header);
    expect(bodyKeys()).toEqual(["CS0001199", "CS0001210", "CS0001204"]);
    expect(screen.getByRole("columnheader", { name: /Updated/ })).toHaveAttribute("aria-sort", "ascending");
    fireEvent.click(header);
    expect(bodyKeys()).toEqual(["CS0001204", "CS0001210", "CS0001199"]);
  });

  it("selects all rows, shows the banner and clears on a second click", () => {
    render(<Harness />);
    fireEvent.click(screen.getByLabelText("Select all rows"));
    expect(screen.getByTestId("banner")).toHaveTextContent("3 selected");
    const rows = screen.getAllByRole("row").slice(1);
    rows.forEach((row) => expect(row).toHaveAttribute("data-selected", "true"));
    fireEvent.click(screen.getByLabelText("Select all rows"));
    expect(screen.queryByTestId("banner")).not.toBeInTheDocument();
  });

  it("toggles a single row without triggering the row click", () => {
    const onRowClick = vi.fn();
    const onSelectionChange = vi.fn();
    render(
      <DenseTable
        title="Queue"
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(r) => r.key}
        selectable
        selected={new Set()}
        onSelectionChange={onSelectionChange}
        onRowClick={onRowClick}
      />,
    );
    fireEvent.click(screen.getByLabelText("Select CS0001199"));
    expect(onSelectionChange).toHaveBeenCalledWith(new Set(["CS0001199"]));
    expect(onRowClick).not.toHaveBeenCalled();
    const row = screen.getByRole("row", { name: /Azure Files mount/ });
    fireEvent.click(within(row).getByText("Azure Files mount"));
    expect(onRowClick).toHaveBeenCalledWith(ROWS[1]);
  });

  /**
   * Review finding 19: table rows were not focusable (tabindex null, no
   * role), so a row could only be opened through its key link. Design System
   * section 6: "list rows focusable and openable with Enter".
   */
  it("makes an openable row a tab stop that opens on Enter and on Space", () => {
    const onRowClick = vi.fn();
    render(
      <DenseTable
        title="Queue"
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(r) => r.key}
        selectable
        selected={new Set()}
        onSelectionChange={() => {}}
        onRowClick={onRowClick}
      />,
    );
    const row = screen.getByRole("row", { name: /Azure Files mount/ });
    expect(row).toHaveAttribute("tabindex", "0");
    row.focus();
    expect(document.activeElement).toBe(row);
    fireEvent.keyDown(row, { key: "Enter" });
    expect(onRowClick).toHaveBeenCalledWith(ROWS[1]);
    fireEvent.keyDown(row, { key: " " });
    expect(onRowClick).toHaveBeenCalledTimes(2);
    // Other keys pass through, and a key pressed inside a control is its own.
    fireEvent.keyDown(row, { key: "a" });
    fireEvent.keyDown(within(row).getByLabelText("Select CS0001199"), { key: "Enter" });
    expect(onRowClick).toHaveBeenCalledTimes(2);
  });

  it("leaves a row that opens nothing out of the tab order", () => {
    render(<DenseTable title="Queue" columns={COLUMNS} rows={ROWS} rowKey={(r) => r.key} />);
    expect(screen.getByRole("row", { name: /Azure Files mount/ })).not.toHaveAttribute("tabindex");
  });

  it("shows the empty state when there are no rows", () => {
    render(
      <DenseTable title="Queue" columns={COLUMNS} rows={[]} rowKey={(r) => r.key} emptyState="Nothing in Breached" />,
    );
    expect(screen.getByText("Nothing in Breached")).toBeInTheDocument();
  });
});
