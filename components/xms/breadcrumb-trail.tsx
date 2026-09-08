import { cn } from "@/lib/utils";

export interface TrailSegment {
  key: string;
  label: string;
}

export interface BreadcrumbTrailProps {
  segments: TrailSegment[];
  /** Clicking a segment removes that criterion (Wireframes v2 section 2). */
  onRemove?: (key: string) => void;
  onSaveView?: () => void;
  /** The current view is already starred, so the control reads Saved. */
  saved?: boolean;
  className?: string;
}

/**
 * The condition trail under the tool strip: "All open", or "All › My group ›
 * Open" once the list is narrowed, with Save as view on the right.
 *
 * The whole line is blue. Every segment removes its own criterion, so every
 * segment is interactive, and blue is what interactive means here (hand-off
 * rule 2); the line was drawn in body grey with only the control blue, which
 * read as a caption rather than as a set of things a reader can take off.
 * The last segment is the list as it stands and takes the stronger link
 * colour at 500, which is the same weight the render draws it in.
 */
export function BreadcrumbTrail({ segments, onRemove, onSaveView, saved, className }: BreadcrumbTrailProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 text-[13px]", className)} data-testid="condition-trail">
      <nav aria-label="Condition trail" className="flex flex-wrap items-center gap-[6px]">
        {segments.map((segment, index) => (
          <span key={segment.key} className="flex items-center gap-[6px]">
            {index > 0 ? <span className="text-xms-placeholder">›</span> : null}
            <button
              type="button"
              onClick={() => onRemove?.(segment.key)}
              aria-label={`Remove ${segment.label}`}
              aria-current={index === segments.length - 1 ? "page" : undefined}
              className={cn(
                "hover:underline",
                index === segments.length - 1 ? "text-xms-accent-hover font-medium" : "text-xms-accent",
              )}
            >
              {segment.label}
            </button>
          </span>
        ))}
      </nav>
      <span className="ml-auto flex items-center gap-3">
        {onSaveView ? (
          <button
            type="button"
            onClick={onSaveView}
            aria-pressed={Boolean(saved)}
            className="text-xms-accent font-medium hover:underline"
          >
            {saved ? "Saved" : "Save as view"}
          </button>
        ) : null}
      </span>
    </div>
  );
}
