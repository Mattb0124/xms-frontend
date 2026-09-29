"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ICON, BellIcon, SparkleIcon } from "@/components/xms/icons";

export interface FinderBarProps {
  /** The finder, built by the shell, which is what knows the permissions. */
  finder: ReactNode;
  /** Opens and closes the full-screen Axel surface. */
  onAxel: () => void;
  axelOpen: boolean;
  unreadCount: number;
  onNotifications: () => void;
  userInitials: string;
  onUser: () => void;
}

/**
 * The shell header (Wireframes v2 section 2, v3 renders 01 to 15): finders
 * only, never destinations.
 *
 * The bar wears AIXelerator's own chrome as of 2026-09-11, at Matt's request:
 * the ground, the icon buttons, the unread badge, the avatar and the assistant
 * CTA are all recipes in the vendored `aix-tokens.css`, so nothing about how
 * they look is set here. It is no longer navy; `--xms-navy` stays a token and
 * is simply not what the bar stands on any more.
 *
 * The four finders it used to carry (All, Favourites, History, Workspaces)
 * are gone, and so is the command palette behind Ctrl+K: one finder replaces
 * all five and searches records as well as screens (AIBL-329). The shell
 * builds it, because the shell is what knows the permissions and the history.
 */
export function FinderBar(props: FinderBarProps) {
  return (
    <header
      className="aix-app-header text-white"
      style={{ height: "var(--xms-finder-bar-h)" }}
      data-testid="finder-bar"
      role="banner"
    >
      <span aria-hidden className="aix-header-glow" />
      <div className="aix-header-row">
        {/* The real logo, white paths on transparent at its native 24px, which
            already carries the words: there is no text wordmark beside it. It
            is the way back to the home screen. */}
        <Link href="/" className="flex shrink-0 items-center" aria-label="The Hackett Group, home">
          <Image src="/thehackettgroup_logo.svg" alt="The Hackett Group" width={172} height={21} priority unoptimized />
        </Link>
        <div className="aix-header-find">{props.finder}</div>

        {/* The right-hand group, at the reference's own 6px gap. */}
        <div className="aix-header-right">
          <button
            type="button"
            aria-label={`Notifications, ${props.unreadCount} unread`}
            title="Notifications"
            onClick={props.onNotifications}
            className="aix-header-icon"
          >
            <BellIcon size={ICON.action} />
            {/* The badge sits on the bell and takes no room in the row, so a
                count arriving after the first paint moves nothing beside it.
                The reference stops counting at nine. */}
            {props.unreadCount > 0 ? (
              <span data-testid="unread-badge" className="aix-header-badge">
                {props.unreadCount > 9 ? "9+" : props.unreadCount}
              </span>
            ) : null}
          </button>

          {/* Axel. The recipe is `.aix-assistant-cta` in the vendored
              aix-tokens.css, spending AIX's own `--gradient-premium` and
              `--aix-glow-violet`; nothing about it is set here.

              The reference draws a chevron beside the label, because on that
              tenant two assistants are reachable and the button is a picker.
              XMS has one Axel and the button opens it, so there is no chevron:
              a caret that opens no menu is a promise the control cannot keep.

              It is a toggle, and says so: `aria-pressed` is what the surface
              below reads back to a screen reader, and the class drops the
              button's lift while Axel is up. The word hides below the sm
              breakpoint the way the reference's does. */}
          <button
            type="button"
            onClick={props.onAxel}
            aria-pressed={props.axelOpen}
            aria-label="Axel"
            title="Axel"
            className="aix-assistant-cta"
            data-testid="axel-cta"
          >
            <SparkleIcon size={ICON.glyph} strokeWidth={2} className="shrink-0" />
            <span className="hidden sm:inline">Axel</span>
          </button>

          {/* The reference also carries a green presence dot on the disc. It is
              still not drawn: XMS has no presence, and a status mark that is
              always the same colour tells the reader something untrue. */}
          <button type="button" aria-label="Account menu" onClick={props.onUser} className="aix-avatar">
            <span className="aix-avatar-disc">{props.userInitials}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
