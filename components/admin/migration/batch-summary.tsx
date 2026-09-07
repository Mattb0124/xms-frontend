"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { DryRunPill } from "@/components/admin/migration/pills";
import { formatDate } from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { ScoreTile } from "@/components/xms/score-tile";
import { batchStatusLabel, describeRange, describeSource, isRunning, objectKindLabel } from "@/lib/migration/vocab";
import type { BatchDetail } from "@/redux/migrationApi";

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** The six counts as tiles; unmatched and errors take their signal colour when they are not zero. */
export function CountsStrip({ batch }: { batch: BatchDetail }) {
  const { counts } = batch;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="Counts">
      <ScoreTile label="Extracted" value={counts.extracted} />
      <ScoreTile label="Loaded" value={counts.loaded} tone={counts.loaded > 0 ? "good" : "neutral"} />
      <ScoreTile label="Updated" value={counts.updated} tone={counts.updated > 0 ? "good" : "neutral"} />
      <ScoreTile
        label="Skipped"
        value={counts.skipped}
        detail={counts.skipped > 0 ? "unchanged since the last run" : undefined}
      />
      <ScoreTile label="Unmatched" value={counts.unmatched} tone={counts.unmatched > 0 ? "warn" : "neutral"} />
      <ScoreTile label="Errors" value={counts.errors} tone={counts.errors > 0 ? "breach" : "neutral"} />
    </div>
  );
}

/** Progress line while the run moves through its stages; the record polls every ten seconds meanwhile. */
export function RunProgress({ batch }: { batch: BatchDetail }) {
  if (!isRunning(batch.status)) return null;
  return (
    <div
      role="status"
      className="bg-xms-tint text-xms-body flex items-center gap-3 rounded-[6px] px-4 py-2 text-[13px]"
    >
      <span className="bg-xms-accent h-2 w-2 animate-pulse rounded-full" aria-hidden />
      <span>
        {batchStatusLabel(batch.status)}
        {batch.checkpoint && typeof batch.checkpoint.offset === "number"
          ? `, ${batch.checkpoint.offset} rows so far`
          : ""}
      </span>
      <span className="text-xms-label ml-auto text-[12px]">refreshes every 10 seconds</span>
    </div>
  );
}

/** The batch's properties, label left (Wireframes v2 section 4). */
export function BatchProperties({ batch, accountName }: { batch: BatchDetail; accountName?: string }) {
  const instanceId = text(batch.source_ref.instance_id);
  const fieldMap = text(batch.map_versions.field_map_id);
  const stateMap = text(batch.map_versions.state_map_id);
  const rows: { label: string; value: ReactNode; mono?: boolean }[] = [
    { label: "Account", value: <span className="xms-account">{accountName ?? batch.account_id.slice(0, 8)}</span> },
    { label: "Objects", value: objectKindLabel(batch.object_kind) },
    {
      label: "Source",
      value: instanceId ? (
        <Link href={`/admin/connectors/${instanceId}`} className="text-xms-accent">
          {describeSource(batch)}
        </Link>
      ) : (
        describeSource(batch)
      ),
    },
    { label: "Range", value: describeRange(batch.source_range), mono: true },
    { label: "Mode", value: <DryRunPill dryRun={batch.dry_run} /> },
    {
      label: "Maps",
      value: (
        <span className="xms-mono text-[12px]">
          field {fieldMap ? fieldMap.slice(0, 8) : "none"}, state {stateMap ? stateMap.slice(0, 8) : "none"}
        </span>
      ),
    },
    { label: "Run by", value: batch.run_by_name ?? "" },
    { label: "Started", value: formatDate(batch.started_at), mono: true },
    { label: "Finished", value: formatDate(batch.finished_at), mono: true },
    {
      label: "Supersedes",
      value: batch.supersedes_batch_id ? (
        <Link href={`/admin/migration/${batch.supersedes_batch_id}`} className="text-xms-accent xms-mono">
          {batch.supersedes_batch_id.slice(0, 8)}
        </Link>
      ) : (
        ""
      ),
    },
  ];
  return (
    <Panel title="Properties" caption={`version ${batch.version}`}>
      <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2 text-[13px]">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="text-xms-label text-[12px]">{row.label}</dt>
            <dd className={row.mono ? "xms-mono text-xms-ink" : "text-xms-ink"}>{row.value}</dd>
          </div>
        ))}
      </dl>
      {batch.error ? (
        <p role="alert" className="mt-3 text-[12px] text-[color:var(--state-overdue-text)]" data-batch-error>
          {batch.error}
        </p>
      ) : null}
    </Panel>
  );
}

/** The Log tab: the run's log lines, newest last, with the failure reason when there is one. */
export function LogTab({ batch }: { batch: BatchDetail }) {
  return (
    <Panel title="Log" caption={`${batch.log.length} lines`}>
      {batch.log.length === 0 ? <p className="text-xms-label text-[13px]">Nothing logged yet. Run the batch.</p> : null}
      <ol className="flex flex-col gap-1" aria-label="Log lines">
        {batch.log.map((entry, index) => (
          <li key={`${entry.at}-${index}`} className="flex gap-3 text-[13px]">
            <span className="xms-mono text-xms-label shrink-0 text-[12px]">{formatDate(entry.at)}</span>
            <span className="text-xms-ink">{entry.message}</span>
          </li>
        ))}
      </ol>
      {batch.error ? (
        <p className="mt-3 text-[13px] text-[color:var(--state-overdue-text)]">Failed: {batch.error}</p>
      ) : null}
    </Panel>
  );
}
