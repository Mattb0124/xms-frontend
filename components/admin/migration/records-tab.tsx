"use client";

import Link from "next/link";
import { useState } from "react";
import { RecordStatusPill } from "@/components/admin/migration/pills";
import { INPUT, SECONDARY_BUTTON, formatDate } from "@/components/admin/primitives";
import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { Skeleton } from "@/components/xms/skeleton";
import { RECORD_STATUSES } from "@/lib/migration/vocab";
import { cn } from "@/lib/utils";
import { useGetRecordQuery, useListRecordsQuery, type MigrationRecord } from "@/redux/migrationApi";

const COLUMNS: DenseColumn<MigrationRecord>[] = [
  { key: "source_id", title: "Source id", mono: true, sortValue: (row) => row.source_id },
  { key: "source_key", title: "Source key", mono: true, sortValue: (row) => row.source_key ?? "" },
  {
    key: "status",
    title: "Status",
    sortValue: (row) => row.status,
    render: (row) => <RecordStatusPill status={row.status} />,
  },
  {
    key: "target",
    title: "Target",
    mono: true,
    sortValue: (row) => row.target_id ?? "",
    render: (row) =>
      row.target_id ? (
        <Link
          href={`/tickets/${row.target_id}`}
          className="text-xms-accent"
          data-target={row.target_id}
          onClick={(event) => event.stopPropagation()}
        >
          {row.target_id.slice(0, 8)}
        </Link>
      ) : (
        <span className="text-xms-muted">none</span>
      ),
  },
  {
    key: "message",
    title: "Message",
    sortValue: (row) => row.message ?? "",
    render: (row) =>
      row.message ? (
        <span
          className={cn(
            "block max-w-[420px] truncate",
            row.status === "error" && "text-[color:var(--state-overdue-text)]",
          )}
          title={row.message}
        >
          {row.message}
        </span>
      ) : (
        ""
      ),
  },
  {
    key: "source_timestamp",
    title: "Source time",
    mono: true,
    sortValue: (row) => row.source_timestamp ?? "",
    render: (row) => formatDate(row.source_timestamp),
  },
];

/** One record: message, target, the source payload key and the raw payload read back from the store. */
export function RecordDrawer({
  batchId,
  recordId,
  onClose,
}: {
  batchId: string;
  recordId: string;
  onClose: () => void;
}) {
  const { data, isLoading } = useGetRecordQuery({ id: batchId, recordId });
  return (
    <aside
      role="dialog"
      aria-label="Migration record"
      className="border-xms-line bg-xms-card fixed inset-y-0 right-0 z-30 flex w-full max-w-[560px] flex-col gap-3 overflow-auto border-l p-4 shadow-xl"
    >
      <header className="flex items-center gap-3">
        <h2 className="text-xms-ink text-[15px] font-semibold">Record</h2>
        {data ? <RecordStatusPill status={data.status} /> : null}
        <button type="button" className={cn(SECONDARY_BUTTON, "ml-auto")} onClick={onClose}>
          Close
        </button>
      </header>
      {isLoading || !data ? <Skeleton lines={6} /> : null}
      {data ? (
        <>
          <dl className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-2 text-[13px]">
            <dt className="text-xms-label text-[12px]">Source id</dt>
            <dd className="xms-mono text-xms-ink break-all">{data.source_id}</dd>
            <dt className="text-xms-label text-[12px]">Source key</dt>
            <dd className="xms-mono text-xms-ink">{data.source_key ?? ""}</dd>
            <dt className="text-xms-label text-[12px]">Target</dt>
            <dd className="xms-mono text-xms-ink">
              {data.target_id ? (
                <Link href={`/tickets/${data.target_id}`} className="text-xms-accent">
                  {data.target_table ?? "ticket"} {data.target_id.slice(0, 8)}
                </Link>
              ) : (
                <span className="text-xms-muted">none</span>
              )}
            </dd>
            <dt className="text-xms-label text-[12px]">Message</dt>
            <dd
              className={cn("text-xms-ink", data.status === "error" && "text-[color:var(--state-overdue-text)]")}
              data-record-message
            >
              {data.message ?? ""}
            </dd>
            <dt className="text-xms-label text-[12px]">Source time</dt>
            <dd className="xms-mono text-xms-ink">{formatDate(data.source_timestamp)}</dd>
            <dt className="text-xms-label text-[12px]">Source hash</dt>
            <dd className="xms-mono text-xms-ink break-all text-[12px]">{data.source_hash}</dd>
            <dt className="text-xms-label text-[12px]">Payload key</dt>
            <dd className="xms-mono text-xms-ink break-all text-[12px]" data-payload-key>
              {data.source_payload_key ?? "none"}
            </dd>
          </dl>
          <section aria-label="Source payload" className="flex flex-col gap-1">
            <p className="xms-caption">Source payload</p>
            {data.payload === null || data.payload === undefined ? (
              <p className="text-xms-label text-[12px]">The raw row is not in the store.</p>
            ) : (
              <pre className="xms-mono text-xms-body bg-xms-tint max-h-[60vh] overflow-auto rounded-[4px] p-3 text-[11px] whitespace-pre-wrap">
                {JSON.stringify(data.payload, null, 2)}
              </pre>
            )}
          </section>
        </>
      ) : null}
    </aside>
  );
}

/**
 * The Records tab (Data Migration functional 5.2): per-record results with
 * a status filter and a search over the source id and key; a row opens the
 * record drawer with the message and the source payload.
 */
export function RecordsTab({ batchId }: { batchId: string }) {
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const records = useListRecordsQuery({ id: batchId, status: status || undefined, q: q || undefined });
  const rows = records.data ?? [];
  return (
    <>
      <DenseTable
        title="Records"
        count={rows.length}
        columns={COLUMNS}
        rows={rows}
        rowKey={(row) => row.id}
        loading={records.isLoading}
        onRowClick={(row) => setSelected(row.id)}
        emptyState={
          status || q ? "No records match." : records.isLoading ? "Loading" : "No records yet. Run the batch."
        }
        search={
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setQ(query.trim());
            }}
          >
            <select
              aria-label="Record status"
              className={cn(INPUT, "h-[28px] w-auto text-[12px]")}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Any status</option>
              {RECORD_STATUSES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              type="search"
              aria-label="Search records"
              placeholder="Source id or key"
              className={cn(INPUT, "h-[28px] w-[200px] text-[12px]")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </form>
        }
      />
      {selected ? <RecordDrawer batchId={batchId} recordId={selected} onClose={() => setSelected(null)} /> : null}
    </>
  );
}
