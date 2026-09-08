"use client";

import Link from "next/link";
import { Panel } from "@/components/xms/panel";
import { SignalPill } from "@/components/xms/signal-pill";
import { demandFilterToSearch } from "@/lib/capacity/filters";
import { addMonths, DEMAND_SOURCE, demandSubject, formatProbability, monthLabel, weightedMinutes } from "@/lib/capacity/vocab";
import { formatHours } from "@/lib/time/budget";
import { cn } from "@/lib/utils";
import type { CapacityView } from "@/redux/capacityApi";

export interface DemandOverlayProps {
  view: CapacityView;
  /** "YYYY-MM": the month the view was read for, carried into the demand screen's link. */
  month: string;
}

export interface OverlaySegments {
  allocated: number;
  pipeline: number;
  project: number;
  /** The bar's full width in minutes: whatever is larger, the available hours or everything stacked. */
  scale: number;
}

/** The stacked bar's segments as percentages of the scale, two decimals. */
export function overlayWidths(segments: OverlaySegments): Record<"allocated" | "pipeline" | "project", string> {
  const percent = (minutes: number) => (segments.scale > 0 ? `${(Math.round((minutes / segments.scale) * 10000) / 100).toFixed(2)}%` : "0%");
  return { allocated: percent(segments.allocated), pipeline: percent(segments.pipeline), project: percent(segments.project) };
}

const SEGMENT_CLASS = {
  allocated: "bg-xms-accent",
  pipeline: "bg-xms-accent-border",
  project: "bg-xms-accent-tint-strong",
} as const;

/**
 * The demand overlay under the month grid (functional 5.7, CAP-08): the
 * allocated hours, the weighted pipeline and the committed project demand
 * stacked against the available hours, the four figures beside it, and the
 * subjects behind the demand. Every minute is the server's.
 */
export function DemandOverlay({ view, month }: DemandOverlayProps) {
  const demand = view.demand;
  const totals = view.totals;
  const label = monthLabel(view.month);
  const segments: OverlaySegments = {
    allocated: totals.allocated_minutes,
    pipeline: demand.pipeline_minutes_weighted,
    project: demand.project_minutes,
    scale: Math.max(totals.available_minutes, totals.allocated_minutes + demand.total_minutes, 1),
  };
  const widths = overlayWidths(segments);
  const description = `Allocated ${formatHours(segments.allocated)}, pipeline ${formatHours(segments.pipeline)} weighted, project ${formatHours(segments.project)}, against ${formatHours(totals.available_minutes)} available`;

  return (
    <Panel
      title="Demand this month"
      caption="Demand"
      subtitle="Weighted pipeline and committed project demand stacked on the allocated hours; the lighter shades are the demand."
    >
      <div className="flex flex-col gap-3 text-[12px]" data-testid="demand-overlay">
        {demand.by_subject.length === 0 && demand.total_minutes === 0 ? (
          <p className="text-xms-label">
            No demand entered for {label}.{" "}
            <Link href={`/capacity/demand${demandFilterToSearch({ from: month, to: addMonths(month, 3) }, "")}`} className="text-xms-accent">
              Enter demand
            </Link>
          </p>
        ) : (
          <>
            <div
              role="img"
              aria-label={description}
              className="bg-xms-tint flex h-[14px] w-full overflow-hidden rounded-[3px]"
              title={description}
            >
              {(["allocated", "pipeline", "project"] as const).map((key) => (
                <span
                  key={key}
                  data-segment={key}
                  className={cn("h-full", SEGMENT_CLASS[key])}
                  style={{ width: widths[key] }}
                />
              ))}
            </div>
            <dl className="flex flex-wrap gap-x-6 gap-y-1">
              <div className="flex items-center gap-2">
                <span className={cn("inline-block h-[10px] w-[10px] rounded-[2px]", SEGMENT_CLASS.allocated)} aria-hidden />
                <dt className="text-xms-label">Allocated</dt>
                <dd className="xms-mono text-xms-ink font-semibold" data-overlay-allocated>
                  {formatHours(segments.allocated)}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("inline-block h-[10px] w-[10px] rounded-[2px]", SEGMENT_CLASS.pipeline)} aria-hidden />
                <dt className="text-xms-label">Pipeline, weighted</dt>
                <dd className="xms-mono text-xms-ink font-semibold" data-overlay-pipeline>
                  {formatHours(segments.pipeline)}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("inline-block h-[10px] w-[10px] rounded-[2px]", SEGMENT_CLASS.project)} aria-hidden />
                <dt className="text-xms-label">Project</dt>
                <dd className="xms-mono text-xms-ink font-semibold" data-overlay-project>
                  {formatHours(segments.project)}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="text-xms-label">Total demand</dt>
                <dd className="xms-mono text-xms-ink font-semibold" data-overlay-total>
                  {formatHours(demand.total_minutes)}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="text-xms-label">Available</dt>
                <dd className="xms-mono text-xms-ink font-semibold" data-overlay-available>
                  {formatHours(totals.available_minutes)}
                </dd>
              </div>
            </dl>
            <p
              className={cn(
                "text-[12px]",
                demand.total_minutes > totals.remaining_minutes ? "text-[color:var(--state-overdue-text)]" : "text-xms-body",
              )}
              data-overlay-verdict
            >
              {formatHours(demand.total_minutes)} of demand against {formatHours(totals.remaining_minutes)} remaining in {label}.
            </p>
            <ul className="flex flex-wrap gap-2" aria-label="Demand by subject">
              {demand.by_subject.map((row, index) => (
                <li
                  key={`${row.account_id ?? row.prospect_name}:${index}`}
                  className="border-xms-line flex items-center gap-2 rounded-[4px] border px-2 py-1"
                  data-subject={demandSubject(row)}
                >
                  <span className={cn("text-xms-ink font-medium", row.account_key && "xms-mono")}>{demandSubject(row)}</span>{" "}
                  <SignalPill tone={DEMAND_SOURCE[row.source].tone} label={DEMAND_SOURCE[row.source].label} />{" "}
                  <span className="xms-mono text-xms-body">
                    {row.source === "project"
                      ? formatHours(row.hours * 60)
                      : `${formatHours(row.hours * 60)} at ${formatProbability(row.probability)}, ${formatHours(weightedMinutes(row))} weighted`}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Panel>
  );
}
