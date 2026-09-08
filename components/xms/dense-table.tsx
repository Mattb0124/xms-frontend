"use client";

import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SortDirection = "asc" | "desc";

export interface SortState {
  key: string;
  direction: SortDirection;
}

export interface DenseColumn<Row> {
  key: string;
  title: string;
  /** Sortable columns read a primitive from the row through this accessor. */
  sortValue?: (row: Row) => string | number | null | undefined;
  render?: (row: Row) => ReactNode;
  width?: string;
  align?: "left" | "right";
  mono?: boolean;
}

export interface DenseTableProps<Row> {
  title: string;
  count: number;
  columns: DenseColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  /** Controlled sort; when omitted the table sorts locally with sortValue. */
  sort?: SortState;
  /**
   * The order a locally sorted list opens in: the Queue opens on SLA,
   * tightest clock first (Wireframes section 3.1, review finding 20).
   */
  defaultSort?: SortState;
  onSortChange?: (sort: SortState) => void;
  selectable?: boolean;
  selected?: ReadonlySet<string>;
  onSelectionChange?: (selected: Set<string>) => void;
  onRowClick?: (row: Row) => void;
  /** In-card search slot, rendered in the header after the count. */
  search?: ReactNode;
  /** Between header and rows: the selection bar, in practice. */
  banner?: ReactNode;
  footer?: ReactNode;
  emptyState?: ReactNode;
  loading?: boolean;
  className?: string;
}

function compare(a: string | number | null | undefined, b: string | number | null | undefined): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

/**
 * The dense list in a Count card: sticky header, no striping, row then cell
 * hover, mono keys and SLA values (xms-web-data-table skill, Wireframes v2
 * section 3.1 and v3 section 8.4). The server is the author of every value.
 */
export function DenseTable<Row>(props: DenseTableProps<Row>) {
  const { columns, rows, rowKey, selectable, onRowClick } = props;
  const [localSort, setLocalSort] = useState<SortState | undefined>(props.defaultSort);
  const sort = props.sort ?? localSort;
  const selected = props.selected ?? new Set<string>();

  const setSort = (key: string) => {
    const column = columns.find((c) => c.key === key);
    if (!column?.sortValue) return;
    const next: SortState =
      sort?.key === key ? { key, direction: sort.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" };
    if (props.onSortChange) props.onSortChange(next);
    else setLocalSort(next);
  };

  const ordered = useMemo(() => {
    if (props.sort || !sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column?.sortValue) return rows;
    const accessor = column.sortValue;
    const copy = [...rows].sort((a, b) => compare(accessor(a), accessor(b)));
    return sort.direction === "asc" ? copy : copy.reverse();
  }, [rows, sort, columns, props.sort]);

  const allKeys = ordered.map(rowKey);
  const allSelected = allKeys.length > 0 && allKeys.every((key) => selected.has(key));

  const toggleAll = () => {
    const next = new Set<string>(selected);
    if (allSelected) allKeys.forEach((key) => next.delete(key));
    else allKeys.forEach((key) => next.add(key));
    props.onSelectionChange?.(next);
  };
  const toggleOne = (key: string) => {
    const next = new Set<string>(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    props.onSelectionChange?.(next);
  };

  return (
    // min-w-0 keeps the card from growing to the table's intrinsic width: without
    // it the document was wider than the viewport and the whole page scrolled
    // sideways instead of the table (frontend review finding 8).
    <section className={cn("xms-card flex min-w-0 flex-col", props.className)} aria-label={props.title}>
      <header className="border-xms-line flex min-h-[48px] flex-wrap items-center gap-3 border-b px-4 py-2">
        <span className="text-xms-ink text-[15px] font-semibold">{props.title}</span>
        <span className="xms-mono bg-xms-tint text-xms-accent rounded-[999px] px-2 py-[2px] text-[11px] font-semibold">
          {props.count}
        </span>
        {props.search ? <div className="ml-auto min-w-0 max-w-full">{props.search}</div> : null}
      </header>
      {props.banner}
      <div className="overflow-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead className="bg-xms-card sticky top-0 z-10">
            <tr className="border-xms-line border-b">
              {selectable ? (
                <th className="w-9 px-3 py-2">
                  <input type="checkbox" aria-label="Select all rows" checked={allSelected} onChange={toggleAll} />
                </th>
              ) : null}
              {columns.map((column) => {
                const active = sort?.key === column.key;
                return (
                  <th
                    key={column.key}
                    style={{ width: column.width }}
                    aria-sort={active ? (sort?.direction === "asc" ? "ascending" : "descending") : undefined}
                    className={cn(
                      "text-xms-ink px-3 py-2 text-left text-[13px] font-semibold whitespace-nowrap",
                      column.align === "right" && "text-right",
                    )}
                  >
                    {column.sortValue ? (
                      <button
                        type="button"
                        onClick={() => setSort(column.key)}
                        className="hover:text-xms-accent inline-flex items-center gap-1"
                      >
                        {column.title}
                        <span className="text-xms-muted text-[10px]" aria-hidden>
                          {active ? (sort?.direction === "asc" ? "▲" : "▼") : "△"}
                        </span>
                      </button>
                    ) : (
                      column.title
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {ordered.map((row) => {
              const key = rowKey(row);
              const isSelected = selected.has(key);
              return (
                <tr
                  key={key}
                  data-row-key={key}
                  data-selected={isSelected ? "true" : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "border-xms-line hover:bg-xms-row-hover h-[47px] border-b",
                    isSelected && "bg-xms-tint shadow-[inset_3px_0_0_var(--xms-accent)]",
                    onRowClick && "cursor-pointer",
                  )}
                >
                  {selectable ? (
                    <td className="px-3" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${key}`}
                        checked={isSelected}
                        onChange={() => toggleOne(key)}
                      />
                    </td>
                  ) : null}
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        "hover:bg-xms-cell-hover text-xms-ink px-3 align-middle whitespace-nowrap",
                        column.mono && "xms-mono",
                        column.align === "right" && "text-right",
                      )}
                    >
                      {column.render ? column.render(row) : String(column.sortValue?.(row) ?? "")}
                    </td>
                  ))}
                </tr>
              );
            })}
            {ordered.length === 0 && !props.loading ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="text-xms-label px-4 py-8 text-center">
                  {props.emptyState ?? "Nothing here"}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {props.footer}
    </section>
  );
}
