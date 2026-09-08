"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import {
  BookIcon,
  ChartIcon,
  ClockIcon,
  GridIcon,
  InboxIcon,
  PencilIcon,
  PeopleIcon,
  ShieldIcon,
  ShuffleIcon,
  StarIcon,
  type IconProps,
} from "@/components/xms/icons";
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
  /** Live counts by screen id, from the queries the screens themselves read. */
  counts?: Record<string, number | undefined>;
  starredViews: StarredView[];
  currentPath: string;
  onBrowseAll: () => void;
  onEditPins: () => void;
}

/**
 * One icon per screen id (v3 renders 01, 08, 09): the sidebar in the renders
 * is an icon, a label and a right-aligned count, and the built sidebar had
 * only the label. Anything without an entry falls back to the neutral book, so
 * a newly pinned route is never drawn without a mark.
 */
const SCREEN_ICON: Record<string, ComponentType<IconProps>> = {
  "my-work": GridIcon,
  queue: InboxIcon,
  dispatch: ShuffleIcon,
  quarantine: ShieldIcon,
  my_time: ClockIcon,
  timesheet: ClockIcon,
  time: ClockIcon,
  operations: ChartIcon,
  solutions: BookIcon,
  knowledge: BookIcon,
  accounts: PeopleIcon,
  roster: PeopleIcon,
};

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
          className="text-xms-muted hover:text-xms-ink ml-auto"
        >
          <PencilIcon size={14} />
        </button>
      </div>
      {/* The only scrolling region, so the footer below is always in reach. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {!props.permissions ? (
          <div className="px-4">
            <Skeleton lines={5} />
          </div>
        ) : (
          <nav aria-label="Pinned screens" className="flex flex-col gap-[1px] px-2">
            {items.map((screen) => {
              const active = props.currentPath === screen.path;
              const count = props.counts?.[screen.screen];
              const ScreenIcon = SCREEN_ICON[screen.screen] ?? BookIcon;
              return (
                <Link
                  key={screen.path}
                  href={screen.path}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    // The selected row in the renders: a cobalt 3px bar inside
                    // the left edge, a blue-tinted fill, ink text at 500.
                    "relative flex h-9 items-center gap-[10px] rounded-[4px] pr-3 pl-[10px] text-[13px] hover:no-underline",
                    active
                      ? "bg-xms-tint text-xms-ink font-medium shadow-[inset_3px_0_0_var(--xms-selected-bar)]"
                      : "text-xms-body hover:bg-xms-row-hover hover:text-xms-ink",
                  )}
                >
                  <ScreenIcon size={17} className={active ? "text-xms-accent" : "text-xms-muted"} />
                  <span className="flex-1 truncate">{screen.label}</span>
                  {/* Reserved width, so a count arriving after the first paint
                      does not reflow the label (the header-jump finding). */}
                  <span className="xms-mono text-xms-label min-w-[18px] text-right text-[12px]">
                    {typeof count === "number" ? count : ""}
                  </span>
                </Link>
              );
            })}
          </nav>
        )}
        {props.permissions && props.starredViews.length > 0 ? (
          <>
            <p className="xms-caption px-4 pt-5 pb-2">Starred views</p>
            <nav aria-label="Starred views" className="flex flex-col gap-[1px] px-2">
              {props.starredViews.map((view) => (
                <Link
                  key={view.path}
                  href={view.path}
                  className="text-xms-body hover:bg-xms-row-hover hover:text-xms-ink flex h-8 items-center gap-[10px] rounded-[4px] pr-3 pl-[10px] text-[13px] hover:no-underline"
                >
                  <StarIcon size={15} className="text-xms-muted" />
                  <span className="flex-1 truncate">{view.label}</span>
                  <span className="xms-mono text-xms-label min-w-[18px] text-right text-[12px]">
                    {typeof view.count === "number" ? view.count : ""}
                  </span>
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
          className="text-xms-body hover:bg-xms-row-hover hover:text-xms-ink flex h-9 w-full items-center gap-[10px] rounded-[4px] pr-3 pl-[10px] text-[13px] disabled:opacity-40"
        >
          <GridIcon size={17} className="text-xms-muted" />
          <span className="flex-1 text-left">Browse all screens</span>
          <span className="xms-mono text-xms-label min-w-[18px] text-right text-[12px]">{total || ""}</span>
        </button>
      </div>
    </aside>
  );
}
