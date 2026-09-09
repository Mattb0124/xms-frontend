import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FinderOverlay } from "@/components/shell/finder-overlay";
import { PinnedSidebar, sidebarItems } from "@/components/shell/pinned-sidebar";
import { visibleScreens } from "@/lib/routes";

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
    expect(screen.getByRole("button", { name: /Browse all screens/ })).toBeDisabled();
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
    // v3 render 01: the footer is a label with the tree count right-aligned
    // beside it, not a label with the count spliced into the sentence.
    const browse = screen.getByRole("button", { name: /Browse all screens/ });
    expect(browse).toBeEnabled();
    expect(browse).toHaveTextContent("15");
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
    const footer = screen.getByRole("button", { name: /Browse all screens/ });
    expect(footer).toHaveTextContent(String(screens.length));
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
  it("is a sticky full-height column bounded by the viewport", () => {
    render(<PinnedSidebar {...base} permissions={new Set(["tickets:view"])} />);
    const aside = screen.getByTestId("pinned-sidebar");
    expect(aside.className).toContain("sticky");
    expect(aside.style.top).toBe("var(--xms-finder-bar-h)");
    expect(aside.style.height).toBe("calc(100vh - var(--xms-finder-bar-h))");
  });

  it("keeps Browse all screens outside the scrolling region, so it is always in reach", () => {
    render(<PinnedSidebar {...base} permissions={new Set(["tickets:view"])} />);
    const aside = screen.getByTestId("pinned-sidebar");
    const scroller = aside.querySelector(".overflow-y-auto");
    expect(scroller).not.toBeNull();
    expect(scroller!.contains(screen.getByText(/Browse all screens/))).toBe(false);
    expect(scroller!.contains(screen.getByRole("navigation", { name: "Pinned screens" }))).toBe(true);
  });

  it("floats over the content below the md breakpoint rather than taking a column", () => {
    render(<PinnedSidebar {...base} permissions={new Set(["tickets:view"])} />);
    expect(screen.getByTestId("pinned-sidebar").className).toContain("max-md:fixed");
  });
});
