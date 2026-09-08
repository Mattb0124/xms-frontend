"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FinderKind } from "@/components/shell/finder-bar";
import { ICON, CloseIcon, PinIcon, SearchIcon } from "@/components/xms/icons";
import { SECTIONS, isDynamicPath, navigableHref, type Screen } from "@/lib/routes";
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
  const label = (
    <>
      <span className="font-medium">{screen.label}</span>
      {screen.purpose ? <span className="ml-2 text-[12px] text-white/50">{screen.purpose}</span> : null}
    </>
  );
  if (!href) {
    return (
      <span className="flex-1 text-[13px] text-white/70" data-screen={screen.screen} data-navigable="false">
        {label}
        <span className="ml-2 text-[11px] text-white/40">opens from a record</span>
      </span>
    );
  }
  return (
    <Link
      href={href}
      onClick={onClose}
      data-screen={screen.screen}
      className="flex-1 text-[13px] text-white hover:no-underline"
    >
      {label}
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

  const title = props.kind === "all" ? "All screens" : props.kind === "favourites" ? "Favourites" : "History";

  return (
    <div className="fixed inset-0 z-40" style={{ top: "var(--xms-finder-bar-h)" }}>
      <button
        type="button"
        aria-label="Close finder"
        onClick={props.onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div
        role="dialog"
        aria-label={title}
        className="bg-xms-navy-overlay absolute top-0 left-[208px] flex max-h-[76vh] w-[640px] flex-col rounded-b-[6px] text-white shadow-2xl"
      >
        <header className="border-xms-navy-line flex items-center gap-3 border-b px-4 py-3">
          <span className="text-[15px] font-semibold">{title}</span>
          {props.kind === "all" ? (
            <span className="border-xms-navy-line bg-xms-navy ml-auto flex h-8 w-[240px] items-center gap-2 rounded-[4px] border px-2">
              <SearchIcon size={ICON.control} className="shrink-0 text-white/50" />
              <input
                ref={input}
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Filter screens"
                aria-label="Filter screens"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/45"
              />
            </span>
          ) : null}
          <button
            type="button"
            onClick={props.onClose}
            className="ml-2 text-white/60 hover:text-white"
            aria-label="Close"
          >
            <CloseIcon size={ICON.field} />
          </button>
        </header>
        <div className="overflow-auto p-4">
          {props.kind === "all" ? (
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              {grouped.map((group) => (
                <section key={group.section}>
                  <p className="xms-caption mb-1 text-white/60">{group.section}</p>
                  <ul className="flex flex-col">
                    {group.screens.map((screen) => (
                      <li
                        key={screen.path}
                        className="hover:bg-xms-navy-overlay flex items-center gap-2 rounded-[4px] px-2 py-1"
                      >
                        <button
                          type="button"
                          aria-label={props.pinned.has(screen.path) ? `Unpin ${screen.label}` : `Pin ${screen.label}`}
                          aria-pressed={props.pinned.has(screen.path)}
                          onClick={() => props.onTogglePin(screen.path)}
                          className={cn(
                            "shrink-0",
                            props.pinned.has(screen.path) ? "text-white" : "text-white/35 hover:text-white",
                          )}
                        >
                          <PinIcon size={ICON.action} filled={props.pinned.has(screen.path)} />
                        </button>
                        <ScreenRow screen={screen} screens={props.screens} onClose={props.onClose} />
                        {typeof props.counts?.[screen.screen] === "number" ? (
                          <span className="xms-mono shrink-0 rounded-[999px] bg-white/12 px-[7px] py-[1px] text-[11px] text-white/80">
                            {props.counts[screen.screen]}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {grouped.length === 0 ? <p className="text-[13px] text-white/60">No screens match.</p> : null}
            </div>
          ) : props.kind === "favourites" ? (
            <ul className="flex flex-col gap-1">
              {favourites.map((item) => (
                <li
                  key={item.path}
                  className="hover:bg-xms-navy-overlay flex items-center gap-3 rounded-[4px] px-2 py-1"
                >
                  <Link href={item.path} onClick={props.onClose} className="text-[13px] text-white hover:no-underline">
                    {item.label}
                  </Link>
                  <span className="xms-caption ml-auto text-white/50">{item.type}</span>
                </li>
              ))}
              {favourites.length === 0 ? (
                <li className="text-[13px] text-white/60">Star a view from the workspace pill to see it here.</li>
              ) : null}
            </ul>
          ) : (
            <ul className="flex flex-col gap-1">
              {history.map((entry) => (
                <li
                  key={entry.path + entry.at}
                  className="hover:bg-xms-navy-overlay flex items-center gap-3 rounded-[4px] px-2 py-1"
                >
                  <Link href={entry.path} onClick={props.onClose} className="text-[13px] text-white hover:no-underline">
                    {entry.label}
                  </Link>
                  <span className="xms-mono ml-auto text-[11px] text-white/50">{relative(entry.at)}</span>
                </li>
              ))}
              {history.length === 0 ? <li className="text-[13px] text-white/60">Nothing visited yet.</li> : null}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
