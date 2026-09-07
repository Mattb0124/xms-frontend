"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FinderKind } from "@/components/shell/finder-bar";
import { SECTIONS, type Screen } from "@/lib/routes";
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

  const title =
    props.kind === "all"
      ? `All screens · ${props.screens.length}`
      : props.kind === "favourites"
        ? "Favourites"
        : "History";

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
        className="bg-xms-navy absolute top-0 left-0 flex max-h-[80vh] w-[720px] flex-col rounded-br-[6px] text-white shadow-2xl"
      >
        <header className="border-xms-navy-line flex items-center gap-3 border-b px-4 py-3">
          <span className="text-[13px] font-semibold">{title}</span>
          {props.kind === "all" ? (
            <input
              ref={input}
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter screens"
              aria-label="Filter screens"
              className="border-xms-navy-line bg-xms-navy-overlay ml-auto h-8 w-[240px] rounded-[4px] border px-2 text-[12px] text-white"
            />
          ) : null}
          <button
            type="button"
            onClick={props.onClose}
            className="ml-2 text-white/60 hover:text-white"
            aria-label="Close"
          >
            ×
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
                        <Link
                          href={screen.path.replace("[key]", "")}
                          onClick={props.onClose}
                          className="flex-1 text-[13px] text-white hover:no-underline"
                        >
                          <span className="font-medium">{screen.label}</span>
                          {screen.purpose ? (
                            <span className="ml-2 text-[12px] text-white/50">{screen.purpose}</span>
                          ) : null}
                        </Link>
                        <button
                          type="button"
                          aria-label={props.pinned.has(screen.path) ? `Unpin ${screen.label}` : `Pin ${screen.label}`}
                          aria-pressed={props.pinned.has(screen.path)}
                          onClick={() => props.onTogglePin(screen.path)}
                          className={cn(
                            "text-[12px]",
                            props.pinned.has(screen.path) ? "text-xms-sla-warn" : "text-white/40 hover:text-white",
                          )}
                        >
                          📌
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {grouped.length === 0 ? <p className="text-[13px] text-white/60">No screens match.</p> : null}
            </div>
          ) : props.kind === "favourites" ? (
            <ul className="flex flex-col gap-1">
              {props.favourites.map((item) => (
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
              {props.favourites.length === 0 ? (
                <li className="text-[13px] text-white/60">Star a view from the workspace pill to see it here.</li>
              ) : null}
            </ul>
          ) : (
            <ul className="flex flex-col gap-1">
              {props.history.map((entry) => (
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
              {props.history.length === 0 ? <li className="text-[13px] text-white/60">Nothing visited yet.</li> : null}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
