import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PermissionChecklist, impliedClosure } from "@/components/admin/permission-checklist";

const CATALOG = [
  { key: "tickets:view", label: "View tickets", implies: [] },
  { key: "tickets:create", label: "Create tickets", implies: ["tickets:view"] },
  { key: "tickets:work", label: "Work tickets", implies: ["tickets:view", "tickets:create"] },
  { key: "tickets:resolve", label: "Resolve tickets", implies: ["tickets:work"] },
  { key: "time:log", label: "Log time", implies: [] },
];

describe("impliedClosure", () => {
  it("is transitive", () => {
    expect([...impliedClosure(["tickets:resolve"], CATALOG)].sort()).toEqual([
      "tickets:create",
      "tickets:resolve",
      "tickets:view",
      "tickets:work",
    ]);
  });
});

describe("PermissionChecklist", () => {
  it("ticks and greys implied keys automatically and explains why", () => {
    render(<PermissionChecklist catalog={CATALOG} selected={["tickets:resolve"]} onChange={vi.fn()} />);
    const view = screen.getByRole("checkbox", { name: /^tickets:view/ });
    expect(view).toBeChecked();
    expect(view).toBeDisabled();
    expect(view).toHaveAttribute("data-implied", "true");
    expect(screen.getAllByText(/Implied by tickets:resolve/)).toHaveLength(3);
    expect(screen.getByRole("checkbox", { name: /^time:log/ })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /^time:log/ })).toBeEnabled();
  });

  it("reports the direct keys only, never the implied ones", () => {
    const onChange = vi.fn();
    render(<PermissionChecklist catalog={CATALOG} selected={["tickets:resolve"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /^time:log/ }));
    expect(onChange).toHaveBeenCalledWith(["tickets:resolve", "time:log"]);
    fireEvent.click(screen.getByRole("checkbox", { name: /^tickets:resolve/ }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("groups keys by area", () => {
    render(<PermissionChecklist catalog={CATALOG} selected={[]} onChange={vi.fn()} />);
    expect(screen.getByRole("group", { name: "tickets" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "time" })).toBeInTheDocument();
  });
});
