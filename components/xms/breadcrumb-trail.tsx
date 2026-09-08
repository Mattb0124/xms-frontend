import { cn } from "@/lib/utils";

export interface TrailSegment {
  key: string;
  label: string;
}

export interface BreadcrumbTrailProps {
  segments: TrailSegment[];
  /** Clicking a segment removes that criterion (Wireframes v2 section 2). */
  onRemove?: (key: string) => void;
  count?: string;
  onSaveView?: () => void;
  /** The current view is already starred, so the control reads Saved. */
  saved?: boolean;
  className?: string;
}

export function BreadcrumbTrail({ segments, onRemove, count, onSaveView, saved, className }: BreadcrumbTrailProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 text-[12px]", className)} data-testid="condition-trail">
      <nav aria-label="Condition trail" className="flex flex-wrap items-center gap-1">
        {segments.map((segment, index) => (
          <span key={segment.key} className="flex items-center gap-1">
            {index > 0 ? <span className="text-xms-muted">›</span> : null}
            <button
              type="button"
              onClick={() => onRemove?.(segment.key)}
              aria-label={`Remove ${segment.label}`}
              className="text-xms-body hover:text-xms-accent"
            >
              {segment.label}
            </button>
          </span>
        ))}
      </nav>
      <span className="ml-auto flex items-center gap-3">
        {count ? <span className="xms-mono text-xms-label">{count}</span> : null}
        {onSaveView ? (
          <button
            type="button"
            onClick={onSaveView}
            aria-pressed={Boolean(saved)}
            className="text-xms-accent hover:underline"
          >
            {saved ? "Saved" : "Save as view"}
          </button>
        ) : null}
      </span>
    </div>
  );
}
