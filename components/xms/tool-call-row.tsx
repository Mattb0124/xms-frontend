import { cn } from "@/lib/utils";

export interface ToolCallRowProps {
  tool: string;
  /** Rendered verbatim, e.g. `ci="HFM PROD"`. Callers pass identifiers only, never ticket text. */
  args?: string;
  result?: string;
  status?: "running" | "done" | "failed";
  className?: string;
}

const STATUS_GLYPH: Record<NonNullable<ToolCallRowProps["status"]>, string> = {
  running: "…",
  done: "›",
  failed: "✕",
};

/** Mono tool-call line in the Axel panel: search_solutions(ci="HFM PROD") → 3 results. */
export function ToolCallRow({ tool, args = "", result, status = "done", className }: ToolCallRowProps) {
  return (
    <div className={cn("xms-mono text-xms-label flex items-center gap-2 text-body", className)} data-status={status}>
      <span className="text-xms-ai-accent">{STATUS_GLYPH[status]}</span>
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
