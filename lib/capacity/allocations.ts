import { hoursTextToMinutes, monthStart } from "@/lib/capacity/vocab";
import type { AllocationCellBody, CapacityView } from "@/redux/capacityApi";

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
