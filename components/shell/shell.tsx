"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { CommandPalette } from "@/components/shell/command-palette";
import { ContentHeaderBar } from "@/components/shell/content-header-bar";
import { FinderBar, type FinderKind } from "@/components/shell/finder-bar";
import { FinderOverlay, type HistoryEntry } from "@/components/shell/finder-overlay";
import { AxelPanel } from "@/components/shell/axel-panel";
import { NotificationsMenu } from "@/components/shell/notifications-menu";
import { PinnedSidebar, sidebarItems } from "@/components/shell/pinned-sidebar";
import { initials } from "@/components/xms/actor-chip";
import { HISTORY_KEY, PINS_KEY, STARS_KEY, usePersistedList, useToggleInList } from "@/lib/persisted-set";
import { isDynamicPath, matchScreen, visibleScreens } from "@/lib/routes";
import { NARROW_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { useListQuarantineQuery } from "@/redux/emailApi";
import { useMe } from "@/redux/me";
import { useListTicketsQuery, useUnreadCountQuery } from "@/redux/ticketsApi";

function parseHistory(raw: string): HistoryEntry | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const entry = parsed as Partial<HistoryEntry>;
    return typeof entry.path === "string" && typeof entry.label === "string" && typeof entry.at === "string"
      ? { path: entry.path, label: entry.label, at: entry.at }
      : null;
  } catch {
    return null;
  }
}

/**
 * The internal application shell: navy finder bar, finder overlay, pinned
 * sidebar, content header bar, command palette. Everything is filtered by
 * the loaded permission set and fails closed while `me` is loading.
 */
export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const me = useMe();
  const current = matchScreen(pathname);
  const screens = useMemo(() => visibleScreens(me.permissions), [me.permissions]);

  const [finder, setFinder] = useState<FinderKind | null>(null);
  const [palette, setPalette] = useState(false);
  // The sidebar follows the viewport until the reader says otherwise: open on a
  // desk-width window, closed below the md breakpoint where 238px would leave
  // about 150px of content (frontend review finding 8). The content header
  // bar's control then opens it over the content.
  const narrow = useMediaQuery(NARROW_QUERY);
  const [sidebarChoice, setSidebarChoice] = useState<boolean | null>(null);
  const sidebarOpen = sidebarChoice ?? !narrow;
  const [notifications, setNotifications] = useState(false);
  const { data: unread } = useUnreadCountQuery(undefined, { pollingInterval: 60_000, skip: !me.principal });
  // The record bar's Ask Axel opens the shell panel through the address, so
  // the link is a link and a pasted one opens the panel too (render 15).
  const axelParam = useSearchParams().get("axel") === "1";
  const [axelChoice, setAxelChoice] = useState<boolean | null>(null);
  const axel = axelChoice ?? axelParam;
  const setAxel = (next: boolean | ((open: boolean) => boolean)) =>
    setAxelChoice(typeof next === "function" ? next(axel) : next);

  // The sidebar's counts come from the routes the screens themselves read,
  // asked for one row each so a badge costs a count and not a page: the ticket
  // list answers open and unassigned in its `stats` block, and the held-email
  // list answers the Quarantine badge. Each is gated on the permission its
  // screen needs, so no badge takes a 403 for a screen the reader cannot open.
  const canSeeTickets = me.hasPermission("tickets:view");
  const canWorkTickets = me.hasPermission("tickets:work");
  const { data: queueStats } = useListTicketsQuery(
    { open: true, limit: 1 },
    { pollingInterval: 60_000, skip: !canSeeTickets },
  );
  const { data: quarantine } = useListQuarantineQuery(
    { state: "open" },
    { pollingInterval: 60_000, skip: !canWorkTickets },
  );
  const counts = useMemo(
    () => ({
      cases: queueStats?.stats.open,
      dispatch: queueStats?.stats.unassigned,
      quarantine: quarantine?.length,
    }),
    [queueStats, quarantine],
  );

  const [pins, togglePin] = useToggleInList(PINS_KEY);
  const [stars, toggleStar, hasStar] = useToggleInList(STARS_KEY);
  const [historyRaw, setHistory] = usePersistedList(HISTORY_KEY, 30);

  const currentHref = typeof window === "undefined" ? pathname : `${pathname}${window.location.search}`;
  // The pill names the workspace, not just the screen: on the Cases list it
  // reads "Cases View: Workspace" as the design states it.
  const workspaceLabel = current ? (current.screen === "cases" ? "Cases View: Workspace" : current.label) : "XMS";

  // History: one entry per visited screen, newest first (Wireframes v2 section 2).
  useEffect(() => {
    if (!current) return;
    const entry: HistoryEntry = { path: currentHref, label: current.label, at: new Date().toISOString() };
    const rest = historyRaw.filter((raw) => parseHistory(raw)?.path !== currentHref);
    setHistory([JSON.stringify(entry), ...rest]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentHref]);

  const history = useMemo<HistoryEntry[]>(
    () => historyRaw.map(parseHistory).filter((entry): entry is HistoryEntry => entry !== null),
    [historyRaw],
  );
  const favourites = useMemo(
    () =>
      stars.map((path) => ({
        path,
        label: matchScreen(path.split("?")[0])?.label ?? path,
        // Render 13 words the meta in lower case: "saved view", "screen".
        type: path.includes("?") ? "saved view" : "screen",
      })),
    [stars],
  );

  const onKey = useCallback(
    (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPalette((open) => !open);
        setFinder(null);
        return;
      }
      if (event.key === "Escape") {
        setFinder(null);
        setPalette(false);
        setNotifications(false);
        return;
      }
      if (typing) return;
      if (event.key === "/") {
        event.preventDefault();
        setFinder("all");
      }
      if (event.key === "c" && !event.ctrlKey && !event.metaKey && me.hasPermission("tickets:create")) {
        router.push("/tickets/new");
      }
    },
    [me, router],
  );
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  return (
    <div className="flex min-h-full flex-col">
      <FinderBar
        activeFinder={finder}
        onFinder={(kind) => setFinder((open) => (open === kind ? null : kind))}
        workspaceLabel={workspaceLabel}
        starred={hasStar(currentHref)}
        onToggleStar={() => toggleStar(currentHref)}
        onWorkspace={() => setFinder((open) => (open === "favourites" ? null : "favourites"))}
        workspaceOpen={finder === "favourites"}
        onSearchFocus={() => setFinder("all")}
        unreadCount={unread?.count ?? 0}
        onNotifications={() => setNotifications((open) => !open)}
        userInitials={me.principal?.displayName ? initials(me.principal.displayName) : "?"}
        onUser={() => {}}
      />
      {notifications ? (
        <div className="relative">
          <NotificationsMenu onClose={() => setNotifications(false)} />
        </div>
      ) : null}
      <div className="flex flex-1">
        {sidebarOpen ? (
          <PinnedSidebar
            permissions={me.permissions}
            extraPins={new Set(pins)}
            counts={counts}
            starredViews={favourites
              .filter((f) => f.type === "Saved view")
              .map((f) => ({ path: f.path, label: f.label }))}
            currentPath={pathname}
            onBrowseAll={() => setFinder("all")}
            onEditPins={() => setFinder("all")}
          />
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col">
          <ContentHeaderBar current={current} screens={screens} onToggleSidebar={() => setSidebarChoice(!sidebarOpen)}>
            {/* The work area, and the reason the canvas is grey: the vendored
                token file paints the body white, and every screen was drawn on
                white with white cards on it, so nothing had an edge.

                Every page is full width. The hand-off carries a 1200px
                content max; the reviewer took it off, so the work area runs
                from the sidebar edge to the window edge inside the 20px
                gutter and no screen shell carries a max width at all.
                Reading width is capped on the control (see `INPUT`), never on
                the page. `components/xms/surfaces.test.tsx` fails if a page
                shell brings one back. */}
            <main className="bg-xms-bg flex flex-1 flex-col overflow-auto px-5 pt-[18px] pb-10">{children}</main>
          </ContentHeaderBar>
        </div>
        {/* The panel pushes the content, it does not overlay it (Wireframes v2
            section 2), so it is a sibling column rather than a portal. */}
        {axel ? (
          <AxelPanel context={current?.path.includes("[") ? "ticket" : "desk"} onClose={() => setAxel(false)} />
        ) : null}
      </div>
      {finder ? (
        <FinderOverlay
          kind={finder}
          screens={screens}
          // Exactly what the sidebar is showing this reader, so the pin
          // glyph in the overlay and the row in the sidebar always agree.
          // It used to be every ranked screen, which since the ranks run past
          // the sixth would have drawn a pin on rows the sidebar does not
          // carry.
          pinned={new Set(sidebarItems(me.permissions, new Set(pins)).map((screen) => screen.path))}
          // A dynamic path is a pattern, not an address, so it can never be
          // an address the sidebar links; the pin is refused rather than
          // stored and filtered out again on the way back.
          onTogglePin={(path: string) => {
            if (!isDynamicPath(path)) togglePin(path);
          }}
          favourites={favourites}
          counts={counts}
          history={history}
          onClose={() => setFinder(null)}
        />
      ) : null}
      {palette ? <CommandPalette screens={screens} onClose={() => setPalette(false)} /> : null}
    </div>
  );
}
