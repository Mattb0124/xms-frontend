"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { BatchStatusPill, DryRunPill } from "@/components/admin/migration/pills";
import { formatDate } from "@/components/admin/primitives";
import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { describeRange, describeSource, objectKindLabel } from "@/lib/migration/vocab";
import type { MigrationBatch } from "@/redux/migrationApi";

export interface BatchListProps {
  rows: MigrationBatch[];
  /** Account names by id, when the reader may list accounts; otherwise the id is shown. */
  accountNames?: Record<string, string>;
  loading?: boolean;
  emptyState?: ReactNode;
}

function accountLabel(row: MigrationBatch, names?: Record<string, string>): string {
  return names?.[row.account_id] ?? row.account_id.slice(0, 8);
}

const COUNT_TONE = {
  overdue: "text-[color:var(--state-overdue-text)]",
  "needs-input": "text-[color:var(--state-needs-input-text)]",
} as const;

/** Unmatched and error counts take their signal colour only when they are not zero. */
export function countCell(value: number, tone: keyof typeof COUNT_TONE) {
  if (value === 0) return <span>{value}</span>;
  return (
    <span className={COUNT_TONE[tone]} data-count-tone={tone}>
      {value}
    </span>
  );
}

/**
 * The Batches view (Data Migration functional 5.2): one row per batch with
 * its account, object kind, range, status, the six counts, started,
 * finished and who ran it. Every number is the server's.
 */
export function BatchList({ rows, accountNames, loading, emptyState }: BatchListProps) {
  const columns: DenseColumn<MigrationBatch>[] = [
    {
      key: "id",
      title: "Batch",
      mono: true,
      sortValue: (row) => row.created_at,
      render: (row) => (
        <Link href={`/admin/migration/${row.id}`} className="text-xms-accent font-medium" data-batch={row.id}>
          {row.id.slice(0, 8)}
        </Link>
      ),
    },
    {
      key: "account",
      title: "Account",
      sortValue: (row) => accountLabel(row, accountNames),
      render: (row) => <span className="xms-account">{accountLabel(row, accountNames)}</span>,
    },
    { key: "object_kind", title: "Objects", sortValue: (row) => objectKindLabel(row.object_kind) },
    { key: "source", title: "Source", sortValue: (row) => describeSource(row), render: (row) => describeSource(row) },
    {
      key: "range",
      title: "Range",
      mono: true,
      sortValue: (row) => describeRange(row.source_range),
      render: (row) => describeRange(row.source_range),
    },
    {
      key: "status",
      title: "Status",
      sortValue: (row) => row.status,
      render: (row) => <BatchStatusPill status={row.status} title={row.error ?? undefined} />,
    },
    {
      key: "dry_run",
      title: "Mode",
      sortValue: (row) => (row.dry_run ? 0 : 1),
      render: (row) => <DryRunPill dryRun={row.dry_run} />,
    },
    { key: "extracted", title: "Extracted", mono: true, align: "right", sortValue: (row) => row.counts.extracted },
    { key: "loaded", title: "Loaded", mono: true, align: "right", sortValue: (row) => row.counts.loaded },
    { key: "updated", title: "Updated", mono: true, align: "right", sortValue: (row) => row.counts.updated },
    { key: "skipped", title: "Skipped", mono: true, align: "right", sortValue: (row) => row.counts.skipped },
    {
      key: "unmatched",
      title: "Unmatched",
      mono: true,
      align: "right",
      sortValue: (row) => row.counts.unmatched,
      render: (row) => countCell(row.counts.unmatched, "needs-input"),
    },
    {
      key: "errors",
      title: "Errors",
      mono: true,
      align: "right",
      sortValue: (row) => row.counts.errors,
      render: (row) => countCell(row.counts.errors, "overdue"),
    },
    {
      key: "started_at",
      title: "Started",
      mono: true,
      sortValue: (row) => row.started_at ?? "",
      render: (row) => formatDate(row.started_at),
    },
    {
      key: "finished_at",
      title: "Finished",
      mono: true,
      sortValue: (row) => row.finished_at ?? "",
      render: (row) => formatDate(row.finished_at),
    },
    {
      key: "run_by",
      title: "Run by",
      sortValue: (row) => row.run_by_name ?? "",
      render: (row) => row.run_by_name ?? "",
    },
  ];
  return (
    <DenseTable
      title="Batches"
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      loading={loading}
      emptyState={
        emptyState ??
        "No batches yet. Create the first batch for an account; start with accounts and contacts, then cases."
      }
    />
  );
}
