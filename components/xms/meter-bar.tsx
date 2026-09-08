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

/** SLA meter with grey pause segments over the elapsed fill (Wireframes v2 section 3.2). */
export function MeterBar({ percent, pauses = [], breached, met, paused, label, className }: MeterBarProps) {
  const fill = clamp(percent);
  const fillColor = breached
    ? "var(--state-overdue-text)"
    : met
      ? "var(--state-complete-text)"
      : fill >= 75
        ? "var(--xms-sla-warn)"
        : "var(--xms-accent)";
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label ? <span className="text-xms-label text-[12px]">{label}</span> : null}
      <div
        role="progressbar"
        aria-valuenow={Math.round(fill)}
        aria-valuemin={0}
        aria-valuemax={100}
        data-breached={breached ? "true" : undefined}
        data-met={met && !breached ? "true" : undefined}
        data-paused={paused ? "true" : undefined}
        className="bg-xms-tint relative h-2 w-full overflow-hidden rounded-[999px]"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-[999px]"
          style={{ width: `${fill}%`, background: fillColor }}
        />
        {pauses.map((segment, index) => (
          <div
            key={index}
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
