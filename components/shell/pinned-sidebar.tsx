"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDownIcon, ICON, StarIcon, screenIcon } from "@/components/xms/icons";
import { Skeleton } from "@/components/xms/skeleton";
import { pinnedScreens, visibleScreens, type Screen, isDynamicPath } from "@/lib/routes";
import { cn } from "@/lib/utils";

export interface StarredView {
  path: string;
  label: string;
  count?: number;
}

export interface PinnedSidebarProps {
  /** Undefined until `me` has loaded: the sidebar then renders a skeleton and no links (fail closed). */
  permissions: ReadonlySet<string> | undefined;
  /** Extra pins the user chose in the All overlay, by path. */
  extraPins: ReadonlySet<string>;
  /** Live counts by screen id, from the queries the screens themselves read. */
  counts?: Record<string, number | undefined>;
  starredViews: StarredView[];
  currentPath: string;
}

export function sidebarItems(permissions: ReadonlySet<string> | undefined, extraPins: ReadonlySet<string>): Screen[] {
  if (!permissions) return [];
  const defaults = pinnedScreens(permissions);
  // Anything the reader pinned by hand that the default six do not already
  // carry. It reads the default set rather than the `pinned` rank, because a
  // ranked screen that fell outside this reader's six is still one they may
  // choose to pin.
  const already = new Set(defaults.map((screen) => screen.path));
  // A dynamic path is a pattern, not an address: `/reports/packs/[id]` in a
  // Link is a runtime error in the app router. One can be pinned by hand from
  // the record it belongs to, so the pattern is refused here as well as at the
  // pin itself.
  const extras = visibleScreens(permissions).filter(
    (s) => extraPins.has(s.path) && !already.has(s.path) && !isDynamicPath(s.path),
  );
  return [...defaults, ...extras];
}

export interface SidebarGroup {
  section: string;
  screens: Screen[];
}

/**
 * The pinned screens under the section each one belongs to.
 *
 * The registry already says which section a screen is in, and the sidebar
 * was throwing that away and drawing one flat list, so a reader had no way
 * to tell that Dispatch and Quarantine are both parts of Cases. Sections
 * come out in the order the registry declares them, and a section a reader
 * has pinned nothing from does not appear at all.
 */
export function sidebarTree(items: readonly Screen[]): SidebarGroup[] {
  const groups: SidebarGroup[] = [];
  for (const screen of items) {
    const found = groups.find((group) => group.section === screen.section);
    if (found) found.screens.push(screen);
    else groups.push({ section: screen.section, screens: [screen] });
  }
  return groups;
}

/** The pinned tree and the starred views (Wireframes v2 section 2). */
export function PinnedSidebar(props: PinnedSidebarProps) {
  const items = sidebarItems(props.permissions, props.extraPins);
  const tree = sidebarTree(items);
  // Every section starts open. A reader who shuts one keeps it shut for the
  // session, which is the whole of what a tree owes them here.
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  return (
    // A full-height column with its own scroll. It used to grow with its
    // content, so a long list ran past the bottom of the window (frontend
    // review finding 7), and it used to be stuck to a scrolling page; the
    // shell is the viewport now, so it is simply as tall as the column it
    // stands in. Below the md breakpoint it floats over the content instead
    // of taking 238px out of a 390px viewport (finding 8).
    <aside
      className="xms-layer-sidebar bg-xms-card border-xms-line flex h-full min-h-0 shrink-0 flex-col border-r max-md:fixed max-md:top-[var(--xms-finder-bar-h)] max-md:bottom-0 max-md:left-0 max-md:z-30 max-md:h-auto max-md:shadow-2xl"
      style={{ width: "var(--xms-sidebar-w)" }}
      aria-label="Pinned"
      data-testid="pinned-sidebar"
    >
      {/* The whole column scrolls: there is no header above it any more. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-2">
        {!props.permissions ? (
          <div className="px-4">
            <Skeleton lines={5} />
          </div>
        ) : (
          <nav aria-label="Pinned screens" className="flex flex-col">
            {tree.map((group) => {
              const open = !closed.has(group.section);
              return (
                <div key={group.section} className="flex flex-col">
                  {/* The parent. It is a disclosure, not a link: a section is
                      a place screens live rather than a screen of its own. */}
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() =>
                      setClosed((was) => {
                        const next = new Set(was);
                        if (next.has(group.section)) next.delete(group.section);
                        else next.add(group.section);
                        return next;
                      })
                    }
                    className="text-xms-nav-text hover:bg-xms-row-hover flex items-center gap-[6px] px-[14px] pt-[10px] pb-[4px] text-left"
                  >
                    <ChevronDownIcon
                      size={ICON.glyph}
                      className={cn("shrink-0 transition-transform", open ? undefined : "-rotate-90")}
                    />
                    <span className="flex-1 text-[14px]">{group.section}</span>
                  </button>
                  {open
                    ? group.screens.map((screen) => {
                        const active = props.currentPath === screen.path;
                        const count = props.counts?.[screen.screen];
                        const ScreenIcon = screenIcon(screen.screen);
                        return (
                          <Link
                            key={screen.path}
                            href={screen.path}
                            aria-current={active ? "page" : undefined}
                            className={cn("xms-nav-row pl-[30px] hover:no-underline", active && "is-active")}
                          >
                            <ScreenIcon size={ICON.row} className="shrink-0" />
                            <span className="min-w-0 flex-1 truncate">{screen.label}</span>
                            {/* The chip is drawn only where the server counted
                                something; the row has nothing to reserve, since
                                the label truncates rather than reflowing. */}
                            {typeof count === "number" ? <span className="xms-nav-badge">{count}</span> : null}
                          </Link>
                        );
                      })
                    : null}
                </div>
              );
            })}
          </nav>
        )}
        {props.permissions && props.starredViews.length > 0 ? (
          <>
            <p className="text-xms-nav-text px-[14px] pt-[18px] pb-2 text-[14px]">Starred views</p>
            <nav aria-label="Starred views" className="flex flex-col">
              {props.starredViews.map((view) => (
                <Link key={view.path} href={view.path} className="xms-nav-row text-[14px] hover:no-underline">
                  <StarIcon size={ICON.field} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{view.label}</span>
                  {typeof view.count === "number" ? <span className="xms-nav-badge">{view.count}</span> : null}
                </Link>
              ))}
            </nav>
          </>
        ) : null}
      </div>
    </aside>
  );
}
