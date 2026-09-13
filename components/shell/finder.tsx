"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ICON, ClockIcon, InboxIcon, PinIcon, SearchIcon, screenIcon } from "@/components/xms/icons";
import { navigableHref, type Screen } from "@/lib/routes";
import { useSearchSolutionsQuery } from "@/redux/knowledgeApi";
import { useListTicketsQuery } from "@/redux/ticketsApi";
import { cn } from "@/lib/utils";

/** A ticket key typed on its own is an address, not a search term. */
const TICKET_KEY = /^(cs|chg|req|inc|prb)\d{4,9}$/i;

/** Below this the API is not asked: two characters match most of the table. */
const MIN_QUERY = 2;

export interface FinderRecent {
  path: string;
  label: string;
  /** A record's own key, shown in mono the way the ticket rows are. */
  code?: string;
  at: string;
}

export interface FinderProps {
  /** Already permission-filtered; the finder never sees a screen this reader may not open. */
  screens: Screen[];
  /** The records this reader opened lately, newest first. */
  recents: FinderRecent[];
  /** Which screens the sidebar is already carrying, so the pin reads true. */
  pinned: ReadonlySet<string>;
  onTogglePin: (path: string) => void;
  canSeeTickets: boolean;
  canSeeKnowledge: boolean;
}

interface Row {
  id: string;
  group: string;
  label: string;
  /** The mono key down the left: a ticket's CS number, an article's KB. */
  code?: string;
  meta?: string;
  icon: "screen" | "ticket" | "solution" | "recent";
  screen?: Screen;
  href: string;
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
 * The one way in (AIBL-329).
 *
 * It replaces four controls that came across from ServiceNow's navigator: All,
 * which was a third route to a screen behind the sidebar and the palette;
 * Favourites, which nothing could create once the scope pill went; History,
 * which listed screens and so read "Ticket" once per ticket; and Workspaces,
 * which was the Queue's own view list under a name that means something else.
 * The command palette goes with them, because a second box that searched less
 * is not worth the key it was bound to.
 *
 * What it does instead is the thing none of them did: find a RECORD. A key goes
 * straight to the ticket. Free text asks the two routes that already exist for
 * it, and each is skipped for a reader who may not call it, so the finder never
 * takes a 403 to draw a list.
 */
export function Finder({ screens, recents, pinned, onTogglePin, canSeeTickets, canSeeKnowledge }: FinderProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);

  const term = query.trim();
  const key = TICKET_KEY.test(term) ? term.toUpperCase() : null;
  // A key is an address, so the search behind it is not worth running.
  const searching = !key && term.length >= MIN_QUERY;

  const { data: tickets } = useListTicketsQuery({ q: term, limit: 6 }, { skip: !searching || !canSeeTickets || !open });
  const { data: solutions } = useSearchSolutionsQuery(
    { q: term, limit: 5 },
    { skip: !searching || !canSeeKnowledge || !open },
  );

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    if (key) {
      out.push({ id: `key:${key}`, group: "Go to", label: key, icon: "ticket", href: `/cases/${key}` });
    }
    if (!term) {
      for (const recent of recents.slice(0, 6)) {
        out.push({
          id: `recent:${recent.path}`,
          group: "Recent",
          label: recent.label,
          code: recent.code,
          meta: relative(recent.at),
          icon: "recent",
          href: recent.path,
        });
      }
    }
    for (const ticket of tickets?.items ?? []) {
      out.push({
        id: `ticket:${ticket.key}`,
        group: "Tickets",
        label: ticket.short_description,
        code: ticket.key,
        meta: ticket.state_label,
        icon: "ticket",
        href: `/cases/${ticket.key}`,
      });
    }
    for (const hit of solutions ?? []) {
      out.push({
        id: `solution:${hit.display_key}`,
        group: "Solutions",
        label: hit.title,
        code: hit.display_key,
        icon: "solution",
        href: `/knowledge/${hit.display_key}`,
      });
    }
    const lower = term.toLowerCase();
    for (const screen of screens) {
      if (term && !screen.label.toLowerCase().includes(lower)) continue;
      const href = navigableHref(screen, screens);
      // A screen with a dynamic segment has no address of its own, so it is
      // never offered as one (frontend review finding 1).
      if (!href) continue;
      out.push({
        id: `screen:${screen.path}`,
        group: "Screens",
        label: screen.label,
        meta: screen.section,
        icon: "screen",
        screen,
        href,
      });
    }
    return out;
  }, [key, term, recents, tickets, solutions, screens]);

  // Ctrl+K and `/` both land here now that there is one box to land in.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      const wants =
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") || (event.key === "/" && !typing);
      if (!wants) return;
      event.preventDefault();
      setOpen(true);
      input.current?.focus();
      input.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // A click anywhere else puts it away. Pointer-down rather than click, so a
  // press that starts outside does not first run the row it lands on.
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", away);
    return () => window.removeEventListener("pointerdown", away);
  }, [open]);

  const go = useCallback(
    (row: Row) => {
      setOpen(false);
      setQuery("");
      input.current?.blur();
      router.push(row.href);
    },
    [router],
  );

  const grouped = useMemo(() => {
    const order: string[] = [];
    const byGroup = new Map<string, Row[]>();
    rows.forEach((row) => {
      if (!byGroup.has(row.group)) {
        byGroup.set(row.group, []);
        order.push(row.group);
      }
      byGroup.get(row.group)!.push(row);
    });
    return order.map((group) => ({ group, rows: byGroup.get(group)! }));
  }, [rows]);

  return (
    <div ref={box} className="relative">
      <div className="aix-finder">
        <SearchIcon size={ICON.action} className="shrink-0 text-white/70" />
        <input
          ref={input}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            // The highlight goes back to the top with the results. Done here
            // rather than in an effect on the term: setting state inside one
            // costs a second render of the whole list for no reason.
            setIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setIndex((i) => Math.min(rows.length - 1, i + 1));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setIndex((i) => Math.max(0, i - 1));
            }
            if (event.key === "Enter" && rows[index]) go(rows[index]);
            if (event.key === "Escape") {
              setOpen(false);
              input.current?.blur();
            }
          }}
          placeholder="Search tickets, solutions and screens"
          aria-label="Search"
          aria-expanded={open}
          aria-keyshortcuts="Control+K /"
          role="combobox"
          aria-controls="finder-results"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/50"
        />
        <kbd className="aix-finder-key">Ctrl K</kbd>
      </div>

      {open ? (
        <div id="finder-results" role="listbox" aria-label="Results" className="xms-card xms-finder-panel">
          {grouped.map(({ group, rows: groupRows }) => (
            <div key={group}>
              <p className="xms-caption text-xms-label px-3 pt-3 pb-1">{group}</p>
              <ul>
                {groupRows.map((row) => {
                  const position = rows.indexOf(row);
                  const Icon =
                    row.icon === "screen" && row.screen
                      ? screenIcon(row.screen.screen)
                      : row.icon === "solution"
                        ? InboxIcon
                        : row.icon === "recent"
                          ? ClockIcon
                          : InboxIcon;
                  return (
                    <li key={row.id} role="option" aria-selected={position === index}>
                      <div
                        className={cn(
                          "flex items-center gap-[10px] px-3 py-[7px]",
                          position === index ? "bg-xms-tint" : "",
                        )}
                      >
                        <button
                          type="button"
                          onMouseEnter={() => setIndex(position)}
                          onClick={() => go(row)}
                          className="xms-plain flex min-w-0 flex-1 items-center gap-[10px] text-left"
                        >
                          <Icon size={ICON.action} className="text-xms-label shrink-0" />
                          {row.code ? (
                            <span className="xms-mono text-xms-label shrink-0 text-[14px]">{row.code}</span>
                          ) : null}
                          <span className="text-xms-ink min-w-0 flex-1 truncate text-[14px]">{row.label}</span>
                          {row.meta ? <span className="text-xms-muted shrink-0 text-[14px]">{row.meta}</span> : null}
                        </button>
                        {/* The pin the All overlay used to carry. It is the only
                            way to add a row to the sidebar, so it moved here
                            rather than being dropped with the overlay. */}
                        {row.screen ? (
                          <button
                            type="button"
                            aria-label={pinned.has(row.screen.path) ? `Unpin ${row.label}` : `Pin ${row.label}`}
                            aria-pressed={pinned.has(row.screen.path)}
                            onClick={() => onTogglePin(row.screen!.path)}
                            className="text-xms-label hover:text-xms-ink shrink-0"
                          >
                            <PinIcon size={ICON.glyph} filled={pinned.has(row.screen.path)} />
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {rows.length === 0 ? (
            <p className="text-xms-label px-3 py-4 text-[14px]">
              {searching ? "Nothing matches." : "Type a ticket key, a word, or a screen name."}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
