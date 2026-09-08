"use client";

import { useState } from "react";
import { INPUT, InlineError, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { useToast } from "@/components/xms/toast";
import { capacityError, describeCapacityError, type ImportProblem } from "@/lib/capacity/errors";
import { DEMAND_TEMPLATE_COLUMNS, DEMAND_TEMPLATE_EXAMPLE } from "@/lib/capacity/vocab";
import { useTrack } from "@/lib/telemetry/provider";
import { cn } from "@/lib/utils";
import { useImportDemandMutation } from "@/redux/capacityApi";

/**
 * Import demand from the spreadsheet template as CSV text (functional
 * 5.7): paste it or pick a file (read in the browser as text), see the
 * columns the template takes, and get every problem back per line when
 * the server refuses the file; unknown account keys are named. Nothing
 * imports until the file is clean.
 */
export function ImportDemandPanel() {
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [problems, setProblems] = useState<ImportProblem[]>([]);
  const [importDemand, { isLoading }] = useImportDemandMutation();
  const { push } = useToast();
  const track = useTrack("capacity.demand.import");

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setContent(await file.text());
    setProblem(null);
    setProblems([]);
  };

  const submit = async () => {
    setProblem(null);
    setProblems([]);
    if (content.trim() === "") {
      setProblem("Paste the template or pick a file first.");
      return;
    }
    try {
      const result = await importDemand({ content }).unwrap();
      track({ rows: result.imported });
      push({
        title: `Imported ${result.imported} line${result.imported === 1 ? "" : "s"}`,
        detail: fileName ?? "From the pasted text.",
        tone: "success",
      });
      setContent("");
      setFileName(null);
    } catch (caught) {
      const error = capacityError(caught);
      setProblem(describeCapacityError(error));
      if (error.code === "invalid_import") setProblems(error.problems ?? []);
    }
  };

  return (
    <Panel
      title="Import CSV"
      caption="Import"
      subtitle="The spreadsheet template as CSV, with a header row naming the columns in any order."
    >
      <form
        className="flex flex-col gap-3 text-[12px]"
        aria-label="Import demand"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <p className="text-xms-body">
          Columns:{" "}
          <span className="xms-mono text-xms-ink" data-template-columns>
            {DEMAND_TEMPLATE_COLUMNS.join(", ")}
          </span>
          . Source is pipeline or project; name an account key or a prospect; month as YYYY-MM; probability as a
          fraction or a percent, left blank for project lines.
        </p>
        <textarea
          aria-label="CSV content"
          className={cn(INPUT, "xms-mono h-[140px] resize-y py-2 text-[12px]")}
          value={content}
          placeholder={DEMAND_TEMPLATE_EXAMPLE}
          onChange={(event) => {
            setContent(event.target.value);
            setFileName(null);
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <label className={cn(SECONDARY_BUTTON, "flex cursor-pointer items-center")}>
            {fileName ? `File: ${fileName}` : "Pick a file"}
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              aria-label="CSV file"
              className="sr-only"
              onChange={(event) => void pick(event.target.files?.[0])}
            />
          </label>
          <button type="submit" className={PRIMARY_BUTTON} disabled={isLoading}>
            {isLoading ? "Importing" : "Import"}
          </button>
        </div>
        <InlineError message={problem} />
        {problems.length > 0 ? (
          <ul className="divide-xms-line divide-y rounded-[4px] border border-[color:var(--state-overdue-border)]" aria-label="Import problems">
            {problems.map((row, index) => (
              <li key={`${row.line}:${index}`} className="flex gap-3 px-3 py-1.5" data-problem-line={row.line}>
                <span className="xms-mono text-xms-label w-[64px] shrink-0">{row.line === 0 ? "file" : `line ${row.line}`}</span>
                <span className="text-[color:var(--state-overdue-text)]">{row.problem}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </form>
    </Panel>
  );
}
