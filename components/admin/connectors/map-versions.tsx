"use client";

import { MapStatePill } from "@/components/admin/connectors/pills";
import { formatDate } from "@/components/admin/primitives";
import { cn } from "@/lib/utils";
import type { MapRow, ValidationReport } from "@/redux/connectorsApi";

export function MapVersions<E>({
  rows,
  selectedId,
  onSelect,
}: {
  rows: MapRow<E>[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const ordered = [...rows].sort((a, b) => b.version - a.version);
  if (ordered.length === 0) return <p className="text-xms-label text-[13px]">No versions yet. Create a draft.</p>;
  return (
    <ul className="divide-xms-line divide-y" aria-label="Versions">
      {ordered.map((row) => {
        const selected = row.id === selectedId;
        return (
          <li key={row.id}>
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(row.id)}
              className={cn(
                "hover:bg-xms-row-hover flex w-full flex-wrap items-center gap-2 px-2 py-2 text-left text-[13px]",
                selected && "bg-xms-tint shadow-[inset_3px_0_0_var(--xms-accent)]",
              )}
            >
              <span className="xms-mono text-xms-ink font-medium">v{row.version}</span>
              <MapStatePill state={row.state} />
              <span className="xms-mono text-xms-muted ml-auto text-[11px]">
                {row.activated_at
                  ? `active since ${formatDate(row.activated_at)}`
                  : `created ${formatDate(row.created_at)}`}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** The validation report as the administrator sees it: problems block activation, warnings do not. */
export function ValidationReportView({ report }: { report: ValidationReport | null }) {
  if (!report) return <p className="text-xms-label text-[12px]">Not validated yet.</p>;
  return (
    <div className="flex flex-col gap-2 text-[12px]" data-report-ok={report.ok ? "true" : "false"}>
      <p
        className={cn(
          "font-medium",
          report.ok ? "text-[color:var(--state-complete-text)]" : "text-[color:var(--state-overdue-text)]",
        )}
      >
        {report.ok ? "Valid" : `${report.problems.length} problem${report.problems.length === 1 ? "" : "s"}`}, checked{" "}
        {report.checked_samples} sample{report.checked_samples === 1 ? "" : "s"}
      </p>
      {report.problems.length > 0 ? (
        <ul aria-label="Problems" className="flex flex-col gap-1">
          {report.problems.map((problem) => (
            <li
              key={problem}
              className="rounded-[4px] border border-[color:var(--state-overdue-border)] bg-[color:var(--state-overdue-bg)] px-2 py-1 text-[color:var(--state-overdue-text)]"
            >
              {problem}
            </li>
          ))}
        </ul>
      ) : null}
      {report.warnings.length > 0 ? (
        <ul aria-label="Warnings" className="flex flex-col gap-1">
          {report.warnings.map((warning) => (
            <li
              key={warning}
              className="rounded-[4px] border border-[color:var(--state-needs-input-border)] bg-[color:var(--state-needs-input-bg)] px-2 py-1 text-[color:var(--state-needs-input-text)]"
            >
              {warning}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
