import { cn } from "@/lib/utils";

export type SuggestionCapability =
  | "categorise"
  | "prioritise"
  | "duplicate"
  | "summarise"
  | "draft"
  | "similar"
  | "narrative"
  | "time_nudge"
  | "anomaly";

export interface SuggestionCardProps {
  capability: SuggestionCapability;
  title: string;
  body: string;
  /** Confidence 0 to 1; rendered as a mono percentage. */
  confidence?: number;
  onAccept: () => void;
  onReject: () => void;
  onEdit?: () => void;
  className?: string;
}

/** Axel suggestion on the violet family. Nothing applies without a click; every decision lands in Activity. */
export function SuggestionCard({
  capability,
  title,
  body,
  confidence,
  onAccept,
  onReject,
  onEdit,
  className,
}: SuggestionCardProps) {
  return (
    <article className={cn("xms-ai flex flex-col gap-2 p-3 text-[14px]", className)} data-capability={capability}>
      <header className="flex items-center gap-2">
        <span className="xms-caption text-xms-ai-accent">{capability.replace("_", " ")}</span>
        {typeof confidence === "number" ? (
          <span className="xms-mono text-xms-label ml-auto text-[14px]">{Math.round(confidence * 100)}%</span>
        ) : null}
      </header>
      <p className="text-xms-ink font-medium">{title}</p>
      <p className="text-xms-body">{body}</p>
      <footer className="flex items-center gap-2">
        <button
          type="button"
          onClick={onAccept}
          className="bg-xms-accent hover:bg-xms-accent-hover h-[28px] rounded-[4px] px-3 text-[14px] font-medium text-white"
        >
          Accept
        </button>
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="border-xms-ai-border text-xms-body h-[28px] rounded-[4px] border px-3 text-[14px]"
          >
            Edit
          </button>
        ) : null}
        <button
          type="button"
          onClick={onReject}
          className="border-xms-ai-border text-xms-body h-[28px] rounded-[4px] border px-3 text-[14px]"
        >
          Reject
        </button>
      </footer>
    </article>
  );
}
