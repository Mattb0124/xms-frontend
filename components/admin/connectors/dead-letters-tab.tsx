"use client";

import { useState } from "react";
import { ReasonDialog } from "@/components/admin/connectors/reason-dialog";
import { formatDate } from "@/components/admin/primitives";
import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { BulkAction, SelectionBar } from "@/components/xms/selection-bar";
import { useToast } from "@/components/xms/toast";
import { useConnectorErrors } from "@/lib/connectors/use-connector-errors";
import { useTrack } from "@/lib/telemetry/provider";
import {
  useDiscardDeadLettersMutation,
  useListDeadLettersQuery,
  useReplayDeadLettersMutation,
  type DeadLetter,
} from "@/redux/connectorsApi";

function PayloadCell({ payload }: { payload: Record<string, unknown> }) {
  return (
    <details className="text-[12px]">
      <summary className="text-xms-accent cursor-pointer">payload</summary>
      <pre className="xms-mono text-xms-body mt-1 max-h-[200px] max-w-[480px] overflow-auto text-[11px] whitespace-pre-wrap">
        {JSON.stringify(payload, null, 2)}
      </pre>
    </details>
  );
}

const OPEN_COLUMNS: DenseColumn<DeadLetter>[] = [
  { key: "queue", title: "Queue", mono: true, sortValue: (row) => row.queue },
  {
    key: "error",
    title: "Error",
    sortValue: (row) => row.error,
    render: (row) => (
      <span className="block max-w-[420px] truncate text-[color:var(--state-overdue-text)]" title={row.error}>
        {row.error}
      </span>
    ),
  },
  { key: "attempts", title: "Attempts", mono: true, align: "right", sortValue: (row) => row.attempts },
  {
    key: "first",
    title: "First failed",
    mono: true,
    sortValue: (row) => row.first_failed_at,
    render: (row) => formatDate(row.first_failed_at),
  },
  {
    key: "last",
    title: "Last failed",
    mono: true,
    sortValue: (row) => row.last_failed_at,
    render: (row) => formatDate(row.last_failed_at),
  },
  { key: "payload", title: "Payload", render: (row) => <PayloadCell payload={row.payload} /> },
];

const RESOLVED_COLUMNS: DenseColumn<DeadLetter>[] = [
  { key: "queue", title: "Queue", mono: true, sortValue: (row) => row.queue },
  { key: "resolution", title: "Resolution", sortValue: (row) => row.resolution },
  {
    key: "resolved_at",
    title: "Resolved",
    mono: true,
    sortValue: (row) => row.resolved_at ?? "",
    render: (row) => formatDate(row.resolved_at),
  },
  { key: "reason", title: "Reason", sortValue: (row) => row.resolution_reason ?? "" },
  {
    key: "error",
    title: "Error",
    sortValue: (row) => row.error,
    render: (row) => (
      <span className="block max-w-[360px] truncate" title={row.error}>
        {row.error}
      </span>
    ),
  },
];

/** Summarises the per-id outcomes of a replay or discard into one toast line. */
export function summariseOutcomes(results: { id: string; outcome: string }[], verb: "replayed" | "discarded"): string {
  const done = results.filter((result) => result.outcome === verb).length;
  const skipped = results.length - done;
  return skipped > 0 ? `${done} ${verb}, ${skipped} already resolved.` : `${done} ${verb}.`;
}

/**
 * Dead letters for one instance (ServiceNow Sync functional 5.4): open ones
 * by default with selection, Replay and Discard through a reason sheet;
 * resolved ones behind a collapsed section, loaded on demand.
 */
export function DeadLettersTab({ instanceId }: { instanceId: string }) {
  const open = useListDeadLettersQuery({ id: instanceId, resolution: "open" });
  const [showResolved, setShowResolved] = useState(false);
  const resolved = useListDeadLettersQuery({ id: instanceId }, { skip: !showResolved });
  const [replay, replayState] = useReplayDeadLettersMutation();
  const [discard, discardState] = useDiscardDeadLettersMutation();
  const onError = useConnectorErrors();
  const { push } = useToast();
  const trackReplay = useTrack("connector.dead_letter.replay");
  const trackDiscard = useTrack("connector.dead_letter.discard");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<"replay" | "discard" | null>(null);
  const busy = replayState.isLoading || discardState.isLoading;
  const ids = [...selected];

  const act = async (reason: string) => {
    if (!dialog) return;
    const body = { id: instanceId, ids, reason: reason || undefined };
    try {
      const result = await (dialog === "replay" ? replay(body) : discard(body)).unwrap();
      (dialog === "replay" ? trackReplay : trackDiscard)({ instance_id: instanceId, count: ids.length });
      push({
        title: dialog === "replay" ? "Replayed" : "Discarded",
        detail: summariseOutcomes(result.results, dialog === "replay" ? "replayed" : "discarded"),
        tone: "success",
      });
      setSelected(new Set());
      setDialog(null);
    } catch (caught) {
      onError(caught);
    }
  };

  const resolvedRows = (resolved.data ?? []).filter((row) => row.resolution !== "open");

  return (
    <div className="flex flex-col gap-4">
      <DenseTable
        title="Open dead letters"
        count={open.data?.length ?? 0}
        columns={OPEN_COLUMNS}
        rows={open.data ?? []}
        rowKey={(row) => row.id}
        loading={open.isLoading}
        selectable
        selected={selected}
        onSelectionChange={setSelected}
        emptyState="Nothing is stuck. Every failure was replayed or discarded."
        banner={
          <SelectionBar
            count={selected.size}
            onDismiss={() => setSelected(new Set())}
            note="one audit event written per letter"
          >
            <BulkAction label="Replay" onClick={() => setDialog("replay")} disabled={busy} />
            <BulkAction label="Discard" onClick={() => setDialog("discard")} disabled={busy} />
          </SelectionBar>
        }
      />
      <details
        className="xms-card p-3"
        open={showResolved}
        onToggle={(event) => setShowResolved((event.target as HTMLDetailsElement).open)}
      >
        <summary className="text-xms-ink cursor-pointer text-[13px] font-medium">Resolved dead letters</summary>
        {showResolved ? (
          <div className="mt-3">
            <DenseTable
              title="Resolved"
              count={resolvedRows.length}
              columns={RESOLVED_COLUMNS}
              rows={resolvedRows}
              rowKey={(row) => row.id}
              loading={resolved.isLoading}
              emptyState="No resolved dead letters yet."
            />
          </div>
        ) : null}
      </details>
      {dialog ? (
        <ReasonDialog
          title={
            dialog === "replay"
              ? `Replay ${ids.length} dead letter${ids.length === 1 ? "" : "s"}`
              : `Discard ${ids.length} dead letter${ids.length === 1 ? "" : "s"}`
          }
          detail={
            dialog === "replay"
              ? "Each letter is re-queued with its original payload and processed in order."
              : "Discarded letters are never processed. The reason is kept with the letter."
          }
          confirmLabel={dialog === "replay" ? "Replay" : "Discard"}
          required={dialog === "discard"}
          danger={dialog === "discard"}
          busy={busy}
          onClose={() => setDialog(null)}
          onConfirm={act}
        />
      ) : null}
    </div>
  );
}
