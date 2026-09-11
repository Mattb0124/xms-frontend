"use client";

import Image from "next/image";
import Link from "next/link";
import { ICON, BellIcon, CaretDownIcon, ChevronDownIcon, SearchIcon, StarIcon } from "@/components/xms/icons";
import { cn } from "@/lib/utils";

export type FinderKind = "all" | "favourites" | "history" | "workspaces";

export interface FinderBarProps {
  activeFinder: FinderKind | null;
  onFinder: (kind: FinderKind) => void;
  /** "Queue: my group, open" - the instance name is drawn by the pill itself. */
  workspaceLabel: string;
  starred: boolean;
  onToggleStar: () => void;
  /** The scope pill's own chevron: it opens the same overlay the finders do. */
  onWorkspace: () => void;
  workspaceOpen?: boolean;
  onSearchFocus: () => void;
  unreadCount: number;
  onNotifications: () => void;
  userInitials: string;
  onUser: () => void;
}

const FINDERS: Array<{ kind: FinderKind; label: string }> = [
  { kind: "all", label: "All" },
  { kind: "favourites", label: "Favourites" },
  { kind: "history", label: "History" },
  { kind: "workspaces", label: "Workspaces" },
];

/**
 * The navy finder bar (Wireframes v2 section 2, v3 renders 01 to 15): finders
 * only, never destinations.
 *
 * Every zone carries a fixed size rather than one derived from its content, so
 * nothing in the bar moves when `me`, the unread count or the current screen
 * label arrive: the logo is its native 196 by 24, the scope pill a fixed 320px, the search
 * field 244px, and the Axel pill, bell and avatar are sized in the class list
 * rather than by their text. The bar itself is `shrink-0`, which the built bar
 * was not: as a flex child of a column it was squeezed from 56px to about
 * 32px, which is the height the reviewer measured.
 */
export function FinderBar(props: FinderBarProps) {
  return (
    <header
      className="bg-xms-navy shrink-0 text-white"
      style={{ height: "var(--xms-finder-bar-h)" }}
      data-testid="finder-bar"
      role="banner"
    >
      <div className="flex h-full items-center gap-2 px-4">
        {/* The real logo, white paths on transparent at its native 24px, which
            already carries the words: there is no text wordmark beside it. It
            is the way back to the home screen, which is what the mark it
            replaced was. */}
        <Link href="/" className="flex shrink-0 items-center" aria-label="The Hackett Group, home">
          <Image src="/thehackettgroup_logo.svg" alt="The Hackett Group" width={172} height={21} priority unoptimized />
        </Link>
        <nav aria-label="Finders" className="ml-5 flex shrink-0 items-center gap-1">
          {FINDERS.map((finder) => (
            <button
              key={finder.kind}
              type="button"
              aria-pressed={props.activeFinder === finder.kind}
              onClick={() => props.onFinder(finder.kind)}
              className={cn(
                "hover:bg-xms-navy-overlay h-8 rounded-[4px] px-[10px] text-[14px] font-medium",
                props.activeFinder === finder.kind ? "bg-xms-navy-overlay text-white" : "text-white/85",
              )}
            >
              {finder.label}
            </button>
          ))}
        </nav>

        {/* The scope pill: the instance and the current view, with a star that
            favourites that exact view and a chevron onto the same overlay the
            Favourites finder opens (renders 12 to 14). Fixed width, so a long
            or a late-arriving label never shifts the search field. */}
        <div className="mx-auto flex min-w-0 justify-center px-4">
          <span
            className="bg-xms-navy-overlay border-xms-navy-line flex h-[34px] w-[320px] items-center gap-2 rounded-[999px] border pr-2 pl-4"
            data-testid="workspace-pill"
          >
            <button
              type="button"
              onClick={props.onWorkspace}
              aria-expanded={props.workspaceOpen ?? false}
              aria-label={`Scope: THG PROD, ${props.workspaceLabel}`}
              className="xms-plain flex min-w-0 flex-1 items-center gap-[6px] text-left"
            >
              <span className="text-[14px] font-semibold whitespace-nowrap text-white">THG PROD</span>
              <span aria-hidden className="text-white/40">
                ·
              </span>
              <span className="truncate text-[14px] font-medium text-white/90">{props.workspaceLabel}</span>
              <ChevronDownIcon size={ICON.glyph} className="ml-auto shrink-0 text-white/55" />
            </button>
            <button
              type="button"
              aria-label={props.starred ? "Unstar this view" : "Star this view"}
              aria-pressed={props.starred}
              onClick={props.onToggleStar}
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-[999px]",
                props.starred ? "text-xms-sla-warn" : "text-white/55 hover:text-white",
              )}
            >
              <StarIcon size={ICON.action} filled={props.starred} />
            </button>
          </span>
        </div>

        {/* The search field, measured off the reference bar Matt supplied on
            2026-09-11: a 244 by 34 rounded rectangle, not a pill, on the
            blue fill with a light edge, the magnifier and the word both in
            plain white rather than the two greys they were, and a caret in
            its own segment behind a hairline.

            The caret is drawn, not wired. The reference splits the field
            into a box and a list button, but this bar has one search and one
            overlay, so a second control there would be a second way to do
            the same thing. The segment is what the reference looks like; the
            whole field is the button.

            The `/` hint the field used to print is gone with the pill it sat
            in. The shortcut still works, so it moves onto the control as a
            title and aria-keyshortcuts rather than being lost. */}
        <button
          type="button"
          onClick={props.onSearchFocus}
          title="Search (/)"
          aria-keyshortcuts="/"
          className="xms-plain flex h-[34px] w-[244px] shrink-0 items-stretch rounded-[4px] border border-[color:var(--xms-navy-field-line)] bg-[color:var(--xms-navy-sunken)] text-left"
        >
          <span className="flex min-w-0 flex-1 items-center gap-[10px] px-[10px]">
            <SearchIcon size={ICON.action} className="shrink-0 text-white" />
            <span className="flex-1 truncate text-[14px] text-white">Search</span>
          </span>
          <span aria-hidden className="w-px self-stretch bg-[color:var(--xms-navy-field-line)]" />
          <span aria-hidden className="flex w-[35px] shrink-0 items-center justify-center">
            <CaretDownIcon size={ICON.action} className="text-white" />
          </span>
        </button>

        <button
          type="button"
          aria-label={`Notifications, ${props.unreadCount} unread`}
          onClick={props.onNotifications}
          className="relative ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-[999px] text-white/85 hover:text-white"
        >
          <BellIcon size={ICON.bar} />
          {/* The badge sits on the bell and takes no room in the row, so a
              count arriving after the first paint moves nothing beside it. */}
          {props.unreadCount > 0 ? (
            <span
              data-testid="unread-badge"
              className="bg-xms-sla-breach xms-mono absolute -top-[1px] -right-[1px] flex h-[16px] min-w-[16px] items-center justify-center rounded-[999px] px-[3px] text-[14px] leading-none font-semibold text-white"
            >
              {props.unreadCount > 99 ? "99+" : props.unreadCount}
            </span>
          ) : null}
        </button>

        {/* The avatar is the reference's own inversion: a light disc with the
            initials in the link blue, rather than the accent disc with white
            initials it was. The reference measures 24px across; `h-7` lands
            on 24.5 here, because the root font size in this app is 14 and not
            16, which is also why the bell beside it at `h-8` is 28 rather
            than 32. Measured in the browser, not assumed.

            The reference also carries a green presence dot on the disc. It is
            not drawn here: XMS has no presence, and a status mark that is
            always the same colour tells the reader something untrue. */}
        <button
          type="button"
          aria-label="Account menu"
          onClick={props.onUser}
          className="ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-[999px] bg-[color:var(--xms-avatar-bg)] text-[14px] leading-none text-[color:var(--xms-avatar-ink)]"
        >
          {props.userInitials}
        </button>
      </div>
    </header>
  );
}
