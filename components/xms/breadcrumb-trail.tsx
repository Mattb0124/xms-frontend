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
  className?: string;
}

export function BreadcrumbTrail({ segments, onRemove, count, onSaveView, className }: BreadcrumbTrailProps) {
  return (
    <div className={cn("flex items-center gap-2 text-[12px]", className)}>
      <nav aria-label="Condition trail" className="flex items-center gap-1">
        {segments.map((segment, index) => (
          <span key={segment.key} className="flex items-center gap-1">
            {index > 0 ? <span className="text-xms-muted">›</span> : null}
            <button
              type="button"
              onClick={() => onRemove?.(segment.key)}
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
          <button type="button" onClick={onSaveView} className="text-xms-accent hover:underline">
            Save as view
          </button>
        ) : null}
      </span>
    </div>
  );
}
