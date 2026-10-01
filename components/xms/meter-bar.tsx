import { cn } from "@/lib/utils";

export interface PauseSegment {
  /** Percent of the bar where the pause starts and ends (0 to 100). */
  startPct: number;
  endPct: number;
}

export interface MeterBarProps {
  /** Elapsed share of the window, 0 to 100; over 100 renders full and breached. */
  percent: number;
  pauses?: PauseSegment[];
  breached?: boolean;
  /**
   * The target was met: a clock that stopped inside its window, or attainment
   * at or above target. Drawn on the `complete` trio. Without it a met clock
   * fills to 100, lands in the at-risk band and a healthy ticket reads as a
   * warning; amber is the at-risk signal only (frontend review finding 11,
   * Design System section 3.2).
   */
  met?: boolean;
  paused?: boolean;
  label?: string;
  className?: string;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function fillColorOf(fill: number, { breached, met }: Pick<MeterBarProps, "breached" | "met">): string {
  if (breached) return "var(--state-overdue-text)";
  if (met) return "var(--state-complete-text)";
  if (fill >= 75) return "var(--xms-sla-warn)";
  return "var(--xms-accent)";
}

/** SLA meter with grey pause segments over the elapsed fill (Wireframes v2 section 3.2). */
export function MeterBar({ percent, pauses = [], breached, met, paused, label, className }: MeterBarProps) {
  const fill = clamp(percent);
  const fillColor = fillColorOf(fill, { breached, met });
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label ? <span className="text-xms-label text-body">{label}</span> : null}
      <div
        role="progressbar"
        aria-valuenow={Math.round(fill)}
        aria-valuemin={0}
        aria-valuemax={100}
        data-breached={breached ? "true" : undefined}
        data-met={met && !breached ? "true" : undefined}
        data-paused={paused ? "true" : undefined}
        // The track is the row hairline grey, which is what the prototype
        // draws behind every meter; on the blue tint a blue fill barely read
        // as a fill at all.
        className="bg-xms-line-row relative h-2 w-full overflow-hidden rounded-pill"
      >
        <div className="absolute inset-y-0 left-0 rounded-pill" style={{ width: `${fill}%`, background: fillColor }} />
        {pauses.map((segment) => (
          <div
            key={`${segment.startPct}:${segment.endPct}`}
            data-pause
            className="absolute inset-y-0"
            style={{
              left: `${clamp(segment.startPct)}%`,
              width: `${clamp(segment.endPct) - clamp(segment.startPct)}%`,
              background: "var(--xms-sla-paused)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
