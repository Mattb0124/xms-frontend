import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BreadcrumbTrail } from "@/components/xms/breadcrumb-trail";

/**
 * The Queue had no condition trail at all: no "All > My group > Open" and no
 * Save as view (frontend review finding 12). The right-aligned open-ticket
 * count that stood between them is gone with the card's own count badge.
 */
describe("BreadcrumbTrail", () => {
  const segments = [
    { key: "view", label: "All open" },
    { key: "account_id:acct-1", label: "Brookfield" },
    { key: "state:new", label: "new" },
  ];

  it("renders the trail in order with separators and Save as view, and no count", () => {
    render(<BreadcrumbTrail segments={segments} onSaveView={() => {}} />);
    const trail = screen.getByRole("navigation", { name: "Condition trail" });
    expect(trail.textContent).toBe("All open›Brookfield›new");
    expect(screen.queryByText(/open tickets/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save as view" })).toHaveAttribute("aria-pressed", "false");
  });

  it("removes the criterion a reader clicks", () => {
    const onRemove = vi.fn();
    render(<BreadcrumbTrail segments={segments} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove Brookfield" }));
    expect(onRemove).toHaveBeenCalledWith("account_id:acct-1");
  });

  it("reads Saved once the view is starred", () => {
    const onSaveView = vi.fn();
    render(<BreadcrumbTrail segments={segments} onSaveView={onSaveView} saved />);
    const control = screen.getByRole("button", { name: "Saved" });
    expect(control).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(control);
    expect(onSaveView).toHaveBeenCalled();
  });

  it("renders nothing but the trail when there is no save", () => {
    render(<BreadcrumbTrail segments={[{ key: "view", label: "All open" }]} />);
    expect(screen.queryByRole("button", { name: /Save as view|Saved/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove All open" })).toBeInTheDocument();
  });
});
