"use client";

import Link from "next/link";
import { useState } from "react";
import { OutcomePill } from "@/components/admin/connectors/pills";
import { INPUT, formatDate } from "@/components/admin/primitives";
import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { RUN_DIRECTIONS, RUN_OUTCOMES, type RunDirection, type RunOutcome } from "@/lib/connectors/vocab";
import { cn } from "@/lib/utils";
import { useListRunsQuery, type SyncRun } from "@/redux/connectorsApi";

export const RUN_COLUMNS: DenseColumn<SyncRun>[] = [
  {
    key: "created_at",
    title: "When",
    mono: true,
    sortValue: (row) => row.created_at,
    render: (row) => formatDate(row.created_at),
  },
  { key: "direction", title: "Direction", sortValue: (row) => row.direction },
  {
    key: "outcome",
    title: "Outcome",
    sortValue: (row) => row.outcome,
    render: (row) => <OutcomePill outcome={row.outcome} />,
  },
  {
    key: "ticket",
    title: "Ticket",
    mono: true,
    sortValue: (row) => row.ticket_id ?? "",
    render: (row) =>
      row.ticket_id ? (
        <Link href={`/cases/${row.ticket_id}`} className="text-xms-accent" data-ticket={row.ticket_id}>
          {row.ticket_id.slice(0, 8)}
        </Link>
      ) : (
        <span className="text-xms-muted">none</span>
      ),
  },
  {
    key: "external",
    title: "External id",
    mono: true,
    sortValue: (row) => row.external_sys_id ?? "",
    render: (row) =>
      row.external_sys_id ? <span title={row.external_sys_id}>{row.external_sys_id.slice(0, 12)}</span> : "",
  },
  { key: "attempt", title: "Attempt", mono: true, align: "right", sortValue: (row) => row.attempt },
  {
    key: "duration",
    title: "Duration",
    mono: true,
    align: "right",
    sortValue: (row) => row.duration_ms ?? -1,
    render: (row) => (row.duration_ms === null ? "" : `${row.duration_ms} ms`),
  },
  {
    key: "error",
    title: "Error",
    sortValue: (row) => row.error_text ?? "",
    render: (row) =>
      row.error_text ? (
        <span className="block max-w-[360px] truncate text-[color:var(--state-overdue-text)]" title={row.error_text}>
          {row.error_class ? `${row.error_class}: ` : ""}
          {row.error_text}
        </span>
      ) : (
        ""
      ),
  },
];

/** Runs for one instance with direction and outcome filters (ServiceNow Sync functional 5.4). */
export function RunsTab({ instanceId }: { instanceId: string }) {
  const [direction, setDirection] = useState<RunDirection | "">("");
  const [outcome, setOutcome] = useState<RunOutcome | "">("");
  const runs = useListRunsQuery({
    id: instanceId,
    direction: direction || undefined,
    outcome: outcome || undefined,
    limit: 200,
  });
  return (
    <DenseTable
      title="Runs"
      columns={RUN_COLUMNS}
      rows={runs.data ?? []}
      rowKey={(row) => row.id}
      loading={runs.isLoading}
      emptyState="No runs match."
      search={
        <div className="flex items-center gap-2">
          <select
            aria-label="Direction"
            className={cn(INPUT, "h-[28px] w-auto text-[12px]")}
            value={direction}
            onChange={(event) => setDirection(event.target.value as RunDirection | "")}
          >
            <option value="">Any direction</option>
            {RUN_DIRECTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Outcome"
            className={cn(INPUT, "h-[28px] w-auto text-[12px]")}
            value={outcome}
            onChange={(event) => setOutcome(event.target.value as RunOutcome | "")}
          >
            <option value="">Any outcome</option>
            {RUN_OUTCOMES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      }
    />
  );
}
