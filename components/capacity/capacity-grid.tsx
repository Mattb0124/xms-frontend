"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { SignalPill } from "@/components/xms/signal-pill";
import { useToast } from "@/components/xms/toast";
import { capacityError, describeCapacityError } from "@/lib/capacity/errors";
import { CAPACITY_STATUS, hoursTextToMinutes, minutesToHoursText, monthStart } from "@/lib/capacity/vocab";
import { roleLabel } from "@/lib/roster/vocab";
import { useTrack } from "@/lib/telemetry/provider";
import { formatHours } from "@/lib/time/budget";
import { cn } from "@/lib/utils";
import {
  usePutAllocationsMutation,
  type AllocationCellBody,
  type CapacityPerson,
  type CapacityStatus,
  type CapacityView,
} from "@/redux/capacityApi";
import type { GrantedAccount } from "@/redux/ticketsApi";

export interface CapacityGridProps {
  view: CapacityView;
  /** "YYYY-MM": the month the view was read for, named on every cell written. */
  month: string;
  /** The granted accounts (tickets:view); the grid names columns by key and offers them in Add account. */
  accounts?: GrantedAccount[];
  /** capacity:manage: cells are inputs and Save allocations appears. */
  canManage: boolean;
}

/** Drafts are keyed on person and account; the value is the cell's text in hours. */
export type CellDrafts = Record<string, string>;

export function cellKey(personId: string, accountId: string): string {
  return `${personId}:${accountId}`;
}

/** The accounts with a cell on any row, plus the ones added by hand, in the order given. */
export function presentAccounts(view: CapacityView, extra: string[]): string[] {
  const ids: string[] = [];
  for (const row of view.people)
    for (const cell of row.allocations) if (!ids.includes(cell.account_id)) ids.push(cell.account_id);
  for (const id of extra) if (!ids.includes(id)) ids.push(id);
  return ids;
}

/**
 * The cells whose draft differs from the stored value, as the PUT body
 * names them (CAP-04): the version the grid read on an existing cell so a
 * concurrent edit is refused, the note kept so the write does not erase
 * it, and 0 for a cleared cell (the server removes it).
 */
export function changedCells(view: CapacityView, month: string, drafts: CellDrafts): AllocationCellBody[] {
  const cells: AllocationCellBody[] = [];
  for (const row of view.people) {
    for (const [key, text] of Object.entries(drafts)) {
      const [personId, accountId] = key.split(":");
      if (personId !== row.person.id) continue;
      const minutes = hoursTextToMinutes(text);
      if (minutes === null) continue;
      const existing = row.allocations.find((cell) => cell.account_id === accountId);
      if ((existing?.planned_minutes ?? 0) === minutes) continue;
      const cell: AllocationCellBody = {
        person_id: personId,
        account_id: accountId,
        month: monthStart(month),
        planned_minutes: minutes,
      };
      if (existing) {
        cell.version = existing.version;
        if (existing.note) cell.note = existing.note;
      }
      cells.push(cell);
    }
  }
  return cells;
}

export function StatusPill({ status }: { status: CapacityStatus }) {
  const { label, tone } = CAPACITY_STATUS[status];
  return <SignalPill tone={tone} label={label} />;
}

/** What the Remaining column counts, on the header and in the panel's subtitle. */
export const REMAINING_BASIS = "Available minus allocated, never below zero; the actual hours logged do not reduce it";

const HEAD = "text-xms-ink px-3 py-2 text-left text-[13px] font-semibold whitespace-nowrap";
const CELL = "text-xms-ink px-3 align-middle whitespace-nowrap";

/**
 * The capacity view (functional 5.4 and 5.5): one row per person with the
 * server's available, allocated, actual and remaining hours and the status
 * pill, then one column per account present with the planned hours,
 * editable inline under capacity:manage and saved as one PUT with the
 * versions. Every figure is the server's; the browser only formats.
 */
export function CapacityGrid({ view, month, accounts, canManage }: CapacityGridProps) {
  const [drafts, setDrafts] = useState<CellDrafts>({});
  const [extra, setExtra] = useState<string[]>([]);
  const [put, { isLoading: saving }] = usePutAllocationsMutation();
  const { push } = useToast();
  const track = useTrack("capacity.allocations.save");

  const columns = useMemo(() => presentAccounts(view, extra), [view, extra]);
  const accountById = useMemo(() => new Map((accounts ?? []).map((account) => [account.id, account])), [accounts]);
  const label = (accountId: string) => accountById.get(accountId)?.key ?? accountId.slice(0, 8);
  const title = (accountId: string) => accountById.get(accountId)?.name ?? accountId;
  const rows = useMemo(
    () => [...view.people].sort((a, b) => a.person.display_name.localeCompare(b.person.display_name)),
    [view.people],
  );
  const changes = useMemo(() => changedCells(view, month, drafts), [view, month, drafts]);
  const invalid = Object.values(drafts).some((text) => hoursTextToMinutes(text) === null);
  const addable = (accounts ?? []).filter((account) => !columns.includes(account.id));

  const cellText = (row: CapacityPerson, accountId: string): string => {
    const key = cellKey(row.person.id, accountId);
    if (key in drafts) return drafts[key];
    return minutesToHoursText(row.allocations.find((cell) => cell.account_id === accountId)?.planned_minutes);
  };

  const save = async () => {
    if (changes.length === 0) return;
    try {
      const result = await put({ cells: changes }).unwrap();
      track({ month, cells: changes.length });
      setDrafts({});
      const removed = result.cells.filter((cell) => "removed" in cell).length;
      push({
        title: "Allocations saved",
        detail: `${changes.length} cell${changes.length === 1 ? "" : "s"} written${removed > 0 ? `, ${removed} cleared` : ""}.`,
        tone: "success",
      });
    } catch (caught) {
      const error = capacityError(caught);
      if (error.code === "stale_version") setDrafts({});
      push({
        title: error.code === "stale_version" ? "Reloaded" : "Not saved",
        detail: describeCapacityError(error),
        tone: "error",
      });
    }
  };

  return (
    <Panel
      title="People"
      caption="This month"
      subtitle={`${view.people.length} ${view.people.length === 1 ? "person" : "people"}. Remaining of plan is ${REMAINING_BASIS.charAt(0).toLowerCase()}${REMAINING_BASIS.slice(1)}.`}
      flush
      actions={
        <>
          {canManage && addable.length > 0 ? (
            <select
              aria-label="Add account"
              className={cn(INPUT, "h-[28px] w-auto text-[12px]")}
              value=""
              onChange={(event) => {
                if (event.target.value) setExtra((current) => [...current, event.target.value]);
              }}
            >
              <option value="">Add account</option>
              {addable.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.key} {account.name}
                </option>
              ))}
            </select>
          ) : null}
          {canManage ? (
            <>
              <button
                type="button"
                className={cn(SECONDARY_BUTTON, "h-[28px] text-[12px]")}
                disabled={Object.keys(drafts).length === 0 || saving}
                onClick={() => setDrafts({})}
              >
                Discard
              </button>
              <button
                type="button"
                className={cn(PRIMARY_BUTTON, "h-[28px] text-[12px]")}
                disabled={changes.length === 0 || invalid || saving}
                onClick={() => void save()}
              >
                {saving ? "Saving" : `Save allocations${changes.length > 0 ? ` (${changes.length})` : ""}`}
              </button>
            </>
          ) : null}
        </>
      }
    >
      <table className="w-full border-collapse text-[13px]" aria-label="Capacity by person">
        <thead className="bg-xms-card sticky top-0 z-10">
          <tr className="border-xms-line border-b">
            <th className={HEAD}>Person</th>
            <th className={cn(HEAD, "text-right")}>Available</th>
            <th className={cn(HEAD, "text-right")}>Allocated</th>
            <th className={cn(HEAD, "text-right")}>Actual</th>
            {/*
              The server's remaining is available minus allocated, never
              below zero; actual hours do not reduce it. Unlabelled, a row
              reading Available 158.4, Allocated 0, Actual 15.5, Remaining
              158.4 contradicts itself to a reader (review finding 16).
            */}
            <th className={cn(HEAD, "text-right")} title={REMAINING_BASIS}>
              Remaining of plan
            </th>
            <th className={HEAD}>Status</th>
            {columns.map((accountId) => (
              <th key={accountId} className={cn(HEAD, "xms-mono text-right")} title={title(accountId)} data-account={accountId}>
                {label(accountId)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.person.id}
              className="border-xms-line hover:bg-xms-row-hover h-[47px] border-b"
              data-person={row.person.id}
              data-status={row.month.status}
            >
              <td className={CELL}>
                <span className="flex flex-col">
                  <Link href={`/roster/${row.person.id}`} className="text-xms-accent font-medium">
                    {row.person.display_name}
                  </Link>
                  <span className="text-xms-label text-[11px]">
                    {roleLabel(row.person.role)}, {Number(row.person.fte_percent)}% FTE
                  </span>
                </span>
              </td>
              <td className={cn(CELL, "xms-mono text-right")} data-available>
                {formatHours(row.month.available_minutes)}
              </td>
              <td className={cn(CELL, "xms-mono text-right")} data-allocated>
                {formatHours(row.month.allocated_minutes)}
              </td>
              <td className={cn(CELL, "xms-mono text-right")} data-actual>
                {formatHours(row.month.actual_minutes)}
              </td>
              <td className={cn(CELL, "xms-mono text-right")} data-remaining>
                {formatHours(row.month.remaining_minutes)}
              </td>
              <td className={CELL}>
                <StatusPill status={row.month.status} />
              </td>
              {columns.map((accountId) => {
                const key = cellKey(row.person.id, accountId);
                const text = cellText(row, accountId);
                const bad = key in drafts && hoursTextToMinutes(drafts[key]) === null;
                return (
                  <td key={accountId} className={cn(CELL, "xms-mono text-right")} data-cell={key}>
                    {canManage ? (
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        inputMode="decimal"
                        aria-label={`${row.person.display_name} on ${label(accountId)}`}
                        aria-invalid={bad || undefined}
                        value={text}
                        placeholder="0"
                        onChange={(event) => setDrafts((current) => ({ ...current, [key]: event.target.value }))}
                        className={cn(
                          INPUT,
                          "xms-mono h-[28px] w-[84px] text-right text-[12px]",
                          key in drafts && "border-xms-accent",
                          bad && "border-[color:var(--state-overdue-border)]",
                        )}
                      />
                    ) : (
                      <span>{text ? `${text} h` : ""}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6 + columns.length} className="text-xms-label px-4 py-8 text-center">
                No one matches in this month.
              </td>
            </tr>
          ) : null}
        </tbody>
        <tfoot>
          <tr className="text-xms-ink text-[12px] font-semibold" data-testid="capacity-totals">
            <td className="px-3 py-2">Total</td>
            <td className="xms-mono px-3 py-2 text-right" data-total-available>
              {formatHours(view.totals.available_minutes)}
            </td>
            <td className="xms-mono px-3 py-2 text-right" data-total-allocated>
              {formatHours(view.totals.allocated_minutes)}
            </td>
            <td className="xms-mono px-3 py-2 text-right" data-total-actual>
              {formatHours(view.totals.actual_minutes)}
            </td>
            <td className="xms-mono px-3 py-2 text-right" data-total-remaining>
              {formatHours(view.totals.remaining_minutes)}
            </td>
            <td colSpan={1 + columns.length} />
          </tr>
        </tfoot>
      </table>
    </Panel>
  );
}
