"use client";

import Link from "next/link";
import { HealthPill, ModePill } from "@/components/admin/connectors/pills";
import { formatDate } from "@/components/admin/primitives";
import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { formatSeconds } from "@/lib/connectors/vocab";
import type { ConnectorHealthRow } from "@/redux/connectorsApi";

export interface HealthListProps {
  rows: ConnectorHealthRow[];
  /** Account names by id, when the reader may list accounts; otherwise the id is shown. */
  accountNames?: Record<string, string>;
  loading?: boolean;
}

function accountLabel(row: ConnectorHealthRow, names?: Record<string, string>): string {
  return names?.[row.account_id] ?? row.account_id.slice(0, 8);
}

/**
 * The sync health screen (ServiceNow Sync functional 5.4): one row per
 * instance across the accounts the reader can see. Every number is the
 * server's; the browser only formats.
 */
export function ConnectorHealthList({ rows, accountNames, loading }: HealthListProps) {
  const columns: DenseColumn<ConnectorHealthRow>[] = [
    {
      key: "account",
      title: "Account",
      sortValue: (row) => accountLabel(row, accountNames),
      render: (row) => <span className="xms-account">{accountLabel(row, accountNames)}</span>,
    },
    {
      key: "name",
      title: "Instance",
      sortValue: (row) => row.name,
      render: (row) => (
        <Link href={`/admin/connectors/${row.id}`} className="text-xms-accent font-medium" data-instance={row.id}>
          {row.name}
        </Link>
      ),
    },
    { key: "mode", title: "Mode", sortValue: (row) => row.mode, render: (row) => <ModePill mode={row.mode} /> },
    {
      key: "health",
      title: "Health",
      sortValue: (row) => row.health,
      render: (row) => <HealthPill health={row.health} reason={row.trip_reason} />,
    },
    {
      key: "pending_inbox",
      title: "Pending inbox",
      align: "right",
      mono: true,
      sortValue: (row) => row.pending_inbox,
    },
    {
      key: "open_dead_letters",
      title: "Dead letters",
      align: "right",
      mono: true,
      sortValue: (row) => row.open_dead_letters,
      render: (row) =>
        row.open_dead_letters > 0 ? (
          <span className="text-[color:var(--state-overdue-text)]" data-dead-letters={row.open_dead_letters}>
            {row.open_dead_letters}
          </span>
        ) : (
          <span>0</span>
        ),
    },
    // The outbound backlog beside the ingest figures (functional 5.4). The
    // health route answers both counts on every instance now, so the columns
    // are unconditional and one instance is read in one row. A row that
    // arrives without a count still prints a blank rather than a zero: a
    // figure the server never sent would read as "nothing is waiting", which
    // is not what it said.
    {
      key: "pending_outbound",
      title: "Outbound pending",
      align: "right",
      mono: true,
      sortValue: (row) => row.pending_outbound ?? null,
      render: (row) =>
        row.pending_outbound === undefined ? (
          <span className="text-xms-muted" data-pending-outbound="" aria-label="not answered" />
        ) : (
          <span data-pending-outbound={row.pending_outbound}>{row.pending_outbound}</span>
        ),
    },
    {
      key: "dead_lettered_outbound",
      title: "Outbound dead lettered",
      align: "right",
      mono: true,
      sortValue: (row) => row.dead_lettered_outbound ?? null,
      render: (row) =>
        row.dead_lettered_outbound === undefined ? (
          <span className="text-xms-muted" data-dead-lettered-outbound="" aria-label="not answered" />
        ) : row.dead_lettered_outbound > 0 ? (
          <span
            className="text-[color:var(--state-overdue-text)]"
            data-dead-lettered-outbound={row.dead_lettered_outbound}
          >
            {row.dead_lettered_outbound}
          </span>
        ) : (
          <span data-dead-lettered-outbound="0">0</span>
        ),
    },
    {
      key: "lag",
      title: "Inbound lag",
      align: "right",
      mono: true,
      sortValue: (row) => row.inbound_lag_seconds,
      render: (row) => formatSeconds(row.inbound_lag_seconds),
    },
    {
      key: "last_success_at",
      title: "Last success",
      mono: true,
      sortValue: (row) => row.last_success_at ?? "",
      render: (row) => formatDate(row.last_success_at),
    },
    {
      key: "last_error",
      title: "Last error",
      sortValue: (row) => row.last_error ?? "",
      render: (row) =>
        row.last_error ? (
          <span className="block max-w-[320px] truncate" title={row.last_error}>
            {row.last_error}
          </span>
        ) : (
          <span className="text-xms-muted">none</span>
        ),
    },
  ];
  return (
    <DenseTable
      title="Connector instances"
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      loading={loading}
      emptyState="No connector instances on your accounts. Add one from the account record."
    />
  );
}
