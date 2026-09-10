import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FinderOverlay } from "@/components/shell/finder-overlay";
import { PinnedSidebar, sidebarTree, sidebarItems } from "@/components/shell/pinned-sidebar";
import { visibleScreens } from "@/lib/routes";

const base = {
  extraPins: new Set<string>(),
  starredViews: [],
  currentPath: "/",
  onEditPins: () => {},
};

describe("PinnedSidebar", () => {
  it("renders a skeleton and no links while permissions are loading", () => {
    const { container } = render(<PinnedSidebar {...base} permissions={undefined} />);
    expect(container.querySelector("[data-skeleton]")).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("shows only the unrestricted pins to a user with no permissions", () => {
    render(<PinnedSidebar {...base} permissions={new Set()} />);
    const labels = screen.getAllByRole("link").map((link) => link.textContent);
    expect(labels).toEqual(["My work"]);
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });

  it("shows Admin when pinned by an administrator, and Cases with tickets:view", () => {
    const permissions = new Set(["admin:accounts", "tickets:view"]);
    expect(sidebarItems(permissions, new Set(["/admin"])).map((s) => s.label)).toContain("Admin");
    render(
      <PinnedSidebar
        {...base}
        permissions={permissions}
        extraPins={new Set(["/admin"])}
        counts={{ cases: 42 }}
        currentPath="/cases"
      />,
    );
    expect(screen.getByRole("link", { name: /Admin/ })).toHaveAttribute("href", "/admin");
    const queue = screen.getByRole("link", { name: /Cases/ });
    expect(queue).toHaveAttribute("aria-current", "page");
    expect(queue).toHaveTextContent("42");
  });

  it("never shows a pin the user is not permitted to see", () => {
    render(<PinnedSidebar {...base} permissions={new Set()} extraPins={new Set(["/admin", "/cases/dispatch"])} />);
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
    expect(screen.queryByText("Dispatch")).not.toBeInTheDocument();
  });

  /**
   * The footer's number is the whole tree, so it has to be the number of rows
   * the All overlay lists for the same reader. A consultant was shown "Browse
   * all screens 15" beside a five-row sidebar, and the two numbers were never
   * checked against each other.
   */
  it("counts, in the footer, exactly what the All overlay lists for that reader", () => {
    const permissions = new Set([
      "ai:use",
      "kb:author",
      "tickets:create",
      "tickets:resolve",
      "tickets:view",
      "tickets:work",
      "time:log",
    ]);
    const screens = visibleScreens(permissions);
    const { unmount } = render(<PinnedSidebar {...base} permissions={permissions} />);
    // Six rows, one of them Solutions rather than Operations, which needs a
    // permission this reader does not hold.
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "My work",
      "Cases",
      "Dispatch",
      "Quarantine",
      "My timesheet",
      "Solutions",
    ]);
    unmount();

    const overlay = render(
      <FinderOverlay
        kind="all"
        screens={screens}
        pinned={new Set()}
        onTogglePin={() => {}}
        favourites={[]}
        history={[]}
        onClose={() => {}}
      />,
    );
    expect(overlay.container.querySelectorAll("[data-screen]")).toHaveLength(screens.length);
  });
});

/**
 * The sidebar was `position: static` and 1475px tall inside a 1020px viewport,
 * so on a long list "Browse all screens" was pushed below the fold and could
 * not be reached (frontend review finding 7).
 */
describe("the sidebar column", () => {
  it("is a full-height column of the shell rather than stuck to a moving page", () => {
    render(<PinnedSidebar {...base} permissions={new Set(["tickets:view"])} />);
    const aside = screen.getByTestId("pinned-sidebar");
    // The shell is the viewport and the work area is what scrolls, so the
    // sidebar is simply as tall as the column it stands in. Sticking it to
    // the page was the workaround for a scrolling document.
    expect(aside.className).toContain("h-full");
    expect(aside.className).not.toContain("sticky");
    // Below the breakpoint it floats over the content and still has to clear
    // the navy bar.
    expect(aside.className).toContain("max-md:fixed");
    expect(aside.className).toContain("max-md:top-[var(--xms-finder-bar-h)]");
  });

  it("scrolls the pinned rows rather than growing past the bottom of the window", () => {
    render(<PinnedSidebar {...base} permissions={new Set(["tickets:view"])} />);
    const aside = screen.getByTestId("pinned-sidebar");
    const scroller = aside.querySelector(".overflow-y-auto");
    expect(scroller).not.toBeNull();
    expect(scroller!.contains(screen.getByRole("navigation", { name: "Pinned screens" }))).toBe(true);
  });

  it("floats over the content below the md breakpoint rather than taking a column", () => {
    render(<PinnedSidebar {...base} permissions={new Set(["tickets:view"])} />);
    expect(screen.getByTestId("pinned-sidebar").className).toContain("max-md:fixed");
  });
});

describe("sidebarTree", () => {
  it("groups screens under the section the registry puts them in, in registry order", () => {
    const groups = sidebarTree([
      { path: "/", screen: "my_work", label: "My work", section: "Home" } as never,
      { path: "/cases", screen: "queue", label: "Cases", section: "Cases" } as never,
      { path: "/cases/dispatch", screen: "dispatch", label: "Dispatch", section: "Cases" } as never,
      { path: "/time", screen: "my_time", label: "My timesheet", section: "Time" } as never,
    ]);
    expect(groups.map((group) => group.section)).toEqual(["Home", "Cases", "Time"]);
    expect(groups[1].screens.map((screen) => screen.label)).toEqual(["Cases", "Dispatch"]);
  });

  it("leaves out a section the reader has pinned nothing from", () => {
    const groups = sidebarTree([{ path: "/cases", screen: "queue", label: "Cases", section: "Cases" } as never]);
    expect(groups.map((group) => group.section)).toEqual(["Cases"]);
  });

  it("has nothing to group before the permissions arrive", () => {
    expect(sidebarTree([])).toEqual([]);
  });
});

describe("the sidebar tree", () => {
  it("draws a parent per section, and shuts one when it is pressed", () => {
    render(<PinnedSidebar {...base} permissions={new Set(["tickets:view", "time:log"])} />);
    const cases = screen.getByRole("button", { name: "Cases" });
    expect(cases).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: /Cases/ })).toBeInTheDocument();

    fireEvent.click(cases);
    expect(cases).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: /Dispatch/ })).toBeNull();
  });

  it("no longer offers Browse all screens", () => {
    render(<PinnedSidebar {...base} permissions={new Set(["tickets:view"])} />);
    expect(screen.queryByText(/Browse all screens/)).toBeNull();
  });
});
