"use client";

import Link from "next/link";
import { Skeleton } from "@/components/xms/skeleton";
import { pinnedScreens, visibleScreens, type Screen } from "@/lib/routes";
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
  counts?: Record<string, number>;
  starredViews: StarredView[];
  currentPath: string;
  onBrowseAll: () => void;
  onEditPins: () => void;
}

export function sidebarItems(permissions: ReadonlySet<string> | undefined, extraPins: ReadonlySet<string>): Screen[] {
  if (!permissions) return [];
  const defaults = pinnedScreens(permissions);
  const extras = visibleScreens(permissions).filter((s) => extraPins.has(s.path) && !s.pinned);
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
      <div className="flex items-center px-4 pt-4 pb-2">
        <span className="xms-caption">Pinned</span>
        <button
          type="button"
          aria-label="Edit pins"
          onClick={props.onEditPins}
          className="text-xms-muted hover:text-xms-ink ml-auto text-[12px]"
        >
          ✎
        </button>
      </div>
      {/* The only scrolling region, so the footer below is always in reach. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {!props.permissions ? (
          <div className="px-4">
            <Skeleton lines={5} />
          </div>
        ) : (
          <nav aria-label="Pinned screens" className="flex flex-col px-2">
            {items.map((screen) => {
              const active = props.currentPath === screen.path;
              const count = props.counts?.[screen.screen];
              return (
                <Link
                  key={screen.path}
                  href={screen.path}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-9 items-center gap-2 rounded-[4px] px-2 text-[13px] hover:no-underline",
                    active
                      ? "bg-xms-tint text-xms-ink shadow-[inset_3px_0_0_var(--xms-accent)]"
                      : "text-xms-body hover:bg-xms-row-hover",
                  )}
                >
                  <span className="flex-1">{screen.label}</span>
                  {typeof count === "number" ? (
                    <span className="xms-mono bg-xms-tint text-xms-accent rounded-[999px] px-[6px] text-[11px] font-semibold">
                      {count}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        )}
        {props.permissions && props.starredViews.length > 0 ? (
          <>
            <p className="xms-caption px-4 pt-5 pb-2">Starred views</p>
            <nav aria-label="Starred views" className="flex flex-col px-2">
              {props.starredViews.map((view) => (
                <Link
                  key={view.path}
                  href={view.path}
                  className="text-xms-body hover:bg-xms-row-hover flex h-8 items-center gap-2 rounded-[4px] px-2 text-[13px] hover:no-underline"
                >
                  <span className="text-xms-sla-warn text-[11px]">★</span>
                  <span className="flex-1 truncate">{view.label}</span>
                  {typeof view.count === "number" ? (
                    <span className="xms-mono text-xms-muted text-[11px]">{view.count}</span>
                  ) : null}
                </Link>
              ))}
            </nav>
          </>
        ) : null}
      </div>
      <div className="border-xms-line mt-auto border-t px-2 py-2">
        <button
          type="button"
          onClick={props.onBrowseAll}
          disabled={!props.permissions}
          className="text-xms-accent flex h-9 w-full items-center rounded-[4px] px-2 text-[13px] hover:underline disabled:opacity-40"
        >
          Browse all screens · {total}
        </button>
      </div>
    </aside>
  );
}
