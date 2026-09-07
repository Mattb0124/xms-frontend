import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommandPalette } from "@/components/shell/command-palette";
import { FinderBar } from "@/components/shell/finder-bar";
import { FinderOverlay } from "@/components/shell/finder-overlay";
import { visibleScreens } from "@/lib/routes";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/tickets",
}));

describe("FinderBar", () => {
  it("marks the active finder and stars the current view", () => {
    const onFinder = vi.fn();
    const onToggleStar = vi.fn();
    render(
      <FinderBar
        activeFinder="all"
        onFinder={onFinder}
        workspaceLabel="Queue"
        starred={false}
        onToggleStar={onToggleStar}
        onSearchFocus={() => {}}
        onAxel={() => {}}
        unreadCount={3}
        onNotifications={() => {}}
        userInitials="MB"
        onUser={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    expect(onFinder).toHaveBeenCalledWith("history");
    fireEvent.click(screen.getByLabelText("Star this view"));
    expect(onToggleStar).toHaveBeenCalled();
    expect(screen.getByLabelText("Notifications, 3 unread")).toBeInTheDocument();
  });
});

describe("FinderOverlay", () => {
  it("groups permitted screens by section, filters them and toggles pins", () => {
    const onTogglePin = vi.fn();
    render(
      <FinderOverlay
        kind="all"
        screens={visibleScreens(new Set(["tickets:view", "admin:accounts", "reports:view-portfolio"]))}
        pinned={new Set(["/tickets"])}
        onTogglePin={onTogglePin}
        favourites={[]}
        history={[]}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole("dialog", { name: /All screens · 15/ })).toBeInTheDocument();
    expect(screen.getByText("Admin", { selector: "p" })).toBeInTheDocument();
    expect(screen.queryByText("Dispatch")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Filter screens"), { target: { value: "oper" } });
    expect(screen.getByText("Operations")).toBeInTheDocument();
    expect(screen.queryByText("Queue")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Filter screens"), { target: { value: "" } });
    fireEvent.click(screen.getByLabelText("Unpin Queue"));
    expect(onTogglePin).toHaveBeenCalledWith("/tickets");
  });

  it("lists history with relative times", () => {
    render(
      <FinderOverlay
        kind="history"
        screens={[]}
        pinned={new Set()}
        onTogglePin={() => {}}
        favourites={[]}
        history={[{ path: "/tickets/CS0001204", label: "Ticket", at: new Date(Date.now() - 5 * 60_000).toISOString() }]}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole("link", { name: "Ticket" })).toHaveAttribute("href", "/tickets/CS0001204");
    expect(screen.getByText("5m ago")).toBeInTheDocument();
  });
});

describe("CommandPalette", () => {
  it("navigates to a filtered screen on Enter and jumps to a ticket key", () => {
    push.mockClear();
    const onClose = vi.fn();
    render(
      <CommandPalette
        screens={visibleScreens(new Set(["tickets:view", "reports:view-portfolio"]))}
        onClose={onClose}
      />,
    );
    const input = screen.getByLabelText("Command");
    fireEvent.change(input, { target: { value: "oper" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/operations");
    expect(onClose).toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "cs0001204" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/tickets/CS0001204");
  });
});
