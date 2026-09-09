import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FinderOverlay } from "@/components/shell/finder-overlay";
import { PORTAL_SCREENS, SCREENS, isDynamicPath, navigableHref } from "@/lib/routes";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/tickets",
}));

// The three finders crashed every screen because the overlay built an href from
// a path pattern: `/accounts/[id]` reached a Link and the App Router threw
// "Dynamic href found in <Link>" (frontend review finding 1). These tests pin
// the registry helper and the rendered rows, so no pattern can reach a Link again.

const ALL_DYNAMIC = [...SCREENS, ...PORTAL_SCREENS].filter((row) => isDynamicPath(row.path));

function renderAll() {
  return render(
    <FinderOverlay
      kind="all"
      screens={SCREENS}
      pinned={new Set()}
      onTogglePin={() => {}}
      favourites={[]}
      history={[]}
      onClose={() => {}}
    />,
  );
}

describe("navigableHref", () => {
  it("gives a concrete screen its own path", () => {
    expect(
      navigableHref({ path: "/tickets", screen: "queue", label: "Queue", section: "Cases", permission: null }),
    ).toBe("/tickets");
  });

  it("sends a record screen to its list parent when the viewer may see it", () => {
    const account = SCREENS.find((row) => row.path === "/accounts/[id]")!;
    expect(navigableHref(account, SCREENS)).toBe("/accounts");
    const person = SCREENS.find((row) => row.path === "/roster/[id]")!;
    expect(navigableHref(person, SCREENS)).toBe("/roster");
  });

  it("refuses a parent the viewer may not see, so the row stays unlinked", () => {
    const account = SCREENS.find((row) => row.path === "/accounts/[id]")!;
    expect(navigableHref(account, [account])).toBeNull();
  });

  it("returns null when stripping the segments leaves no registered screen", () => {
    const pack = SCREENS.find((row) => row.path === "/reports/packs/[id]")!;
    expect(navigableHref(pack, SCREENS)).toBeNull();
    const calendar = SCREENS.find((row) => row.path === "/admin/accounts/[id]/calendars/new")!;
    expect(navigableHref(calendar, SCREENS)).toBeNull();
  });

  it("never returns a path that still carries a dynamic segment, for any registered route", () => {
    expect(ALL_DYNAMIC.length).toBeGreaterThan(8);
    for (const row of [...SCREENS, ...PORTAL_SCREENS]) {
      const href = navigableHref(row, [...SCREENS, ...PORTAL_SCREENS]);
      expect(href === null || !isDynamicPath(href), row.path).toBe(true);
    }
  });
});

describe("FinderOverlay, the All finder", () => {
  it("renders every registered screen without producing a dynamic href", () => {
    renderAll();
    const dialog = screen.getByRole("dialog");
    const hrefs = within(dialog)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href") ?? "");
    expect(hrefs.length).toBeGreaterThan(20);
    for (const href of hrefs) {
      expect(isDynamicPath(href), href).toBe(false);
      expect(href.startsWith("/")).toBe(true);
    }
  });

  it("renders a record screen with no list parent as plain text, not a link", () => {
    renderAll();
    const pack = screen.getByText("Report pack").closest("[data-screen]");
    expect(pack).not.toBeNull();
    expect(pack).toHaveAttribute("data-navigable", "false");
    expect(pack!.tagName).toBe("SPAN");
    // Render 12 gives every screen one line, so the row says why it is not
    // a link on its title rather than in a second run of words beside the
    // label.
    expect(pack).toHaveAttribute("title", expect.stringContaining("Opens from a record."));
  });

  it("links a record screen to its list parent", () => {
    renderAll();
    expect(screen.getByText("Account dashboard").closest("a")).toHaveAttribute("href", "/accounts");
    expect(screen.getByText("Ticket").closest("a")).toHaveAttribute("href", "/tickets");
  });
});

describe("FinderOverlay, the stored finders", () => {
  it("drops a stored favourite or visit whose path is a pattern", () => {
    render(
      <FinderOverlay
        kind="favourites"
        screens={SCREENS}
        pinned={new Set()}
        onTogglePin={() => {}}
        favourites={[
          { path: "/tickets?view=my-group", label: "My group", type: "view" },
          { path: "/accounts/[id]", label: "Broken", type: "view" },
        ]}
        history={[]}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole("link", { name: "My group" })).toHaveAttribute("href", "/tickets?view=my-group");
    expect(screen.queryByText("Broken")).not.toBeInTheDocument();
  });

  it("drops a history entry whose path is a pattern", () => {
    render(
      <FinderOverlay
        kind="history"
        screens={SCREENS}
        pinned={new Set()}
        onTogglePin={() => {}}
        favourites={[]}
        history={[
          { path: "/tickets/CS1000203", label: "CS1000203", at: new Date().toISOString() },
          { path: "/roster/[id]", label: "Broken", at: new Date().toISOString() },
        ]}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole("link", { name: "CS1000203" })).toHaveAttribute("href", "/tickets/CS1000203");
    expect(screen.queryByText("Broken")).not.toBeInTheDocument();
  });
});
