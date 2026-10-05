"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { SignalPill } from "@/components/xms/signal-pill";
import { useToast } from "@/components/xms/toast";
import { cellKey, changedCells, presentAccounts, type CellDrafts } from "@/lib/capacity/allocations";
import { capacityError, describeCapacityError } from "@/lib/capacity/errors";
import { CAPACITY_STATUS, hoursTextToMinutes, minutesToHoursText } from "@/lib/capacity/vocab";
import { roleLabel } from "@/lib/roster/vocab";
import { useTrack } from "@/lib/telemetry/provider";
import { formatHours } from "@/lib/time/budget";
import { cn } from "@/lib/utils";
import {
  usePutAllocationsMutation,
  type CapacityPerson,
  type CapacityStatus,
  type CapacityTotals,
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

export function StatusPill({ status }: { status: CapacityStatus }) {
  const { label, tone } = CAPACITY_STATUS[status];
  return <SignalPill tone={tone} label={label} />;
}

/** What the Remaining column counts, on the header and in the panel's subtitle. */
export const REMAINING_BASIS = "Available minus allocated, never below zero; the actual hours logged do not reduce it";

const HEAD = "text-xms-ink px-3 py-2 text-left text-body font-semibold whitespace-nowrap";
const CELL = "text-xms-ink px-3 py-[9px] align-middle whitespace-nowrap";

interface AccountColumn {
  id: string;
  /** The account's key, or the start of its id where the directory is not readable. */
  label: string;
  title: string;
}

function accountColumns(ids: string[], accounts: GrantedAccount[] | undefined): AccountColumn[] {
  const byId = new Map((accounts ?? []).map((account) => [account.id, account]));
  return ids.map((id) => ({ id, label: byId.get(id)?.key ?? id.slice(0, 8), title: byId.get(id)?.name ?? id }));
}

/** What a cell shows: the draft typed into it, else the stored plan in hours. */
function cellText(row: CapacityPerson, accountId: string, drafts: CellDrafts): string {
  const key = cellKey(row.person.id, accountId);
  if (key in drafts) return drafts[key];
  return minutesToHoursText(row.allocations.find((cell) => cell.account_id === accountId)?.planned_minutes);
}

/** The cells typed into the grid and the one PUT that writes them with the versions they were read at. */
function useAllocationDrafts(view: CapacityView, month: string) {
  const [drafts, setDrafts] = useState<CellDrafts>({});
  const [put, { isLoading: saving }] = usePutAllocationsMutation();
  const { push } = useToast();
  const track = useTrack("capacity.allocations.save");
  const changes = useMemo(() => changedCells(view, month, drafts), [view, month, drafts]);
  const invalid = Object.values(drafts).some((text) => hoursTextToMinutes(text) === null);

  const setDraft = (key: string, text: string) => setDrafts((current) => ({ ...current, [key]: text }));
  const discard = () => setDrafts({});

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

  return { drafts, changes, invalid, saving, setDraft, discard, save };
}

export interface GridActionsProps {
  canManage: boolean;
  addable: GrantedAccount[];
  /** How many cells the save would write. */
  changed: number;
  dirty: boolean;
  invalid: boolean;
  saving: boolean;
  onAdd: (accountId: string) => void;
  onDiscard: () => void;
  onSave: () => void;
}

function GridActions({
  canManage,
  addable,
  changed,
  dirty,
  invalid,
  saving,
  onAdd,
  onDiscard,
  onSave,
}: GridActionsProps) {
  if (!canManage) return null;
  return (
    <>
      {addable.length > 0 ? (
        <select
          aria-label="Add account"
          className={cn(INPUT, "h-[28px] w-auto text-body")}
          value=""
          onChange={(event) => {
            if (event.target.value) onAdd(event.target.value);
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
      <button
        type="button"
        className={cn(SECONDARY_BUTTON, "h-[28px] text-body")}
        disabled={!dirty || saving}
        onClick={onDiscard}
      >
        Discard
      </button>
      <button
        type="button"
        className={cn(PRIMARY_BUTTON, "h-[28px] text-body")}
        disabled={changed === 0 || invalid || saving}
        onClick={onSave}
      >
        {saving ? "Saving" : `Save allocations${changed > 0 ? ` (${changed})` : ""}`}
      </button>
    </>
  );
}

function GridHead({ columns }: { columns: AccountColumn[] }) {
  return (
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
        {columns.map((column) => (
          <th key={column.id} className={cn(HEAD, "xms-mono text-right")} title={column.title} data-account={column.id}>
            {column.label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export interface AllocationCellProps {
  row: CapacityPerson;
  column: AccountColumn;
  canManage: boolean;
  drafts: CellDrafts;
  onDraft: (key: string, text: string) => void;
}

function AllocationCell({ row, column, canManage, drafts, onDraft }: AllocationCellProps) {
  const key = cellKey(row.person.id, column.id);
  const text = cellText(row, column.id, drafts);
  const bad = key in drafts && hoursTextToMinutes(drafts[key]) === null;
  return (
    <td className={cn(CELL, "xms-mono text-right")} data-cell={key}>
      {canManage ? (
        <input
          type="number"
          min={0}
          step={0.5}
          inputMode="decimal"
          aria-label={`${row.person.display_name} on ${column.label}`}
          aria-invalid={bad || undefined}
          value={text}
          placeholder="0"
          onChange={(event) => onDraft(key, event.target.value)}
          className={cn(
            INPUT,
            "xms-mono h-[28px] w-[84px] text-right text-body",
            key in drafts && "border-xms-accent",
            bad && "border-[color:var(--state-overdue-border)]",
          )}
        />
      ) : (
        <span>{text ? `${text} h` : ""}</span>
      )}
    </td>
  );
}

export interface PersonRowProps {
  row: CapacityPerson;
  columns: AccountColumn[];
  canManage: boolean;
  drafts: CellDrafts;
  onDraft: (key: string, text: string) => void;
}

function PersonRow({ row, columns, canManage, drafts, onDraft }: PersonRowProps) {
  return (
    <tr
      className="border-xms-line hover:bg-xms-row-hover border-b"
      data-person={row.person.id}
      data-status={row.month.status}
    >
      <td className={CELL}>
        <span className="xms-stack">
          <Link href={`/roster/${row.person.id}`} className="text-xms-accent font-medium">
            {row.person.display_name}
          </Link>
          <span className="text-xms-label text-body">
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
      {columns.map((column) => (
        <AllocationCell
          key={column.id}
          row={row}
          column={column}
          canManage={canManage}
          drafts={drafts}
          onDraft={onDraft}
        />
      ))}
    </tr>
  );
}

function TotalsRow({ totals, accountCount }: { totals: CapacityTotals; accountCount: number }) {
  return (
    <tr className="text-xms-ink text-body font-semibold" data-testid="capacity-totals">
      <td className="px-3 py-2">Total</td>
      <td className="xms-mono px-3 py-2 text-right" data-total-available>
        {formatHours(totals.available_minutes)}
      </td>
      <td className="xms-mono px-3 py-2 text-right" data-total-allocated>
        {formatHours(totals.allocated_minutes)}
      </td>
      <td className="xms-mono px-3 py-2 text-right" data-total-actual>
        {formatHours(totals.actual_minutes)}
      </td>
      <td className="xms-mono px-3 py-2 text-right" data-total-remaining>
        {formatHours(totals.remaining_minutes)}
      </td>
      <td colSpan={1 + accountCount} />
    </tr>
  );
}

/**
 * The capacity view (functional 5.4 and 5.5): one row per person with the
 * server's available, allocated, actual and remaining hours and the status
 * pill, then one column per account present with the planned hours,
 * editable inline under capacity:manage and saved as one PUT with the
 * versions. Every figure is the server's; the browser only formats.
 */
export function CapacityGrid({ view, month, accounts, canManage }: CapacityGridProps) {
  const [extra, setExtra] = useState<string[]>([]);
  const { drafts, changes, invalid, saving, setDraft, discard, save } = useAllocationDrafts(view, month);
  const ids = useMemo(() => presentAccounts(view, extra), [view, extra]);
  const columns = useMemo(() => accountColumns(ids, accounts), [ids, accounts]);
  const rows = useMemo(
    () => [...view.people].sort((a, b) => a.person.display_name.localeCompare(b.person.display_name)),
    [view.people],
  );
  const addable = (accounts ?? []).filter((account) => !ids.includes(account.id));

  return (
    <Panel
      title="People"
      caption="This month"
      subtitle={`${view.people.length} ${view.people.length === 1 ? "person" : "people"}. Remaining of plan is ${REMAINING_BASIS.charAt(0).toLowerCase()}${REMAINING_BASIS.slice(1)}.`}
      flush
      actions={
        <GridActions
          canManage={canManage}
          addable={addable}
          changed={changes.length}
          dirty={Object.keys(drafts).length > 0}
          invalid={invalid}
          saving={saving}
          onAdd={(accountId) => setExtra((current) => [...current, accountId])}
          onDiscard={discard}
          onSave={() => void save()}
        />
      }
    >
      <table className="w-full border-collapse text-body" aria-label="Capacity by person">
        <GridHead columns={columns} />
        <tbody>
          {rows.map((row) => (
            <PersonRow
              key={row.person.id}
              row={row}
              columns={columns}
              canManage={canManage}
              drafts={drafts}
              onDraft={setDraft}
            />
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
          <TotalsRow totals={view.totals} accountCount={columns.length} />
        </tfoot>
      </table>
    </Panel>
  );
}
