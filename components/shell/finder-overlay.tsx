"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FinderKind } from "@/components/shell/finder-bar";
import {
  ICON,
  CircleIcon,
  ClockIcon,
  CloseIcon,
  InboxIcon,
  PinIcon,
  SearchIcon,
  screenIcon,
} from "@/components/xms/icons";
import { QUEUE_VIEWS } from "@/lib/tickets/queue-views";
import { SECTIONS, isDynamicPath, matchScreen, navigableHref, type Screen } from "@/lib/routes";
import { cn } from "@/lib/utils";

export interface HistoryEntry {
  path: string;
  label: string;
  at: string;
}

export interface FinderOverlayProps {
  kind: FinderKind;
  /** Already permission-filtered; the overlay never sees a screen the user may not open. */
  screens: Screen[];
  pinned: ReadonlySet<string>;
  onTogglePin: (path: string) => void;
  favourites: Array<{ path: string; label: string; type: string }>;
  /** Live counts by screen id, the badges the All overlay carries (render 12). */
  counts?: Record<string, number | undefined>;
  history: HistoryEntry[];
  onClose: () => void;
}

function relative(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/**
 * One row in the All overlay. A screen with a dynamic segment has no address
 * of its own, so it links to its list parent when there is one the viewer may
 * open and is otherwise rendered as plain text. Nothing here ever builds an
 * href from a path pattern (frontend review finding 1).
 */
function ScreenRow({ screen, screens, onClose }: { screen: Screen; screens: Screen[]; onClose: () => void }) {
  const href = navigableHref(screen, screens);
  // The purpose stays on the row as its title, never beside the label: the
  // render draws one line per screen and the sentence wrapped every row onto
  // two and three of them.
  const title = screen.purpose;
  if (!href) {
    return (
      <span
        className="min-w-0 flex-1 truncate text-white/70"
        data-screen={screen.screen}
        data-navigable="false"
        title={title ? `${title} Opens from a record.` : "Opens from a record."}
      >
        {screen.label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      onClick={onClose}
      data-screen={screen.screen}
      title={title}
      className="min-w-0 flex-1 truncate text-white hover:no-underline"
    >
      {screen.label}
    </Link>
  );
}

/** One overlay, three data sources (Wireframes v2 section 2). Navy panel under the finder bar. */
export function FinderOverlay(props: FinderOverlayProps) {
  const [filter, setFilter] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, [props.kind]);

  const grouped = useMemo(() => {
    const term = filter.trim().toLowerCase();
    const matching = props.screens.filter(
      (s) => !term || s.label.toLowerCase().includes(term) || s.purpose?.toLowerCase().includes(term),
    );
    return SECTIONS.map((section) => ({ section, screens: matching.filter((s) => s.section === section) })).filter(
      (group) => group.screens.length > 0,
    );
  }, [props.screens, filter]);

  // A stored pin or visit can only ever be a concrete path; a pattern here
  // would reach a Link and crash the router, so it is dropped rather than shown.
  const favourites = useMemo(() => props.favourites.filter((item) => !isDynamicPath(item.path)), [props.favourites]);
  const history = useMemo(() => props.history.filter((entry) => !isDynamicPath(entry.path)), [props.history]);

  const title =
    props.kind === "all"
      ? "All screens"
      : props.kind === "favourites"
        ? "Favourites"
        : props.kind === "workspaces"
          ? "Workspaces"
          : "History";

  return (
    <div className="fixed inset-0 z-40" style={{ top: "var(--xms-finder-bar-h)" }}>
      <button
        type="button"
        aria-label="Close finder"
        onClick={props.onClose}
        className="bg-xms-overlay-scrim absolute inset-0"
      />
      {/* The panel hangs from the bar at the prototype's own left 186 and 640
          by 520, translucent over the dimmed workspace rather than opaque. */}
      <div
        role="dialog"
        aria-label={title}
        className="xms-overlay absolute top-0 left-[186px] flex flex-col backdrop-blur-[14px]"
      >
        <header className="xms-overlay-head flex shrink-0 items-center gap-[10px]">
          <span className="text-[15px] leading-none font-semibold">{title}</span>
          <span className="flex-1" />
          {props.kind === "all" ? (
            <span className="xms-overlay-field flex items-center gap-2">
              <SearchIcon size={ICON.action} className="shrink-0" />
              <input
                ref={input}
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Filter screens"
                aria-label="Filter screens"
                className="min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/70"
              />
            </span>
          ) : null}
          <button type="button" onClick={props.onClose} aria-label="Close">
            <CloseIcon size={ICON.tool} />
          </button>
        </header>
        {/* One scrolling column: each section is full width with its screens
            in two columns under it, which is how the render reads a tree of
            eight sections down 520px rather than eight columns across. */}
        <div className="flex-1 overflow-auto pt-[10px] pb-4">
          {props.kind === "all" ? (
            <>
              {grouped.map((group) => (
                <section key={group.section}>
                  <p className="xms-overlay-caption">{group.section}</p>
                  <ul className="grid grid-cols-2">
                    {group.screens.map((screen) => {
                      const isPinned = props.pinned.has(screen.path);
                      return (
                        <li key={screen.path} className="xms-overlay-row">
                          <button
                            type="button"
                            aria-label={isPinned ? `Unpin ${screen.label}` : `Pin ${screen.label}`}
                            aria-pressed={isPinned}
                            onClick={() => props.onTogglePin(screen.path)}
                            className={cn("shrink-0", isPinned ? "text-white" : "text-white/45 hover:text-white")}
                          >
                            {isPinned ? <PinIcon size={ICON.action} /> : <CircleIcon size={ICON.action} />}
                          </button>
                          <ScreenRow screen={screen} screens={props.screens} onClose={props.onClose} />
                          {typeof props.counts?.[screen.screen] === "number" ? (
                            <span className="xms-overlay-badge">{props.counts[screen.screen]}</span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
              {grouped.length === 0 ? <p className="px-4 py-2 text-[14px] text-white/70">No screens match.</p> : null}
            </>
          ) : props.kind === "workspaces" ? (
            <ul>
              {QUEUE_VIEWS.map((view) => (
                <li key={view.key} className="xms-overlay-row is-listed">
                  <InboxIcon size={ICON.field} className="shrink-0" />
                  <Link
                    href={`/cases?view=${view.key}`}
                    onClick={props.onClose}
                    className="min-w-0 flex-1 truncate text-white hover:no-underline"
                  >
                    {view.label}
                  </Link>
                  <span className="shrink-0 text-[14px]">System</span>
                </li>
              ))}
            </ul>
          ) : props.kind === "favourites" ? (
            <ul>
              {favourites.map((item) => {
                // The target's own mark, so a row reads the same here as it
                // does in the sidebar (render 13).
                const Glyph = screenIcon(matchScreen(item.path.split("?")[0])?.screen);
                return (
                  <li key={item.path} className="xms-overlay-row is-listed">
                    <Glyph size={ICON.field} className="shrink-0" />
                    <Link
                      href={item.path}
                      onClick={props.onClose}
                      className="min-w-0 flex-1 truncate text-white hover:no-underline"
                    >
                      {item.label}
                    </Link>
                    <span className="shrink-0 text-[14px]">{item.type}</span>
                  </li>
                );
              })}
              {favourites.length === 0 ? (
                <li className="px-4 py-2 text-[14px] text-white/70">
                  Star a view from the workspace pill to see it here.
                </li>
              ) : null}
            </ul>
          ) : (
            <ul>
              {history.map((entry) => (
                <li key={entry.path + entry.at} className="xms-overlay-row is-listed">
                  <ClockIcon size={ICON.field} className="shrink-0" />
                  <Link
                    href={entry.path}
                    onClick={props.onClose}
                    className="min-w-0 flex-1 truncate text-white hover:no-underline"
                  >
                    {entry.label}
                  </Link>
                  <span className="shrink-0 text-[14px]">{relative(entry.at)}</span>
                </li>
              ))}
              {history.length === 0 ? (
                <li className="px-4 py-2 text-[14px] text-white/70">Nothing visited yet.</li>
              ) : null}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
