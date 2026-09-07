"use client";

import { cn } from "@/lib/utils";

export type FinderKind = "all" | "favourites" | "history";

export interface FinderBarProps {
  activeFinder: FinderKind | null;
  onFinder: (kind: FinderKind) => void;
  /** "THG PROD · Queue: my group, open" */
  workspaceLabel: string;
  starred: boolean;
  onToggleStar: () => void;
  onSearchFocus: () => void;
  onAxel: () => void;
  unreadCount: number;
  onNotifications: () => void;
  userInitials: string;
  onUser: () => void;
}

const FINDERS: Array<{ kind: FinderKind; label: string }> = [
  { kind: "all", label: "All" },
  { kind: "favourites", label: "Favourites" },
  { kind: "history", label: "History" },
];

/** The navy finder bar (Wireframes v2 section 2): finders only, never destinations. */
export function FinderBar(props: FinderBarProps) {
  return (
    <header
      className="bg-xms-navy text-white"
      style={{ height: "var(--xms-finder-bar-h)" }}
      data-testid="finder-bar"
      role="banner"
    >
      <div className="flex h-full items-center gap-3 px-4">
        <div className="flex items-center gap-2">
          <span className="bg-xms-accent xms-mono flex h-7 w-7 items-center justify-center rounded-[4px] text-[12px] font-semibold">
            X
          </span>
          <span className="text-[13px] font-semibold">XMS</span>
          <span className="hidden text-[12px] opacity-70 lg:inline">The Hackett Group</span>
        </div>
        <nav aria-label="Finders" className="ml-4 flex items-center gap-1">
          {FINDERS.map((finder) => (
            <button
              key={finder.kind}
              type="button"
              aria-pressed={props.activeFinder === finder.kind}
              onClick={() => props.onFinder(finder.kind)}
              className={cn(
                "h-8 rounded-[4px] px-3 text-[13px]",
                props.activeFinder === finder.kind
                  ? "bg-xms-navy-overlay text-white"
                  : "text-white/80 hover:bg-xms-navy-overlay",
              )}
            >
              {finder.label}
            </button>
          ))}
        </nav>
        <div className="mx-auto flex items-center">
          <span
            className="border-xms-navy-line bg-xms-navy-overlay flex h-8 items-center gap-2 rounded-[999px] border pr-2 pl-3 text-[12px]"
            data-testid="workspace-pill"
          >
            <span className="xms-mono opacity-80">THG PROD</span>
            <span className="opacity-50">·</span>
            <span>{props.workspaceLabel}</span>
            <button
              type="button"
              aria-label={props.starred ? "Unstar this view" : "Star this view"}
              aria-pressed={props.starred}
              onClick={props.onToggleStar}
              className={cn(
                "ml-1 text-[14px] leading-none",
                props.starred ? "text-xms-sla-warn" : "text-white/60 hover:text-white",
              )}
            >
              {props.starred ? "★" : "☆"}
            </button>
          </span>
        </div>
        <button
          type="button"
          onClick={props.onSearchFocus}
          className="border-xms-navy-line bg-xms-navy-overlay flex h-8 w-[260px] items-center gap-2 rounded-[4px] border px-3 text-left text-[12px] text-white/60 hover:text-white"
        >
          <span className="flex-1 truncate">Search tickets, accounts, solutions</span>
          <kbd className="xms-mono rounded-[3px] border border-white/20 px-1 text-[10px]">/</kbd>
        </button>
        <button
          type="button"
          onClick={props.onAxel}
          className="border-xms-ai-accent text-xms-ai-accent hover:bg-xms-navy-overlay h-8 rounded-[4px] border px-3 text-[12px] font-medium"
        >
          Axel
        </button>
        <button
          type="button"
          aria-label={`Notifications, ${props.unreadCount} unread`}
          onClick={props.onNotifications}
          className="hover:bg-xms-navy-overlay relative flex h-8 w-8 items-center justify-center rounded-[4px] text-[15px]"
        >
          <span aria-hidden>🔔</span>
          {props.unreadCount > 0 ? (
            <span className="bg-xms-accent xms-mono absolute -top-1 -right-1 rounded-[999px] px-1 text-[10px] font-semibold">
              {props.unreadCount}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          aria-label="Account menu"
          onClick={props.onUser}
          className="bg-xms-accent xms-mono flex h-8 w-8 items-center justify-center rounded-[999px] text-[11px] font-semibold"
        >
          {props.userInitials}
        </button>
      </div>
    </header>
  );
}
