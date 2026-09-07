import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PinnedSidebar, sidebarItems } from "@/components/shell/pinned-sidebar";

const base = {
  extraPins: new Set<string>(),
  starredViews: [],
  currentPath: "/",
  onBrowseAll: () => {},
  onEditPins: () => {},
};

describe("PinnedSidebar", () => {
  it("renders a skeleton and no links while permissions are loading", () => {
    const { container } = render(<PinnedSidebar {...base} permissions={undefined} />);
    expect(container.querySelector("[data-skeleton]")).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByText(/Browse all screens/)).toBeDisabled();
  });

  it("shows only the unrestricted pins to a user with no permissions", () => {
    render(<PinnedSidebar {...base} permissions={new Set()} />);
    const labels = screen.getAllByRole("link").map((link) => link.textContent);
    expect(labels).toEqual(["My work", "Solutions"]);
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });

  it("shows Admin when pinned by an administrator, and Queue with tickets:view", () => {
    const permissions = new Set(["admin:accounts", "tickets:view"]);
    expect(sidebarItems(permissions, new Set(["/admin"])).map((s) => s.label)).toContain("Admin");
    render(
      <PinnedSidebar
        {...base}
        permissions={permissions}
        extraPins={new Set(["/admin"])}
        counts={{ queue: 42 }}
        currentPath="/tickets"
      />,
    );
    expect(screen.getByRole("link", { name: /Admin/ })).toHaveAttribute("href", "/admin");
    const queue = screen.getByRole("link", { name: /Queue/ });
    expect(queue).toHaveAttribute("aria-current", "page");
    expect(queue).toHaveTextContent("42");
    expect(screen.getByText(/Browse all screens · 7/)).toBeEnabled();
  });

  it("never shows a pin the user is not permitted to see", () => {
    render(<PinnedSidebar {...base} permissions={new Set()} extraPins={new Set(["/admin", "/tickets/dispatch"])} />);
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
    expect(screen.queryByText("Dispatch")).not.toBeInTheDocument();
  });
});
