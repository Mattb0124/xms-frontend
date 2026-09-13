"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ContentHeaderBar } from "@/components/shell/content-header-bar";
import { Finder, type FinderRecent } from "@/components/shell/finder";
import { FinderBar } from "@/components/shell/finder-bar";
import { AxelChat } from "@/components/axel/axel-chat";
import { AxelPanel } from "@/components/shell/axel-panel";
import { NotificationsMenu } from "@/components/shell/notifications-menu";
import { PinnedSidebar, sidebarItems } from "@/components/shell/pinned-sidebar";
import { initials } from "@/components/xms/actor-chip";
import { HISTORY_KEY, PINS_KEY, usePersistedList, useToggleInList } from "@/lib/persisted-set";
import { isDynamicPath, matchScreen, visibleScreens } from "@/lib/routes";
import { NARROW_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { useListQuarantineQuery } from "@/redux/emailApi";
import { useMe } from "@/redux/me";
import { useGetTicketQuery, useListTicketsQuery, useUnreadCountQuery } from "@/redux/ticketsApi";

function parseHistory(raw: string): FinderRecent | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const entry = parsed as Partial<FinderRecent>;
    return typeof entry.path === "string" && typeof entry.label === "string" && typeof entry.at === "string"
      ? { path: entry.path, label: entry.label, at: entry.at, ...(entry.code ? { code: entry.code } : {}) }
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
  // The finder bar's Axel button opens the full-screen surface (AIBL-321),
  // which is a different thing from the docked panel above it: the panel is
  // the rail beside a record, this is the conversation. Both can be reached,
  // neither is the other's state.
  const [axelChat, setAxelChat] = useState(false);

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
  // Axel turns run against a ticket, so the full-screen surface takes the one
  // the reader is looking at. The record page has already asked for the same
  // ticket by the same key, so in practice this reads RTK Query's cache rather
  // than making a second request, and it asks for nothing at all on a screen
  // that is not a record.
  const ticketKey = current?.screen === "ticket" ? decodeURIComponent(pathname.split("/")[2] ?? "").toUpperCase() : "";
  const { data: axelTicket } = useGetTicketQuery(ticketKey, { skip: !ticketKey || !canSeeTickets });
  const counts = useMemo(
    () => ({
      cases: queueStats?.stats.open,
      dispatch: queueStats?.stats.unassigned,
      quarantine: quarantine?.length,
    }),
    [queueStats, quarantine],
  );

  const [pins, togglePin] = useToggleInList(PINS_KEY);
  const [historyRaw, setHistory] = usePersistedList(HISTORY_KEY, 30);

  const currentHref = typeof window === "undefined" ? pathname : `${pathname}${window.location.search}`;

  // Recents: one entry per RECORD opened, newest first.
  //
  // It used to write `current.label`, which is the route registry's name for
  // the screen, so every ticket visited was filed as "Ticket" and a list of ten
  // read "Ticket" ten times (AIBL-329). A record names itself: the ticket the
  // shell has already fetched for Axel gives its key and its description, and
  // nothing extra is asked for to get them.
  useEffect(() => {
    if (!current) return;
    const label =
      axelTicket && current.screen === "ticket" ? `${axelTicket.key}  ${axelTicket.short_description}` : current.label;
    const entry: FinderRecent = { path: currentHref, label, at: new Date().toISOString() };
    const rest = historyRaw.filter((raw) => parseHistory(raw)?.path !== currentHref);
    setHistory([JSON.stringify(entry), ...rest]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentHref, axelTicket?.key]);

  const history = useMemo<FinderRecent[]>(
    () => historyRaw.map(parseHistory).filter((entry): entry is FinderRecent => entry !== null),
    [historyRaw],
  );

  // Ctrl+K and `/` belong to the finder, which binds them itself: it is the
  // thing that has to take focus, and a shortcut that lives away from the
  // control it drives goes stale the moment either moves.
  const onKey = useCallback(
    (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (event.key === "Escape") {
        setNotifications(false);
        return;
      }
      if (typing) return;
      if (event.key === "c" && !event.ctrlKey && !event.metaKey && me.hasPermission("tickets:create")) {
        router.push("/cases/new");
      }
    },
    [me, router],
  );
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <FinderBar
        finder={
          <Finder
            screens={screens}
            recents={history}
            pinned={new Set(sidebarItems(me.permissions, new Set(pins)).map((screen) => screen.path))}
            // A dynamic path is a pattern, not an address, so it can never be
            // one the sidebar links; the pin is refused rather than stored and
            // filtered out again on the way back.
            onTogglePin={(path: string) => {
              if (!isDynamicPath(path)) togglePin(path);
            }}
            canSeeTickets={canSeeTickets}
            canSeeKnowledge={me.hasPermission("knowledge:view")}
          />
        }
        onAxel={() => setAxelChat((open) => !open)}
        axelOpen={axelChat}
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
      <div className="flex min-h-0 flex-1">
        {sidebarOpen ? (
          <PinnedSidebar
            permissions={me.permissions}
            extraPins={new Set(pins)}
            counts={counts}
            // Empty since the star came off the scope pill (AIBL-321), and
            // empty before that too: this filtered on "Saved view" where the
            // favourites list wrote "saved view", so the section never drew a
            // row in its life. The prop stays so the saved views the server
            // holds (/v1/views) have somewhere to arrive.
            starredViews={[]}
            currentPath={pathname}
          />
        ) : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
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
      {/* Everything below the finder bar, which stays live above it: the
          reader can move to another screen without closing Axel first, which
          is the behaviour the AIX chat has. */}
      {axelChat ? (
        <AxelChat ticketId={axelTicket?.id ?? null} ticketKey={axelTicket?.key} onClose={() => setAxelChat(false)} />
      ) : null}
    </div>
  );
}
