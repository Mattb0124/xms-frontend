"use client";

import { shortName } from "@/components/xms/actor-chip";
import type { DenseColumn } from "@/components/xms/dense-table";
import { ICON } from "@/components/xms/icons";
import { KeyLink, TextLink } from "@/components/xms/key-link";
import { PriorityPill } from "@/components/xms/priority-pill";
import { SlaValue } from "@/components/xms/sla-value";
import { StatePill } from "@/components/xms/state-pill";
import { clockSnapshot, tighterClock } from "@/lib/tickets/sla";
import { typeLabel } from "@/lib/tickets/vocab";
import type { GrantedAccount, TicketView } from "@/redux/ticketsApi";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "3 Sep" for the Opened column, with the year appended once the ticket was
 * opened in another one, so a list that spans a year boundary still reads.
 * Built from the parts rather than through `toLocaleDateString` so the column
 * is the same on every machine and the tests can assert it.
 */
export function openedDate(iso: string, now: Date = new Date()): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const stem = `${at.getDate()} ${MONTHS[at.getMonth()]}`;
  return at.getFullYear() === now.getFullYear() ? stem : `${stem} ${String(at.getFullYear()).slice(2)}`;
}

/** "3m ago", "2h ago", "4d ago" for the Updated column. */

/** The two lines a stamp is drawn on: the day above, the clock beneath. */
export function stampLines(iso: string, now: Date = new Date()): { day: string; time: string } {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return { day: "", time: "" };
  return {
    day: openedDate(iso, now),
    time: `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`,
  };
}

/** How a case arrived, in a word, with the mark that says it without reading. */
export const CHANNEL_LABEL: Record<string, string> = {
  email: "Email",
  portal: "Portal",
  phone: "Phone",
  internal: "Internal",
  sync: "Sync",
  api: "API",
  chat: "Chat",
};

export function channelLabel(source: string): string {
  return CHANNEL_LABEL[source] ?? source.charAt(0).toUpperCase() + source.slice(1);
}

export function relativeTime(iso: string, now: Date = new Date()): string {
  const diff = Math.max(0, now.getTime() - new Date(iso).getTime());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toISOString().slice(0, 10);
}

/**
 * Stable identity hue per account (1 to 6) from the key, so an account keeps
 * the same one wherever it is drawn. No list draws it any more (the reviewer
 * took the identity square off every list); it is kept for the account record
 * itself, which is the one place a single swatch names one account.
 */
export function accountHue(key: string | undefined): number | undefined {
  if (!key) return undefined;
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return (hash % 6) + 1;
}

export interface ColumnOptions {
  accounts: Map<string, GrantedAccount>;
  /** Hide the account column on single-account lists. */
  hideAccount?: boolean;
  /**
   * Draw the SLA and Updated cells. The Queue leaves them off: the v3 render
   * (01) ends the table at Assignee, and the two extra cells pushed the card
   * past 1500 so the whole list scrolled sideways. They stay in the set,
   * carried as hidden columns, because the Queue still opens on the tightest
   * clock and a hidden column can still be sorted on.
   */
  showClocks?: boolean;
}

/** The Queue's default sort: the tightest clock first (Wireframes section 3.1). */
export const QUEUE_DEFAULT_SORT = { key: "sla", direction: "asc" } as const;

/**
 * The Queue column set (Wireframes section 3.1, v3 render 01): Key, Short
 * description, Account, Type, Priority, State, Opened, Assignee, then SLA and
 * Updated, which v3 does not draw.
 *
 * Account and Type are plain text, here and in every other list on every
 * other screen. The render draws an identity square before the account and a
 * type bar before the label; the reviewer took both off, so a row carries
 * colour for state, priority and the clock alone, which is the three
 * questions a list is read for. `components/xms/surfaces.test.tsx` fails if
 * either comes back to a list.
 *
 * The widths add up to the render's: 1500 less the 238px sidebar, the page
 * padding and the card border leaves about 1180 for the visible cells, which
 * is why Short description takes the slack and everything else is fixed.
 */

/**
 * The order the design brief states: the key, then what a case is (state,
 * priority), then what it says, then the people and the account, then the
 * clocks. The description is the one column that grows, and it is given the
 * width to hold a sentence on one or two lines rather than four.
 */
const COLUMN_ORDER = [
  "key",
  "state",
  "priority",
  "short_description",
  "contact",
  "channel",
  "account",
  "csm",
  "assignee",
  "sla",
  "updated",
  "opened",
] as const;

function inBriefOrder<Row>(columns: DenseColumn<Row>[]): DenseColumn<Row>[] {
  const rank = new Map<string, number>(COLUMN_ORDER.map((key, index) => [key, index]));
  return [...columns].sort((a, b) => (rank.get(a.key) ?? 99) - (rank.get(b.key) ?? 99));
}

export function ticketColumns({ accounts, hideAccount, showClocks }: ColumnOptions): DenseColumn<TicketView>[] {
  const columns: DenseColumn<TicketView>[] = [
    {
      key: "key",
      title: "Key",
      width: "116px",
      sortValue: (row) => row.key,
      render: (row) => <KeyLink ticketKey={row.key} />,
    },
    {
      key: "short_description",
      title: "Short description",
      wrap: true,
      width: "minmax(320px, 1fr)",
      sortValue: (row) => row.short_description,
      render: (row) => <span className="text-xms-ink block max-w-[520px] leading-[1.35]">{row.short_description}</span>,
    },
    {
      key: "account",
      title: "Account",
      width: "168px",
      sortValue: (row) => accounts.get(row.account_id)?.name ?? row.account_id,
      render: (row) => <span className="text-xms-body">{accounts.get(row.account_id)?.name ?? "Account"}</span>,
    },
    {
      // The person who raised it, and their own record: the number, the role
      // and the hours a consultant needs before ringing them.
      key: "contact",
      title: "Contact",
      width: "150px",
      sortValue: (row) => row.requester?.display_name ?? "",
      render: (row) =>
        row.requester ? (
          <TextLink href={`/contacts/${row.requester.id}`}>{row.requester.display_name}</TextLink>
        ) : (
          <span className="text-xms-muted">No contact</span>
        ),
    },
    {
      // The account's CSM, from the account picker rather than a lookup per
      // row: one call already names every account this reader may see.
      key: "csm",
      title: "CSM",
      width: "140px",
      sortValue: (row) => accounts.get(row.account_id)?.owner_name ?? "",
      render: (row) => {
        const account = accounts.get(row.account_id);
        if (!account?.owner_name) return <span className="text-xms-muted">Unassigned</span>;
        return account.owner_id ? (
          <TextLink href={`/roster/${account.owner_id}`}>{account.owner_name}</TextLink>
        ) : (
          <span className="text-xms-body">{account.owner_name}</span>
        );
      },
    },
    {
      key: "channel",
      title: "Channel",
      width: "116px",
      sortValue: (row) => channelLabel(row.source),
      render: (row) => (
        <span className="text-xms-body inline-flex items-center gap-[7px]">
          <ChannelGlyph source={row.source} />
          {channelLabel(row.source)}
        </span>
      ),
    },
    {
      key: "priority",
      title: "Priority",
      width: "96px",
      sortValue: (row) => row.priority,
      render: (row) => <PriorityPill priority={row.priority} />,
    },
    {
      key: "state",
      title: "State",
      width: "154px",
      sortValue: (row) => row.state,
      render: (row) => <StatePill state={row.state} label={row.state_label} />,
    },
    {
      // When the request arrived, which is the question the queue is read
      // for after the clock and is not answerable from "Updated".
      key: "opened",
      title: "Opened",
      width: "104px",
      mono: true,
      sortValue: (row) => row.created_at,
      render: (row) => <Stamp iso={row.created_at} />,
    },
    {
      key: "assignee",
      title: "Assigned to",
      width: "140px",
      sortValue: (row) => row.assignee_name ?? "",
      // "M. Brown", no avatar circle: the render carries the name alone. The
      // name opens the person, like every other person named in a row.
      render: (row) =>
        row.assignee_name ? (
          row.assignee_id ? (
            <TextLink href={`/roster/${row.assignee_id}`}>{shortName(row.assignee_name)}</TextLink>
          ) : (
            <span className="text-xms-ink">{shortName(row.assignee_name)}</span>
          )
        ) : (
          <span className="text-xms-muted">Unassigned</span>
        ),
    },
    {
      key: "sla",
      title: "SLA",
      width: "110px",
      hidden: !showClocks,
      sortValue: (row) => tighterClock(row.sla)?.remainingMinutes ?? Number.MAX_SAFE_INTEGER,
      render: (row) => <SlaValue snapshot={clockSnapshot(tighterClock(row.sla))} />,
    },
    {
      key: "updated",
      title: "Updated",
      width: "100px",
      hidden: !showClocks,
      mono: true,
      sortValue: (row) => row.updated_at,
      render: (row) => <Stamp iso={row.updated_at} />,
    },
  ];
  const ordered = inBriefOrder(hideAccount ? columns.filter((column) => column.key !== "account") : columns);
  return ordered;
}

/**
 * The Needs attention list on My work (v3 render 08): key, title, account,
 * state and the clock, and nothing else. The Queue's full set was being used
 * there, which put Type, Priority and Assignee into a rail-width card that
 * had no room for them.
 *
 * The widths are the render's: an 82px mono key, the title taking the slack,
 * a 128px account with its identity square, the state pill, and the clock
 * right-aligned in 92px with its signal as a dot rather than a pill, so the
 * only pill on the row is the state.
 */
export function attentionColumns(options: ColumnOptions): DenseColumn<TicketView>[] {
  const wanted = new Set(["key", "short_description", "account", "contact", "csm", "priority", "state", "sla"]);
  const widths: Record<string, string | undefined> = {
    key: "82px",
    short_description: undefined,
    account: "128px",
    contact: "140px",
    csm: "132px",
    priority: "126px",
    state: "132px",
    sla: "92px",
  };
  return ticketColumns({ ...options, showClocks: true })
    .filter((column) => wanted.has(column.key))
    .map((column) => ({
      ...column,
      width: widths[column.key],
      ...(column.key === "sla"
        ? {
            title: "SLA",
            align: "right" as const,
            render: (row: TicketView) => <SlaValue snapshot={clockSnapshot(tighterClock(row.sla))} dot />,
          }
        : {}),
    }));
}

/** A stamp on two lines: the day above, the clock beneath, both quiet. */
function Stamp({ iso }: { iso: string }) {
  const { day, time } = stampLines(iso);
  if (!day) return null;
  return (
    <span className="text-xms-label flex flex-col leading-[1.3]">
      <span>{day}</span>
      <span className="xms-mono text-xms-muted text-[12px]">{time}</span>
    </span>
  );
}

/**
 * The mark beside a channel. Drawn on the same 24px canvas as every other
 * icon, on the blue-grey ramp: it says how the case arrived, and it is not
 * something to click.
 */
function ChannelGlyph({ source }: { source: string }) {
  const common = {
    width: ICON.glyph,
    height: ICON.glyph,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className: "text-xms-icon shrink-0",
  };
  if (source === "email")
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3.5 7 8.5 6 8.5-6" />
      </svg>
    );
  if (source === "phone")
    return (
      <svg {...common}>
        <path d="M6 3h3l2 5-2.5 1.5a12 12 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4 5.2 2 2 0 0 1 6 3Z" />
      </svg>
    );
  if (source === "portal")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18Z" />
      </svg>
    );
  if (source === "sync")
    return (
      <svg {...common}>
        <path d="M4 10a8 8 0 0 1 13.5-4.5L20 8" />
        <path d="M20 14a8 8 0 0 1-13.5 4.5L4 16" />
      </svg>
    );
  return (
    <svg {...common}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M9 9h6M9 13h6" />
    </svg>
  );
}
