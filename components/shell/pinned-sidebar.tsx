"use client";

import Link from "next/link";
import { ICON, GridIcon, PencilIcon, StarIcon, screenIcon } from "@/components/xms/icons";
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
  onBrowseAll: () => void;
  onEditPins: () => void;
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

/** Pinned list plus starred views plus Browse all screens (Wireframes v2 section 2). */
export function PinnedSidebar(props: PinnedSidebarProps) {
  const items = sidebarItems(props.permissions, props.extraPins);
  const total = props.permissions ? visibleScreens(props.permissions).length : 0;
  return (
    // A sticky full-height column with its own scroll. It used to grow with its
    // content, so on a long list "Browse all screens" was pushed below the fold
    // and could not be reached (frontend review finding 7). Below the md
    // breakpoint it floats over the content instead of taking 238px out of a
    // 390px viewport (finding 8).
    <aside
      className="bg-xms-card border-xms-line sticky z-20 flex shrink-0 flex-col border-r max-md:fixed max-md:bottom-0 max-md:left-0 max-md:z-30 max-md:shadow-2xl"
      style={{
        width: "var(--xms-sidebar-w)",
        top: "var(--xms-finder-bar-h)",
        height: "calc(100vh - var(--xms-finder-bar-h))",
      }}
      aria-label="Pinned"
      data-testid="pinned-sidebar"
    >
      <div className="flex items-center gap-[7px] px-[14px] pt-3 pb-2">
        <span className="xms-caption flex-1">Pinned</span>
        <button
          type="button"
          aria-label="Edit pins"
          onClick={props.onEditPins}
          className="text-xms-placeholder hover:text-xms-ink"
        >
          <PencilIcon size={ICON.control} />
        </button>
      </div>
      {/* The only scrolling region, so the footer below is always in reach. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {!props.permissions ? (
          <div className="px-4">
            <Skeleton lines={5} />
          </div>
        ) : (
          <nav aria-label="Pinned screens" className="flex flex-col">
            {items.map((screen) => {
              const active = props.currentPath === screen.path;
              const count = props.counts?.[screen.screen];
              const ScreenIcon = screenIcon(screen.screen);
              return (
                <Link
                  key={screen.path}
                  href={screen.path}
                  aria-current={active ? "page" : undefined}
                  className={cn("xms-nav-row hover:no-underline", active && "is-active")}
                >
                  <ScreenIcon
                    size={ICON.row}
                    className={cn("shrink-0", active ? "text-xms-accent-hover" : "text-xms-label")}
                  />
                  <span className="min-w-0 flex-1 truncate">{screen.label}</span>
                  {/* The chip is drawn only where the server counted
                      something; the row has nothing to reserve, since the
                      label truncates rather than reflowing. */}
                  {typeof count === "number" ? <span className="xms-nav-badge">{count}</span> : null}
                </Link>
              );
            })}
          </nav>
        )}
        {props.permissions && props.starredViews.length > 0 ? (
          <>
            <p className="xms-caption px-[14px] pt-[18px] pb-2">Starred views</p>
            <nav aria-label="Starred views" className="flex flex-col">
              {props.starredViews.map((view) => (
                <Link key={view.path} href={view.path} className="xms-nav-row text-[13px] hover:no-underline">
                  <StarIcon size={ICON.field} className="text-xms-placeholder shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{view.label}</span>
                  {typeof view.count === "number" ? <span className="xms-nav-badge">{view.count}</span> : null}
                </Link>
              ))}
            </nav>
          </>
        ) : null}
      </div>
      {/* The footer takes the plain row style, never the selected one. */}
      <div className="border-xms-line mt-auto border-t">
        <button
          type="button"
          onClick={props.onBrowseAll}
          disabled={!props.permissions}
          className="xms-nav-row w-full py-[13px] text-[13px] disabled:opacity-40"
        >
          <GridIcon size={ICON.row} className="text-xms-label shrink-0" />
          <span className="flex-1 text-left">Browse all screens</span>
          <span className="xms-mono text-xms-muted shrink-0 text-[11px]">{total || ""}</span>
        </button>
      </div>
    </aside>
  );
}
