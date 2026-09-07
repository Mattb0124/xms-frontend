"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ReasonDialog } from "@/components/admin/connectors/reason-dialog";
import { LineStatusPill, ReportStatusPill } from "@/components/admin/migration/pills";
import { ConfirmButton, INPUT, InlineError, SECONDARY_BUTTON, formatDate } from "@/components/admin/primitives";
import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { Skeleton } from "@/components/xms/skeleton";
import { useToast } from "@/components/xms/toast";
import { describeMigrationError, migrationError } from "@/lib/migration/errors";
import { LINE_KIND_LABEL, REPORT_SCOPES, formatDelta } from "@/lib/migration/vocab";
import { useTrack } from "@/lib/telemetry/provider";
import { cn } from "@/lib/utils";
import {
  useExplainLineMutation,
  useListReportsQuery,
  useSignOffReportMutation,
  type ReconciliationReport,
  type ReportLine,
} from "@/redux/migrationApi";

interface IndexedLine extends ReportLine {
  index: number;
}

/** Why the Sign off button is off, in the spec's words; null when the report may be signed. */
export function signOffBlockedReason(report: ReconciliationReport): string | null {
  if (report.status === "signed_off") return "Signed off.";
  if (report.lines.some((line) => line.status === "delta_open"))
    return "Every line must be matched or explained before the report can be signed.";
  return null;
}

function ReportPanel({ report, current }: { report: ReconciliationReport; current: boolean }) {
  const [explain, explainState] = useExplainLineMutation();
  const [signOff, signState] = useSignOffReportMutation();
  const { push } = useToast();
  const trackExplain = useTrack("migration.report.explain");
  const trackSign = useTrack("migration.report.sign_off");
  const [explaining, setExplaining] = useState<IndexedLine | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const frozen = report.status === "signed_off";
  const blocked = signOffBlockedReason(report);

  const lines: IndexedLine[] = report.lines.map((line, index) => ({ ...line, index }));
  const columns: DenseColumn<IndexedLine>[] = [
    { key: "kind", title: "Kind", sortValue: (row) => row.kind, render: (row) => LINE_KIND_LABEL[row.kind] },
    { key: "subject", title: "Subject", mono: true, sortValue: (row) => row.subject },
    { key: "source", title: "Source", mono: true, align: "right", sortValue: (row) => row.source_figure },
    { key: "target", title: "Target", mono: true, align: "right", sortValue: (row) => row.target_figure },
    {
      key: "delta",
      title: "Delta",
      mono: true,
      align: "right",
      sortValue: (row) => row.delta,
      render: (row) => (
        <span
          className={cn(row.status === "delta_open" && "font-semibold text-[color:var(--state-overdue-text)]")}
          data-delta={row.delta}
        >
          {formatDelta(row.delta)}
        </span>
      ),
    },
    {
      key: "status",
      title: "Status",
      sortValue: (row) => row.status,
      render: (row) => <LineStatusPill status={row.status} />,
    },
    {
      key: "explanation",
      title: "Explanation",
      sortValue: (row) => row.explanation ?? "",
      render: (row) =>
        row.explanation ? (
          <span className="block max-w-[360px] truncate" title={row.explanation}>
            {row.explanation}
            {row.explained_by ? (
              <span className="xms-mono text-xms-label ml-2 text-[11px]">
                {row.explained_by.slice(0, 8)} {formatDate(row.explained_at)}
              </span>
            ) : null}
          </span>
        ) : (
          ""
        ),
    },
    {
      key: "actions",
      title: "",
      render: (row) =>
        row.status === "delta_open" && !frozen ? (
          <button
            type="button"
            className={cn(SECONDARY_BUTTON, "h-[26px] px-2 text-[12px]")}
            onClick={() => setExplaining(row)}
            data-explain={row.index}
          >
            Explain
          </button>
        ) : null,
    },
  ];

  const onExplain = async (explanation: string) => {
    if (!explaining) return;
    setProblem(null);
    try {
      await explain({ id: report.id, line: explaining.index, explanation, version: report.version }).unwrap();
      trackExplain({ report_id: report.id, line: explaining.index });
      setExplaining(null);
    } catch (caught) {
      setProblem(describeMigrationError(migrationError(caught)));
      setExplaining(null);
    }
  };

  const onSignOff = async () => {
    setProblem(null);
    try {
      const signed = await signOff({ id: report.id, version: report.version }).unwrap();
      trackSign({ report_id: report.id, lines: signed.lines.length });
      push({ title: "Signed off", detail: "The report is frozen and its snapshot stored.", tone: "success" });
    } catch (caught) {
      setProblem(describeMigrationError(migrationError(caught)));
    }
  };

  const scopeLabel = REPORT_SCOPES.find((scope) => scope.value === report.scope)?.label ?? report.scope;
  const caption =
    report.status === "signed_off"
      ? `Signed by ${report.signed_by?.slice(0, 8) ?? "unknown"} ${formatDate(report.signed_at)}`
      : `Created ${formatDate(report.created_at)}, version ${report.version}`;
  return (
    <section aria-label={`${scopeLabel} report`} data-report={report.id} data-current={current ? "true" : undefined}>
      <DenseTable
        title={`${scopeLabel} report`}
        count={lines.length}
        columns={columns}
        rows={lines}
        rowKey={(row) => String(row.index)}
        emptyState="No lines on this report."
        className={current ? "border-xms-accent-border" : undefined}
        search={
          <div className="flex items-center gap-3">
            {report.batch_id && !current ? (
              <Link href={`/admin/migration/${report.batch_id}`} className="text-xms-accent xms-mono text-[12px]">
                batch {report.batch_id.slice(0, 8)}
              </Link>
            ) : null}
            <ReportStatusPill status={report.status} />
            {!frozen ? (
              <ConfirmButton
                label="Sign off"
                confirmLabel="Confirm sign off"
                onConfirm={onSignOff}
                disabled={Boolean(blocked) || signState.isLoading}
              />
            ) : null}
          </div>
        }
        banner={
          <div className="border-xms-line flex flex-col gap-1 border-b px-4 py-2">
            <p className="text-xms-label text-[12px]">{caption}</p>
            {blocked && !frozen ? <p className="text-xms-label text-[12px]">{blocked}</p> : null}
            <InlineError message={problem} />
          </div>
        }
      />
      {explaining ? (
        <ReasonDialog
          title={`Explain the delta on ${explaining.subject}`}
          detail={`Source ${explaining.source_figure}, target ${explaining.target_figure}, delta ${formatDelta(explaining.delta)}. The explanation is kept with the line and audited.`}
          confirmLabel="Save explanation"
          fieldLabel="Explanation"
          maxLength={2000}
          required
          busy={explainState.isLoading}
          onClose={() => setExplaining(null)}
          onConfirm={onExplain}
        />
      ) : null}
    </section>
  );
}

/**
 * The Reconciliation view (Data Migration functional 5.2): the account's
 * reports, one panel each, lines with the delta highlighted until
 * explained, Explain on open deltas, Sign off when nothing is open. The
 * server enforces the four-eyes rule and the open-delta rule; both are
 * shown in its words when it refuses.
 */
export function ReconciliationTab({ accountId, batchId }: { accountId: string; batchId?: string }) {
  const [scope, setScope] = useState("");
  const reports = useListReportsQuery({ account_id: accountId, scope: scope || undefined });
  const ordered = useMemo(() => {
    const rows = reports.data ?? [];
    if (!batchId) return rows;
    return [...rows].sort((a, b) => Number(b.batch_id === batchId) - Number(a.batch_id === batchId));
  }, [reports.data, batchId]);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <label className="text-xms-label text-[12px]" htmlFor="report-scope">
          Scope
        </label>
        <select
          id="report-scope"
          className={cn(INPUT, "h-[28px] w-auto text-[12px]")}
          value={scope}
          onChange={(event) => setScope(event.target.value)}
        >
          <option value="">Any scope</option>
          {REPORT_SCOPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {reports.isLoading ? <Skeleton lines={4} /> : null}
      {reports.data && ordered.length === 0 ? (
        <p className="text-xms-label text-[13px]">No reconciliation report on this account yet. Run a batch.</p>
      ) : null}
      {ordered.map((report) => (
        <ReportPanel key={report.id} report={report} current={report.batch_id === batchId} />
      ))}
    </div>
  );
}
