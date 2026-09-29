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

  it("stands the dimension whether or not it filters, and clears by going back to all", () => {
    const onChange = vi.fn();
    const { rerender } = render(<FilterSelect label="Account" value="" options={options} onChange={onChange} />);
    // The reviewer's reference draws a control reading "Account: all", not a
    // pill with a cross: setting it back to all is what removes the criterion.
    // The control is drawn rather than native, so the real menu is a
    // transparent select over it and the state is on the drawn wrapper.
    expect(screen.getByTestId("filter-account")).not.toHaveAttribute("data-active");
    expect(screen.getByText("all")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Account: all" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Account: Brookfield" })).toBeInTheDocument();

    rerender(<FilterSelect label="Account" value="acct-1" options={options} onChange={onChange} />);
    expect(screen.getByTestId("filter-account")).toHaveAttribute("data-active", "true");
    expect(screen.getByText("Brookfield")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Account"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("carries the count on the value it draws, and only where the caller asks", () => {
    const { rerender } = render(
      <FilterSelect primary count={26} label="Show" value="" options={options} onChange={vi.fn()} />,
    );
    // The count is on the closed control, not in the menu: an option reading
    // "Show: My work (26)" would claim the count belonged to that view.
    expect(screen.getByText("all (26)")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Show: Brookfield" })).toBeInTheDocument();
    rerender(<FilterSelect label="Account" value="" options={options} onChange={vi.fn()} />);
    expect(screen.getByText("all")).toBeInTheDocument();
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
  it("says what is on the page and what it is out of, and steps", () => {
    const onPage = vi.fn();
    const onSize = vi.fn();
    render(<TableFooter page={2} pageSize={10} total={42} onPageChange={onPage} onPageSizeChange={onSize} />);
    expect(screen.getByText("11 to 20 of 42")).toBeInTheDocument();
    expect(screen.getByLabelText("Page")).toHaveValue("2");
    fireEvent.click(screen.getByLabelText("Next page"));
    expect(onPage).toHaveBeenCalledWith(3);
    fireEvent.change(screen.getByLabelText("Rows per page"), { target: { value: "50" } });
    expect(onSize).toHaveBeenCalledWith(50);
  });

  it("jumps to a page typed into the box, and refuses one that is not there", () => {
    const onPage = vi.fn();
    render(<TableFooter page={1} pageSize={10} total={42} onPageChange={onPage} onPageSizeChange={() => {}} />);
    const box = screen.getByLabelText("Page");
    fireEvent.change(box, { target: { value: "4" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onPage).toHaveBeenCalledWith(4);
    // Five pages of ten in forty-two, so there is no ninth.
    fireEvent.change(box, { target: { value: "9" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onPage).toHaveBeenCalledTimes(1);
    expect(box).toHaveValue("1");
  });

  it("cannot step back from the first page, nor forward from an empty one", () => {
    render(<RowsPerPage value={10} onChange={() => {}} />);
    expect(screen.getByLabelText("Rows per page")).toHaveValue("10");
    render(<TableFooter page={1} pageSize={25} total={0} onPageChange={() => {}} onPageSizeChange={() => {}} />);
    expect(screen.getByLabelText("Previous page")).toBeDisabled();
    expect(screen.getByLabelText("First page")).toBeDisabled();
    expect(screen.getByLabelText("Next page")).toBeDisabled();
    expect(screen.getByText("0 to 0 of 0")).toBeInTheDocument();
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
