import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GrantsReconcile } from "@/components/admin/grants-reconcile";

const OPTIONS = [
  { id: "u1", label: "Cara Lee", detail: "cara@example.test" },
  { id: "u2", label: "Dan Ortiz", detail: "dan@example.test" },
  { id: "u3", label: "Eve Park", detail: "eve@example.test" },
];

describe("GrantsReconcile", () => {
  it("saves the exact id set after ticking and unticking", () => {
    const onSave = vi.fn();
    render(<GrantsReconcile title="Grants" options={OPTIONS} selected={["u1"]} onSave={onSave} />);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Dan Ortiz/));
    fireEvent.click(screen.getByLabelText(/Cara Lee/));
    fireEvent.click(screen.getByLabelText(/Eve Park/));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith(["u2", "u3"]);
  });

  it("does not offer Save when the draft equals the server set, and Reset restores it", () => {
    const onSave = vi.fn();
    render(<GrantsReconcile title="Grants" options={OPTIONS} selected={["u1", "u2"]} onSave={onSave} />);
    fireEvent.click(screen.getByLabelText(/Cara Lee/));
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByLabelText(/Cara Lee/)).toBeChecked();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByText("2 selected")).toBeInTheDocument();
  });

  it("filters by search without losing selections outside the filter", () => {
    const onSave = vi.fn();
    render(<GrantsReconcile title="Grants" options={OPTIONS} selected={[]} onSave={onSave} />);
    fireEvent.click(screen.getByLabelText(/Eve Park/));
    fireEvent.change(screen.getByLabelText("Search grants"), { target: { value: "dan" } });
    expect(screen.queryByLabelText(/Eve Park/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Dan Ortiz/));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith(["u3", "u2"]);
  });

  it("follows a new server set after a save round-trips", () => {
    const onSave = vi.fn();
    const { rerender } = render(<GrantsReconcile title="Grants" options={OPTIONS} selected={[]} onSave={onSave} />);
    rerender(<GrantsReconcile title="Grants" options={OPTIONS} selected={["u2"]} onSave={onSave} />);
    expect(screen.getByLabelText(/Dan Ortiz/)).toBeChecked();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});
