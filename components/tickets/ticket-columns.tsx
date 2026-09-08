"use client";

import { AccountDot } from "@/components/xms/account-dot";
import { ActorChip } from "@/components/xms/actor-chip";
import type { DenseColumn } from "@/components/xms/dense-table";
import { KeyLink } from "@/components/xms/key-link";
import { PriorityPill } from "@/components/xms/priority-pill";
import { SlaValue } from "@/components/xms/sla-value";
import { StatePill } from "@/components/xms/state-pill";
import { TypeBar } from "@/components/xms/type-bar";
import { clockSnapshot, tighterClock } from "@/lib/tickets/sla";
import type { GrantedAccount, TicketView } from "@/redux/ticketsApi";

/** "3m ago", "2h ago", "4d ago" for the Updated column. */
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

/** Stable identity hue per account (1 to 6) from the key so dots stay the same across screens. */
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
}

/** The Queue's default sort: the tightest clock first (Wireframes section 3.1). */
export const QUEUE_DEFAULT_SORT = { key: "sla", direction: "asc" } as const;

/**
 * The Queue column set in the prototype's order (Wireframes section 3.1):
 * Key, Short description, Account, Type, Priority, State, Assignee, SLA,
 * Updated. The built order put Type second and State before Priority, which
 * is not the prototype's reading order (frontend review finding 20).
 */
export function ticketColumns({ accounts, hideAccount }: ColumnOptions): DenseColumn<TicketView>[] {
  const columns: DenseColumn<TicketView>[] = [
    {
      key: "key",
      title: "Key",
      width: "120px",
      sortValue: (row) => row.key,
      render: (row) => <KeyLink ticketKey={row.key} />,
    },
    {
      key: "short_description",
      title: "Short description",
      sortValue: (row) => row.short_description,
      render: (row) => (
        <span className="text-xms-ink block max-w-[420px] truncate" title={row.short_description}>
          {row.short_description}
        </span>
      ),
    },
    {
      key: "account",
      title: "Account",
      width: "160px",
      sortValue: (row) => accounts.get(row.account_id)?.name ?? row.account_id,
      render: (row) => {
        const account = accounts.get(row.account_id);
        return <AccountDot name={account?.name ?? "Account"} hue={accountHue(account?.key)} />;
      },
    },
    {
      key: "type",
      title: "Type",
      width: "120px",
      sortValue: (row) => row.type,
      render: (row) => <TypeBar type={row.type} />,
    },
    {
      key: "priority",
      title: "Priority",
      width: "90px",
      sortValue: (row) => row.priority,
      render: (row) => <PriorityPill priority={row.priority} />,
    },
    {
      key: "state",
      title: "State",
      width: "150px",
      sortValue: (row) => row.state,
      render: (row) => <StatePill state={row.state} label={row.state_label} />,
    },
    {
      key: "assignee",
      title: "Assignee",
      width: "170px",
      sortValue: (row) => row.assignee_name ?? "",
      render: (row) =>
        row.assignee_name ? <ActorChip name={row.assignee_name} /> : <span className="text-xms-muted">Unassigned</span>,
    },
    {
      key: "sla",
      title: "SLA",
      width: "110px",
      sortValue: (row) => tighterClock(row.sla)?.remainingMinutes ?? Number.MAX_SAFE_INTEGER,
      render: (row) => <SlaValue snapshot={clockSnapshot(tighterClock(row.sla))} />,
    },
    {
      key: "updated",
      title: "Updated",
      width: "100px",
      mono: true,
      sortValue: (row) => row.updated_at,
      render: (row) => <span className="text-xms-label">{relativeTime(row.updated_at)}</span>,
    },
  ];
  return hideAccount ? columns.filter((column) => column.key !== "account") : columns;
}
