import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommandPalette } from "@/components/shell/command-palette";
import { FinderBar } from "@/components/shell/finder-bar";
import { FinderOverlay } from "@/components/shell/finder-overlay";
import { Shell } from "@/components/shell/shell";
import { visibleScreens } from "@/lib/routes";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/cases",
  // The shell reads ?axel=1, which is how the ticket record's Ask Axel opens
  // the panel (render 15).
  useSearchParams: () => new URLSearchParams(),
}));

describe("FinderBar", () => {
  it("marks the active finder and stars the current view", () => {
    const onFinder = vi.fn();
    const onToggleStar = vi.fn();
    render(
      <FinderBar
        activeFinder="all"
        onFinder={onFinder}
        workspaceLabel="Cases"
        starred={false}
        onToggleStar={onToggleStar}
        onWorkspace={() => {}}
        onSearchFocus={() => {}}
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
    // v3 render 01: the bell carries the unread count as a badge on the icon,
    // and the scope pill names the instance beside the view.
    expect(screen.getByTestId("unread-badge")).toHaveTextContent("3");
    expect(screen.getByTestId("workspace-pill")).toHaveTextContent("THG PROD");
    expect(screen.getByTestId("workspace-pill")).toHaveTextContent("Cases");
  });
});

describe("FinderOverlay", () => {
  it("groups permitted screens by section, filters them and toggles pins", () => {
    const onTogglePin = vi.fn();
    render(
      <FinderOverlay
        kind="all"
        screens={visibleScreens(new Set(["tickets:view", "admin:accounts", "reports:view-portfolio"]))}
        pinned={new Set(["/cases"])}
        onTogglePin={onTogglePin}
        favourites={[]}
        history={[]}
        onClose={() => {}}
      />,
    );
    // The overlay header is the render's plain "All screens"; the tree count
    // lives on the sidebar's own "Browse all screens" footer (render 12).
    expect(screen.getByRole("dialog", { name: "All screens" })).toBeInTheDocument();
    expect(screen.getByText("Admin", { selector: "p" })).toBeInTheDocument();
    expect(screen.queryByText("Dispatch")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Filter screens"), { target: { value: "oper" } });
    expect(screen.getByText("Operations")).toBeInTheDocument();
    expect(screen.queryByText("Cases")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Filter screens"), { target: { value: "" } });
    fireEvent.click(screen.getByLabelText("Unpin Cases"));
    expect(onTogglePin).toHaveBeenCalledWith("/cases");
  });

  it("lists history with relative times", () => {
    render(
      <FinderOverlay
        kind="history"
        screens={[]}
        pinned={new Set()}
        onTogglePin={() => {}}
        favourites={[]}
        history={[{ path: "/cases/CS0001204", label: "Ticket", at: new Date(Date.now() - 5 * 60_000).toISOString() }]}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole("link", { name: "Ticket" })).toHaveAttribute("href", "/cases/CS0001204");
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
    expect(push).toHaveBeenCalledWith("/cases/CS0001204");
  });
});

/**
 * Review finding 19: the "/" shortcut did not focus global search. The
 * wireframe (section 2) gives global search the "/" shortcut, and the
 * finder bar's search control opens the same overlay, so "/" must land in
 * its filter box with the caret ready.
 */
describe("the / shortcut", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  const desk = () => {
    stubFetch({
      "GET /v1/admin/me": () =>
        json({
          principal: {
            kind: "internal",
            userId: "u1",
            displayName: "Ana Silva",
            accountIds: [],
            permissions: ["tickets:view"],
          },
        }),
      "GET /v1/notifications/unread-count": () => json({ count: 0 }),
    });
    return renderDesk(
      <Shell>
        <input aria-label="In the page" />
      </Shell>,
    );
  };

  it("opens the finder and puts the caret in its search box", async () => {
    desk();
    await screen.findByTestId("finder-bar");
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.keyDown(window, { key: "/" });
    const box = await screen.findByLabelText("Filter screens");
    await waitFor(() => expect(document.activeElement).toBe(box));
    // Escape closes it again.
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByLabelText("Filter screens")).toBeNull());
  });

  it("stays out of the way while the reader is typing", async () => {
    desk();
    const field = await screen.findByLabelText("In the page");
    field.focus();
    fireEvent.keyDown(field, { key: "/" });
    expect(screen.queryByLabelText("Filter screens")).toBeNull();
  });
});

describe("what scrolls", () => {
  /**
   * The navy bar and the grey strip stay put by standing outside the thing
   * that scrolls, not by being stuck to it. That only works while every
   * column between the shell and the work area can shrink: one `min-h-0`
   * missing anywhere on the chain and the document grows instead, taking
   * both headers with it and leaving the table's sticky header nothing to
   * stick to.
   */
  it("makes the work area the scroller, with the headers outside it", async () => {
    stubFetch({
      "GET /v1/admin/me": () =>
        json({ principal: { kind: "internal", userId: "u1", accountIds: [], permissions: [] } }),
      "GET /v1/me/waiting": () => json({ items: [], as_of: "2026-09-09T00:00:00Z" }),
      "GET /v1/notifications/unread-count": () => json({ count: 0 }),
      "GET /v1/tickets/stats": () => json({}),
    });
    const { container } = renderDesk(
      <Shell>
        <p>Work</p>
      </Shell>,
    );
    await screen.findByTestId("finder-bar");

    const main = container.querySelector("main");
    expect(main).not.toBeNull();
    expect(main!.className).toContain("overflow-auto");

    // The navy bar and the grey strip are siblings above it, never inside it.
    const bar = screen.getByTestId("finder-bar");
    const strip = screen.getByTestId("content-header-bar");
    expect(main!.contains(bar)).toBe(false);
    expect(main!.contains(strip)).toBe(false);

    // Every column from the shell root down to the work area can shrink.
    for (let node = main!.parentElement; node && node !== container; node = node.parentElement) {
      expect(node.className).toContain("min-h-0");
    }
  });
});

describe("nothing scrolls but the work area", () => {
  /**
   * The navy bar stays because the document cannot move, and the document
   * cannot move because both the root element and the body are clipped. With
   * only the body clipped the root was still the scroller: a screen fifteen
   * pixels taller than the window dragged the bar off the top, which is the
   * one thing the sticky headers exist to prevent.
   */
  it("clips the root element as well as the body", () => {
    const layout = readFileSync(join(process.cwd(), "app", "layout.tsx"), "utf8");
    const html = layout.slice(layout.indexOf("<html"), layout.indexOf(">", layout.indexOf("<html")));
    const body = layout.slice(layout.indexOf("<body"), layout.indexOf(">", layout.indexOf("<body")));
    expect(html).toContain("overflow-hidden");
    expect(body).toContain("overflow-hidden");
  });
});
