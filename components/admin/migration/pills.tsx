import { SignalPill } from "@/components/xms/signal-pill";
import {
  LINE_STATUS_LABEL,
  REPORT_STATUS_LABEL,
  batchStatusLabel,
  batchStatusTone,
  lineStatusTone,
  recordStatusLabel,
  recordStatusTone,
  reportStatusTone,
} from "@/lib/migration/vocab";
import type { BatchStatus, LineStatus, RecordStatus, ReportStatus } from "@/redux/migrationApi";

/** Migration statuses are signals, never ticket states, so they sit on the `--state-*` trios. */
export function BatchStatusPill({ status, title }: { status: BatchStatus; title?: string }) {
  return <SignalPill tone={batchStatusTone(status)} label={batchStatusLabel(status)} title={title} />;
}

export function RecordStatusPill({ status }: { status: RecordStatus }) {
  return <SignalPill tone={recordStatusTone(status)} label={recordStatusLabel(status)} />;
}

export function LineStatusPill({ status }: { status: LineStatus }) {
  return <SignalPill tone={lineStatusTone(status)} label={LINE_STATUS_LABEL[status]} />;
}

export function ReportStatusPill({ status }: { status: ReportStatus }) {
  return <SignalPill tone={reportStatusTone(status)} label={REPORT_STATUS_LABEL[status]} />;
}

/** Dry runs are marked so a rehearsal never reads as a load. */
export function DryRunPill({ dryRun }: { dryRun: boolean }) {
  return dryRun ? <SignalPill tone="needs-input" label="Dry run" /> : <SignalPill tone="ready" label="Real run" />;
}
