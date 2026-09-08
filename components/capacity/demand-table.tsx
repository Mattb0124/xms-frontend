"use client";

import { ConfirmButton } from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { SignalPill } from "@/components/xms/signal-pill";
import { DEMAND_SOURCE, demandSubject, formatProbability, monthLabel, weightedMinutes } from "@/lib/capacity/vocab";
import { roleLabel } from "@/lib/roster/vocab";
import { formatHours } from "@/lib/time/budget";
import { cn } from "@/lib/utils";
import type { DemandList, DemandRow, DemandSource } from "@/redux/capacityApi";

export interface DemandTableProps {
  list: DemandList;
  /** capacity:manage: Remove appears on every row. */
  canManage: boolean;
  onRemove: (row: DemandRow) => void | Promise<void>;
  removing?: string | null;
}

export function SourcePill({ source }: { source: DemandSource }) {
  const { label, tone } = DEMAND_SOURCE[source];
  return <SignalPill tone={tone} label={label} />;
}

const HEAD = "text-xms-ink px-3 py-2 text-left text-[13px] font-semibold whitespace-nowrap";
const CELL = "text-xms-ink px-3 align-middle";

/**
 * The demand lines over the range (functional 5.7): the source, the
 * subject (account key or prospect), the month, the hours, the
 * probability for pipeline lines, the weighted hours, the role and the
 * note, with the server's totals beneath and Remove under capacity:manage.
 */
export function DemandTable({ list, canManage, onRemove, removing }: DemandTableProps) {
  const columns = canManage ? 9 : 8;
  return (
    <Panel
      title="Demand"
      caption="Lines"
      subtitle={`${monthLabel(list.from)} to ${monthLabel(list.to)}, ${list.rows.length} line${list.rows.length === 1 ? "" : "s"} with the weighted hours.`}
      flush
    >
      <table className="w-full border-collapse text-[13px]" aria-label="Demand lines">
        <thead className="bg-xms-card sticky top-0 z-10">
          <tr className="border-xms-line border-b">
            <th className={HEAD}>Source</th>
            <th className={HEAD}>Subject</th>
            <th className={HEAD}>Month</th>
            <th className={cn(HEAD, "text-right")}>Hours</th>
            <th className={cn(HEAD, "text-right")}>Probability</th>
            <th className={cn(HEAD, "text-right")}>Weighted</th>
            <th className={HEAD}>Role</th>
            <th className={HEAD}>Note</th>
            {canManage ? <th className={HEAD} /> : null}
          </tr>
        </thead>
        <tbody>
          {list.rows.map((row) => (
            <tr key={row.id} className="border-xms-line hover:bg-xms-row-hover h-[40px] border-b" data-demand={row.id}>
              <td className={CELL}>
                <SourcePill source={row.source} />
              </td>
              <td className={cn(CELL, row.account_key && "xms-mono")} data-subject>
                {demandSubject(row)}
                {row.prospect_name ? <span className="text-xms-label ml-2 text-[11px]">prospect</span> : null}
              </td>
              <td className={cn(CELL, "whitespace-nowrap")} data-month>
                {monthLabel(row.period_month)}
              </td>
              <td className={cn(CELL, "xms-mono text-right")} data-hours>
                {formatHours(row.hours * 60)}
              </td>
              <td className={cn(CELL, "xms-mono text-right")} data-probability>
                {row.source === "project" ? "" : formatProbability(row.probability)}
              </td>
              <td className={cn(CELL, "xms-mono text-right")} data-weighted>
                {formatHours(weightedMinutes(row))}
              </td>
              <td className={CELL} data-role>
                {roleLabel(row.role)}
              </td>
              <td className={cn(CELL, "text-xms-body max-w-[280px] truncate text-[12px]")} title={row.note} data-note>
                {row.note}
              </td>
              {canManage ? (
                <td className={cn(CELL, "text-right")}>
                  <ConfirmButton
                    label="Remove"
                    danger
                    disabled={removing === row.id}
                    className="h-[26px] px-2 text-[12px]"
                    onConfirm={() => onRemove(row)}
                  />
                </td>
              ) : null}
            </tr>
          ))}
          {list.rows.length === 0 ? (
            <tr>
              <td colSpan={columns} className="text-xms-label px-4 py-8 text-center">
                No demand in this range.
              </td>
            </tr>
          ) : null}
        </tbody>
        <tfoot>
          <tr className="text-xms-ink text-[12px] font-semibold" data-testid="demand-totals">
            <td className="px-3 py-2" colSpan={3}>
              Total
            </td>
            <td className="xms-mono px-3 py-2 text-right whitespace-nowrap" colSpan={2} data-total-pipeline>
              {formatHours(list.totals.pipeline_minutes_weighted)} pipeline, weighted
            </td>
            <td className="xms-mono px-3 py-2 text-right whitespace-nowrap" data-total-project>
              {formatHours(list.totals.project_minutes)} project
            </td>
            <td className="xms-mono px-3 py-2 whitespace-nowrap" colSpan={columns - 6} data-total>
              {formatHours(list.totals.total_minutes)} in all
            </td>
          </tr>
        </tfoot>
      </table>
    </Panel>
  );
}
