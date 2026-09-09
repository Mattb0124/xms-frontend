"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { OutboundStatusPill } from "@/components/admin/connectors/pills";
import { INPUT, SECONDARY_BUTTON, formatDate } from "@/components/admin/primitives";
import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { useToast } from "@/components/xms/toast";
import {
  OUTBOUND_STATUSES,
  conflictSummary,
  dropReasonLabel,
  droppedFields,
  isRetryable,
  keptFields,
  outboundEventLabel,
  type OutboundStatus,
} from "@/lib/connectors/outbound";
import { useConnectorErrors } from "@/lib/connectors/use-connector-errors";
import { useTrack } from "@/lib/telemetry/provider";
import { cn } from "@/lib/utils";
import { useListOutboundQuery, useRetryOutboundMutation, type OutboundRow } from "@/redux/connectorsApi";

/** The status in the URL, so a link to the failed rows is a link a person can send. */
export function statusFromSearch(search: URLSearchParams): OutboundStatus | undefined {
  const value = search.get("status");
  return OUTBOUND_STATUSES.some((entry) => entry.value === value) ? (value as OutboundStatus) : undefined;
}

/** The conflict outcome the worker settled the row with: the line, and both lists on expand. */
export function ConflictCell({ row }: { row: OutboundRow }) {
  const summary = conflictSummary(row.conflict);
  if (!summary) return <span className="text-xms-muted text-[12px]">none</span>;
  const kept = keptFields(row.conflict);
  const dropped = droppedFields(row.conflict);
  return (
    <details className="max-w-[320px] text-[12px]" data-conflict={row.id}>
      <summary className="text-xms-accent cursor-pointer">{summary}</summary>
      <dl className="text-xms-body mt-1 flex flex-col gap-1">
        {kept.length > 0 ? (
          <div>
            <dt className="text-xms-label">Kept</dt>
            <dd className="xms-mono" data-kept={kept.join(",")}>
              {kept.join(", ")}
            </dd>
          </div>
        ) : null}
        {dropped.length > 0 ? (
          <div>
            <dt className="text-xms-label">Dropped</dt>
            <dd data-dropped={dropped.map((entry) => entry.field).join(",")}>
              <ul className="flex flex-col gap-1">
                {dropped.map((entry) => (
                  <li key={entry.field}>
                    <span className="xms-mono">{entry.field}</span>: {dropReasonLabel(entry.reason)} ({entry.policy})
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
        {row.conflict?.external_sys_updated_on ? (
          <div>
            <dt className="text-xms-label">Client record last changed</dt>
            <dd className="xms-mono">{formatDate(String(row.conflict.external_sys_updated_on))}</dd>
          </div>
        ) : null}
      </dl>
    </details>
  );
}

/**
 * The outbound queue of one instance (ServiceNow Sync functional 5.5 and
 * 5.7, SN-03 to SN-05): every XMS change on its way to the client with the
 * attempts, the backoff and the conflict outcome, filtered by status through
 * the URL, and Retry on a row that has settled as failed or dead lettered.
 */
export function OutboundTab({ instanceId }: { instanceId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const status = statusFromSearch(new URLSearchParams(search.toString()));
  const queue = useListOutboundQuery({ id: instanceId, status });
  const [retry, { isLoading }] = useRetryOutboundMutation();
  const onError = useConnectorErrors(queue.refetch);
  const track = useTrack("connector.outbound.retry");
  const { push } = useToast();

  const apply = (next: string) => {
    const params = new URLSearchParams(search.toString());
    if (next) params.set("status", next);
    else params.delete("status");
    const text = params.toString();
    router.replace(text ? `${pathname}?${text}` : pathname);
  };

  const requeue = async (row: OutboundRow) => {
    try {
      const result = await retry({ id: instanceId, outboundId: row.id }).unwrap();
      track({ instance_id: instanceId, outbound_id: row.id, outcome: result.outcome });
      push({
        title: result.outcome === "requeued" ? "Requeued" : "Already queued",
        detail:
          result.outcome === "requeued"
            ? "The change is back in the queue and goes out on the next dispatch."
            : "This change was already waiting to send.",
        tone: "success",
      });
    } catch (caught) {
      onError(caught);
    }
  };

  const columns: DenseColumn<OutboundRow>[] = [
    {
      key: "created_at",
      title: "Queued",
      mono: true,
      sortValue: (row) => row.created_at,
      render: (row) => formatDate(row.created_at),
    },
    { key: "event", title: "Event", sortValue: (row) => row.event, render: (row) => outboundEventLabel(row.event) },
    {
      key: "ticket",
      title: "Ticket",
      mono: true,
      sortValue: (row) => row.ticket_key ?? row.ticket_id,
      render: (row) =>
        row.ticket_key ? (
          <Link href={`/cases/${row.ticket_key}`} className="text-xms-accent" data-ticket={row.ticket_key}>
            {row.ticket_key}
          </Link>
        ) : (
          <span className="text-xms-muted">{row.ticket_id.slice(0, 8)}</span>
        ),
    },
    {
      key: "status",
      title: "Status",
      sortValue: (row) => row.status,
      render: (row) => <OutboundStatusPill status={row.status} />,
    },
    { key: "attempts", title: "Attempts", mono: true, align: "right", sortValue: (row) => row.attempts },
    {
      key: "next_attempt_at",
      title: "Next attempt",
      mono: true,
      sortValue: (row) => row.next_attempt_at,
      render: (row) => (row.status === "pending" ? formatDate(row.next_attempt_at) : ""),
    },
    {
      key: "last_error",
      title: "Last error",
      sortValue: (row) => row.last_error ?? "",
      render: (row) =>
        row.last_error ? (
          <span className="block max-w-[320px] truncate text-[color:var(--state-overdue-text)]" title={row.last_error}>
            {row.last_error}
          </span>
        ) : (
          ""
        ),
    },
    { key: "conflict", title: "Conflict", render: (row) => <ConflictCell row={row} /> },
    {
      key: "retry",
      title: "",
      render: (row) =>
        isRetryable(row.status) ? (
          <button
            type="button"
            className={SECONDARY_BUTTON}
            disabled={isLoading}
            aria-label={`Retry ${row.ticket_key ?? row.id}`}
            onClick={() => void requeue(row)}
          >
            Retry
          </button>
        ) : null,
    },
  ];

  return (
    <DenseTable
      title="Outbound queue"
      columns={columns}
      rows={queue.data ?? []}
      rowKey={(row) => row.id}
      loading={queue.isLoading}
      emptyState={
        status
          ? "No change in the queue is in that state."
          : "Nothing has been queued for this instance. Bidirectional mode fills this queue."
      }
      search={
        <select
          aria-label="Status"
          className={cn(INPUT, "h-[28px] w-auto text-[12px]")}
          value={status ?? ""}
          onChange={(event) => apply(event.target.value)}
        >
          <option value="">Any status</option>
          {OUTBOUND_STATUSES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      }
    />
  );
}
