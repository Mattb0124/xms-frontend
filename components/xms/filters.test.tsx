import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddFilterButton } from "@/components/xms/add-filter-button";
import { BreadcrumbTrail } from "@/components/xms/breadcrumb-trail";
import { ClearAllLink } from "@/components/xms/clear-all-link";
import { FilterBar } from "@/components/xms/filter-bar";
import { FilterChip } from "@/components/xms/filter-chip";
import { FilterPill } from "@/components/xms/filter-pill";
import { FilterSelect } from "@/components/xms/filter-select";
import { BulkAction, SelectionBar } from "@/components/xms/selection-bar";
import { RowsPerPage, TableFooter } from "@/components/xms/table-footer";

describe("FilterPill and FilterChip", () => {
  it("marks the primary pill and removes a chip", () => {
    const onRemove = vi.fn();
    render(
      <>
        <FilterPill primary label="Show" value="My group" />
        <FilterChip label="State" value="Open" onRemove={onRemove} />
      </>,
    );
    expect(screen.getByRole("button", { name: /Show/ })).toHaveAttribute("data-primary", "true");
    fireEvent.click(screen.getByLabelText("Remove State filter"));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

describe("FilterSelect", () => {
  const options = [{ value: "acct-1", label: "Brookfield" }];

  it("stands a dimension whether or not it filters, and only clears once it does", () => {
    const onClear = vi.fn();
    const { rerender } = render(
      <FilterSelect label="Account" value="" options={options} onChange={vi.fn()} onClear={onClear} />,
    );
    // The render draws "Account: all" with a quiet clear mark beside it, so
    // the pill does not change width the moment it starts filtering.
    expect(screen.getByTestId("filter-account")).not.toHaveAttribute("data-active");
    const clear = screen.getByRole("button", { name: "Remove the account filter" });
    expect(clear).toBeDisabled();
    fireEvent.click(clear);
    expect(onClear).not.toHaveBeenCalled();

    rerender(<FilterSelect label="Account" value="acct-1" options={options} onChange={vi.fn()} onClear={onClear} />);
    expect(screen.getByTestId("filter-account")).toHaveAttribute("data-active", "true");
    fireEvent.click(screen.getByRole("button", { name: "Remove the account filter" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("gives the primary dimension no clear mark at all", () => {
    render(<FilterSelect primary label="Show" value="" options={options} onChange={vi.fn()} onClear={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Remove the show filter/ })).not.toBeInTheDocument();
  });
});

describe("AddFilterButton and ClearAllLink", () => {
  it("fire their callbacks", () => {
    const onAdd = vi.fn();
    const onClear = vi.fn();
    render(
      <>
        <AddFilterButton onClick={onAdd} />
        <ClearAllLink onClick={onClear} />
      </>,
    );
    // The plus is a drawn glyph beside the words, not a character inside them.
    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
    fireEvent.click(screen.getByText("Clear all"));
    expect(onAdd).toHaveBeenCalled();
    expect(onClear).toHaveBeenCalled();
  });
});

describe("FilterBar", () => {
  it("shows Clear all only when there are removable criteria and removes by key", () => {
    const onRemove = vi.fn();
    const { rerender } = render(
      <FilterBar
        primary={{ label: "Show", value: "Open" }}
        criteria={[]}
        onRemove={onRemove}
        onAdd={() => {}}
        onClearAll={() => {}}
      />,
    );
    expect(screen.queryByText("Clear all")).not.toBeInTheDocument();
    rerender(
      <FilterBar
        primary={{ label: "Show", value: "Open" }}
        criteria={[{ key: "priority", label: "Priority", value: "P1" }]}
        onRemove={onRemove}
        onAdd={() => {}}
        onClearAll={() => {}}
      />,
    );
    expect(screen.getByText("Clear all")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Remove Priority filter"));
    expect(onRemove).toHaveBeenCalledWith("priority");
  });
});

describe("SelectionBar", () => {
  it("renders nothing at zero and the count, actions and audit note otherwise", () => {
    const onAssign = vi.fn();
    const onDismiss = vi.fn();
    const { rerender } = render(<SelectionBar count={0} onDismiss={onDismiss} />);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    rerender(
      <SelectionBar count={3} onDismiss={onDismiss}>
        <BulkAction label="Assign" onClick={onAssign} />
      </SelectionBar>,
    );
    expect(screen.getByText("3 selected")).toBeInTheDocument();
    expect(screen.getByText("one audit event written per record")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Assign"));
    fireEvent.click(screen.getByLabelText("Clear selection"));
    expect(onAssign).toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalled();
  });
});

describe("TableFooter", () => {
  it("shows the range, pages and changes size", () => {
    const onPage = vi.fn();
    const onSize = vi.fn();
    render(<TableFooter page={2} pageSize={10} total={42} onPageChange={onPage} onPageSizeChange={onSize} />);
    expect(screen.getByText("Showing 11 to 20 of 42")).toBeInTheDocument();
    expect(screen.getByText("2 / 5")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Next"));
    expect(onPage).toHaveBeenCalledWith(3);
    fireEvent.change(screen.getByLabelText("Rows per page"), { target: { value: "50" } });
    expect(onSize).toHaveBeenCalledWith(50);
  });

  it("disables Previous on the first page", () => {
    render(<RowsPerPage value={10} onChange={() => {}} />);
    expect(screen.getByLabelText("Rows per page")).toHaveValue("10");
    render(<TableFooter page={1} pageSize={25} total={0} onPageChange={() => {}} onPageSizeChange={() => {}} />);
    expect(screen.getByText("Previous")).toBeDisabled();
    expect(screen.getByText("Showing 0 to 0 of 0")).toBeInTheDocument();
  });
});

describe("BreadcrumbTrail", () => {
  it("removes the clicked segment and offers Save as view", () => {
    const onRemove = vi.fn();
    const onSave = vi.fn();
    render(
      <BreadcrumbTrail
        segments={[
          { key: "all", label: "All" },
          { key: "group", label: "My group" },
        ]}
        onRemove={onRemove}
        onSaveView={onSave}
      />,
    );
    fireEvent.click(screen.getByText("My group"));
    expect(onRemove).toHaveBeenCalledWith("group");
    fireEvent.click(screen.getByText("Save as view"));
    expect(onSave).toHaveBeenCalled();
  });
});
