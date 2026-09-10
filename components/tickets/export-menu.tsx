"use client";

import { useState } from "react";
import { SECONDARY_BUTTON } from "@/components/admin/primitives";
import { useToast } from "@/components/xms/toast";
import { downloadFile, DownloadError } from "@/lib/exports/download";
import { useTrack } from "@/lib/telemetry/provider";
import { exportUrl, paramsToExportSpec } from "@/lib/tickets/export-conditions";
import type { TicketListParams } from "@/lib/tickets/queue-views";
import { cn } from "@/lib/utils";

export type ExportFormat = "xlsx" | "csv";

/**
 * The Queue's Export action (Dashboards functional 5.10, P2.11.4): Excel or
 * CSV of the rows behind the current view and chips. The file is fetched
 * with the bearer and saved through an object URL; the toast carries the
 * row count the API reported.
 */
export function ExportMenu({
  params,
  className,
  label = "Export",
}: {
  params: TicketListParams;
  className?: string;
  /** The trigger word; the selection bar and the card header both say Export. */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const { push } = useToast();
  const track = useTrack("export.run");

  const run = async (format: ExportFormat) => {
    setOpen(false);
    setBusy(format);
    const spec = paramsToExportSpec(params);
    try {
      const file = await downloadFile({
        url: exportUrl(format, spec),
        fallbackName: `tickets.${format}`,
      });
      track({ format, rows: file.rowCount ?? -1, conditions: spec.conditions.conditions.length });
      push({
        title:
          file.rowCount === null ? "Export ready" : `Exported ${file.rowCount} row${file.rowCount === 1 ? "" : "s"}`,
        detail: [file.fileName, ...spec.notes].join(". "),
        tone: "success",
      });
    } catch (error) {
      const detail =
        error instanceof DownloadError
          ? error.code === "invalid_conditions"
            ? "The current filters cannot be exported."
            : `The export failed (${error.status}).`
          : "The export failed.";
      push({ title: "Export not produced", detail, tone: "error" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <span className={cn("relative inline-flex", className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy !== null}
        onClick={() => setOpen((value) => !value)}
        className={SECONDARY_BUTTON}
      >
        {busy ? "Exporting" : label}
      </button>
      {open ? (
        <ul
          role="menu"
          aria-label="Export format"
          className="border-xms-line bg-xms-card absolute top-full right-0 z-20 mt-1 min-w-[160px] rounded-[6px] border py-1 shadow-lg"
        >
          <li role="none">
            <button
              type="button"
              role="menuitem"
              onClick={() => void run("xlsx")}
              className="text-xms-ink hover:bg-xms-control-hover block w-full px-3 py-2 text-left text-[13px]"
            >
              Excel (.xlsx)
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              onClick={() => void run("csv")}
              className="text-xms-ink hover:bg-xms-control-hover block w-full px-3 py-2 text-left text-[13px]"
            >
              CSV
            </button>
          </li>
        </ul>
      ) : null}
    </span>
  );
}
