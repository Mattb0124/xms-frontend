import { cn } from "@/lib/utils";

export interface ToolCallRowProps {
  tool: string;
  /** Rendered verbatim, e.g. `ci="HFM PROD"`. Callers pass identifiers only, never ticket text. */
  args?: string;
  result?: string;
  status?: "running" | "done" | "failed";
  className?: string;
}

/** Mono tool-call line in the Axel panel: search_solutions(ci="HFM PROD") → 3 results. */
export function ToolCallRow({ tool, args = "", result, status = "done", className }: ToolCallRowProps) {
  return (
    <div className={cn("xms-mono text-xms-label flex items-center gap-2 text-[12px]", className)} data-status={status}>
      <span className="text-xms-ai-accent">{status === "running" ? "…" : status === "failed" ? "✕" : "›"}</span>
      <span className="text-xms-body">
        {tool}({args})
      </span>
      {result ? (
        <>
          <span>→</span>
          <span>{result}</span>
        </>
      ) : null}
    </div>
  );
}
