/**
 * What My work's one list holds, in what order, and what each scorecard does
 * to it (render 08 and its own note 1).
 *
 * The rules live here rather than in the screen so they can be asserted
 * without a browser: the screen asks the API for its two lists and renders
 * what these functions return.
 */
import { tighterClock } from "@/lib/tickets/sla";
import type { TicketView } from "@/redux/ticketsApi";

/** True where the ticket's tighter clock has breached. */
export function isBreached(ticket: TicketView): boolean {
  return Boolean(ticket.sla.response?.breached || ticket.sla.resolution?.breached);
}

/** True where the tighter clock is running with under a quarter of its window left. */
export function isAtRisk(ticket: TicketView): boolean {
  const clock = ticket.sla.resolution ?? ticket.sla.response;
  return Boolean(clock && !clock.met && !clock.breached && clock.remainingMinutes < clock.targetMinutes * 0.25);
}

/** Tightest clock first, and a ticket with no clock last: the order the list is read in. */
function byClock(a: TicketView, b: TicketView): number {
  const left = tighterClock(a.sla)?.remainingMinutes ?? Number.MAX_SAFE_INTEGER;
  const right = tighterClock(b.sla)?.remainingMinutes ?? Number.MAX_SAFE_INTEGER;
  return left - right;
}

/**
 * "Mine first, then group unassigned", which is what render 08's own subtitle
 * says the list is: everything assigned to me on the tightest clock, then the
 * unassigned work in my groups on the same order, with nothing counted twice.
 *
 * The list is the tiles' own set, not a narrower one. It used to be filtered
 * first to the breached and the long-stale, so the screen could say "7
 * assigned across 2 accounts" over a list of one row: two numbers for the
 * same desk that never agreed. Render 08 draws eleven assigned over six rows
 * carrying New, In progress and Awaiting client, so the list is every open
 * ticket the "Assigned to me" tile counts, on the tightest clock, and the
 * scorecards are what narrow it (note 1).
 */
/**
 * What a person can act on this minute.
 *
 * A settled case needs nothing from whoever settled it: it stays open only
 * until the requester or the clock closes it. A case waiting on the client, a
 * third party or an approval is not theirs to move either, and its clock is
 * paused while it waits. Both stay out of the list, and the scorecards go on
 * counting everything open, so the numbers above the list and the work inside
 * it answer two different questions on purpose.
 */
const SETTLED = new Set(["resolved", "fulfilled", "completed", "done", "closed", "cancelled"]);

const WAITING_ON_OTHERS = new Set([
  "awaiting-client",
  "awaiting-third-party",
  "awaiting-approval",
  "blocked",
  "on-hold",
  "scheduled",
]);

function stateSlug(state: string | undefined): string {
  return String(state ?? "")
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
}

export function needsAttention(ticket: TicketView): boolean {
  const state = stateSlug(ticket.state);
  return !SETTLED.has(state) && !WAITING_ON_OTHERS.has(state);
}

export function attentionOrder(mine: TicketView[], group: TicketView[]): TicketView[] {
  const seen = new Set(mine.map((ticket) => ticket.key));
  return [
    ...[...mine].filter(needsAttention).sort(byClock),
    ...group.filter((ticket) => !seen.has(ticket.key) && needsAttention(ticket)).sort(byClock),
  ];
}

export type TileKey = "assigned" | "breached" | "at_risk" | "awaiting";

export interface TileCounts {
  mine: TicketView[];
  breached: number;
  atRisk: number;
  awaiting: number;
}

export interface TileFacts {
  accountCount: number;
  firstBreached?: TicketView;
  awaiting: number;
}

/**
 * The four scorecards, each with the lens it puts over the list under it.
 * The lens is a filter, not a link: pressing a tile narrows Needs attention
 * in place and pressing it again puts the list back, which is what render
 * 08's note 1 asks for ("scorecards filter the list below on click rather
 * than navigating away").
 */
export const TILES: Array<{
  key: TileKey;
  label: string;
  value: (counts: TileCounts) => number;
  detail: (facts: TileFacts) => string | undefined;
  lens: (ticket: TicketView) => boolean;
}> = [
  {
    key: "assigned",
    label: "Assigned to me",
    value: (counts) => counts.mine.length,
    detail: ({ accountCount }) => (accountCount === 1 ? "on 1 account" : `across ${accountCount} accounts`),
    lens: () => true,
  },
  {
    key: "breached",
    label: "Breached",
    value: (counts) => counts.breached,
    detail: ({ firstBreached }) => firstBreached?.key,
    lens: isBreached,
  },
  {
    key: "at_risk",
    label: "At risk",
    value: (counts) => counts.atRisk,
    detail: () => "under 25% left",
    lens: isAtRisk,
  },
  {
    key: "awaiting",
    label: "Awaiting client",
    value: (counts) => counts.awaiting,
    detail: ({ awaiting }) => (awaiting === 1 ? "clock paused" : "clocks paused"),
    lens: (ticket) => ticket.state.startsWith("awaiting"),
  },
];

/** The list under the tiles, narrowed by the pressed one. */
export function underLens(rows: TicketView[], lens: TileKey | null): TicketView[] {
  const tile = TILES.find((entry) => entry.key === lens);
  return tile ? rows.filter(tile.lens) : rows;
}
