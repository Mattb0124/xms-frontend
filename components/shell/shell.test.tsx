import { readFileSync } from "node:fs";
import { join } from "node:path";
import type React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FinderBar } from "@/components/shell/finder-bar";
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
  const bar = (overrides: Partial<React.ComponentProps<typeof FinderBar>> = {}) => (
    <FinderBar
      finder={<div data-testid="finder-slot" />}
      onAxel={() => {}}
      axelOpen={false}
      unreadCount={0}
      onNotifications={() => {}}
      userInitials="MB"
      onUser={() => {}}
      {...overrides}
    />
  );

  it("carries the finder it is given and counts the unread on the bell", () => {
    render(bar({ unreadCount: 3 }));
    expect(screen.getByTestId("finder-slot")).toBeInTheDocument();
    expect(screen.getByLabelText("Notifications, 3 unread")).toBeInTheDocument();
    expect(screen.getByTestId("unread-badge")).toHaveTextContent("3");
  });

  // The reference stops counting at nine, where this bar used to stop at 99.
  it("stops the count at nine, as the reference does", () => {
    render(bar({ unreadCount: 42 }));
    expect(screen.getByTestId("unread-badge")).toHaveTextContent("9+");
  });

  /**
   * The search field and the scope pill came off on 2026-09-11 so the bar
   * matches AIXelerator's. The field was a second door onto the room the All
   * finder already opens, and the `/` shortcut still opens it from the shell.
   * The star that lived in the pill is the one thing with nowhere to go, and
   * this records that it is gone rather than leaving it to be noticed later.
   */
  // The four ServiceNow finders came off with the overlay behind them
  // (AIBL-329), and the scope pill and its star before that (AIBL-321).
  it("carries none of the four finders, and no scope pill", () => {
    render(bar());
    for (const gone of ["All", "Favourites", "History", "Workspaces"]) {
      expect(screen.queryByRole("button", { name: gone })).not.toBeInTheDocument();
    }
    expect(screen.queryByTestId("workspace-pill")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Star this view")).not.toBeInTheDocument();
  });

  it("carries the Axel button and says whether the surface is up", () => {
    const onAxel = vi.fn();
    const { rerender } = render(bar({ onAxel }));
    const axel = screen.getByRole("button", { name: "Axel" });
    // The words are the accessible name whether or not the label is drawn, so
    // the control is still findable on a narrow window where it is a sparkle.
    expect(axel).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(axel);
    expect(onAxel).toHaveBeenCalled();
    rerender(bar({ onAxel, axelOpen: true }));
    expect(screen.getByRole("button", { name: "Axel" })).toHaveAttribute("aria-pressed", "true");
  });

  // The bar wears the vendored AIX chrome, not the house navy, and every one
  // of those recipes lives in aix-tokens.css rather than in this component.
  it("stands on the vendored AIX header, not the house navy", () => {
    render(bar({ unreadCount: 1 }));
    const banner = screen.getByTestId("finder-bar");
    expect(banner).toHaveClass("aix-app-header");
    expect(banner.className).not.toContain("bg-xms-navy");
    expect(screen.getByLabelText("Account menu").firstElementChild).toHaveClass("aix-avatar-disc");
    expect(screen.getByTestId("unread-badge")).toHaveClass("aix-header-badge");
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

  // The box is always on the bar now, so the shortcut focuses rather than
  // opens, and Escape hands focus back rather than unmounting anything.
  it("puts the caret in the finder", async () => {
    desk();
    await screen.findByTestId("finder-bar");
    const box = await screen.findByLabelText("Search");
    expect(document.activeElement).not.toBe(box);
    fireEvent.keyDown(window, { key: "/" });
    await waitFor(() => expect(document.activeElement).toBe(box));
    fireEvent.keyDown(box, { key: "Escape" });
    await waitFor(() => expect(document.activeElement).not.toBe(box));
  });

  it("answers Ctrl+K as well, which is where the palette used to live", async () => {
    desk();
    const box = await screen.findByLabelText("Search");
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    await waitFor(() => expect(document.activeElement).toBe(box));
  });

  it("stays out of the way while the reader is typing", async () => {
    desk();
    const field = await screen.findByLabelText("In the page");
    const box = await screen.findByLabelText("Search");
    field.focus();
    fireEvent.keyDown(field, { key: "/" });
    expect(document.activeElement).toBe(field);
    expect(document.activeElement).not.toBe(box);
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
