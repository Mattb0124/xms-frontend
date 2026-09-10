"use client";

import { useMemo, useState, type ReactNode } from "react";
import { SortCaret } from "@/components/xms/icons";
import { EyeIcon, ICON } from "@/components/xms/icons";
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
  /** A cell that carries prose, so it wraps rather than staying on one line. */
  wrap?: boolean;
  render?: (row: Row) => ReactNode;
  width?: string;
  align?: "left" | "right";
  mono?: boolean;
  /**
   * Carried for sorting but not drawn. The Queue keeps its SLA column this
   * way: the v3 render (01) has no SLA cell, and dropping the column outright
   * would take the tightest-clock default sort with it.
   */
  hidden?: boolean;
}

export interface DenseTableProps<Row> {
  title: string;
  /**
   * Name the list for assistive technology without drawing the title. The
   * Queue takes this: its card header carried the word "Count" beside a
   * badge repeating the row count, and both are gone, so the header is the
   * search field and the two icon controls and nothing else.
   */
  titleHidden?: boolean;
  /** The line beside the title, in sentence case: "mine first, then group unassigned". */
  subtitle?: string;
  /**
   * Draw no column header row. Render 08's Needs attention list is a card of
   * rows, not a table: five fixed cells and no header over them, because five
   * rows do not need naming and the header cost more than it explained.
   */
  headless?: boolean;
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
  /**
   * Opens one row beside the list rather than navigating to it. Where a
   * screen gives one, every row carries a preview mark on hover.
   */
  onRowPreview?: (row: Row) => void;
  /** In-card search slot, rendered in the header after the title. */
  search?: ReactNode;
  /** The icon controls to the right of the search field (filter, columns). */
  actions?: ReactNode;
  /**
   * A list screen stands as bands edge to edge rather than as a card on a
   * page: no radius, no side border, and the page's own gutter removed
   * around it. A record screen keeps the card.
   */
  bleed?: boolean;
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
  const { columns, rows, rowKey, selectable, onRowClick, onRowPreview } = props;
  const drawn = useMemo(() => columns.filter((column) => !column.hidden), [columns]);
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
    <section
      className={cn(
        "flex min-w-0 flex-col",
        // A list screen is bands edge to edge; every other surface is a card.
        props.bleed ? "bg-xms-card border-xms-line border-y" : "xms-card",
        props.className,
      )}
      aria-label={props.title}
    >
      <header className="border-xms-line flex min-h-[48px] flex-wrap items-center gap-[14px] border-b px-5 py-3">
        {/* The search field opens the header: a reader looking for a row
            starts at the left edge of the card, not at its far corner. A card
            that carries one needs no title beside it, since the strip above
            already names the screen and the field says what it searches; the
            title stays on the card's accessible name for anyone not reading
            the screen. The card's own actions close the row. */}
        {props.search ? (
          <div className="min-w-0 max-w-[360px] flex-1">{props.search}</div>
        ) : props.titleHidden ? null : (
          <span className="text-xms-ink text-[17px] leading-[1.3] font-semibold">{props.title}</span>
        )}
        {props.actions ? <div className="ml-auto flex shrink-0 items-center gap-2">{props.actions}</div> : null}
      </header>
      {props.banner}
      {/* Horizontal overflow scrolls inside the card, never the page
          (hand-off section 5). */}
      <div className="overflow-x-auto">
        {/* The card names itself even where the header draws a search in
            place of the title, so the table is still findable by name. */}
        <table aria-label={props.title} className="xms-sticky-head w-full border-collapse text-[13px]">
          {/* Without a header row the widths have nowhere else to live. */}
          {props.headless ? (
            <colgroup>
              {selectable ? <col style={{ width: "44px" }} /> : null}
              {drawn.map((column) => (
                <col key={column.key} style={{ width: column.width }} />
              ))}
            </colgroup>
          ) : null}
          <thead className={cn("bg-xms-card sticky top-0 z-10", props.headless && "hidden")}>
            <tr className={cn(!props.headless && "border-xms-line-head border-b")}>
              {selectable ? (
                <th className="w-11 px-5 py-[11px]">
                  <input type="checkbox" aria-label="Select all rows" checked={allSelected} onChange={toggleAll} />
                </th>
              ) : null}
              {drawn.map((column) => {
                const active = sort?.key === column.key;
                return (
                  <th
                    key={column.key}
                    style={{ width: column.width }}
                    aria-sort={active ? (sort?.direction === "asc" ? "ascending" : "descending") : undefined}
                    className={cn(
                      "text-xms-ink px-[14px] py-[11px] text-left text-[13px] font-semibold whitespace-nowrap",
                      column.align === "right" && "text-right",
                    )}
                  >
                    {column.sortValue ? (
                      <button
                        type="button"
                        onClick={() => setSort(column.key)}
                        className="hover:text-xms-accent inline-flex items-center gap-[5px]"
                      >
                        {column.title}
                        {/* 13px, and the idle glyph is the quietest line in
                            the system, not the label grey it was drawn in
                            (hand-off section 5). */}
                        <SortCaret
                          className={active ? "text-xms-accent" : "text-xms-quiet-line"}
                          direction={active ? sort?.direction : undefined}
                        />
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
                // An openable row is reachable from the keyboard and opens on
                // Enter (Design System section 6, review finding 19): without
                // a tab stop the only way in was the key link. A keypress that
                // started inside the row, in the checkbox or the key link,
                // belongs to that control and is left alone.
                <tr
                  key={key}
                  data-row-key={key}
                  data-selected={isSelected ? "true" : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={
                    onRowClick
                      ? (event) => {
                          // A row opens its record, but a link inside a cell
                          // opens what it names: the contact, the CSM, the
                          // person it is assigned to. Without this the row
                          // swallowed every one of them.
                          if ((event.target as HTMLElement).closest("a,button,input,select,textarea,label")) return;
                          onRowClick(row);
                        }
                      : undefined
                  }
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.target !== event.currentTarget) return;
                          if (event.key !== "Enter" && event.key !== " ") return;
                          event.preventDefault();
                          onRowClick(row);
                        }
                      : undefined
                  }
                  className={cn(
                    // One hairline and a hover fill separate two rows, and
                    // nothing else does (hand-off rule 1).
                    "group/row border-xms-line-row hover:bg-xms-row-hover border-b",
                    isSelected && "bg-xms-tint shadow-[inset_3px_0_0_var(--xms-accent-hover)]",
                    onRowClick && "cursor-pointer",
                  )}
                >
                  {selectable ? (
                    <td className="px-5 py-[13px] align-middle" onClick={(event) => event.stopPropagation()}>
                      {/* The box stands where the pointer is, or where a row is
                          already ticked. It keeps its space either way, so a
                          row does not shift as the pointer crosses it, and it
                          stays reachable by keyboard because only its opacity
                          changes. */}
                      <input
                        type="checkbox"
                        aria-label={`Select ${key}`}
                        checked={isSelected}
                        onChange={() => toggleOne(key)}
                        className={cn(
                          "transition-opacity focus-visible:opacity-100 group-hover/row:opacity-100",
                          isSelected ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </td>
                  ) : null}
                  {drawn.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        // 13px vertical, 14px horizontal (hand-off section 4).
                        // A row is as tall as the sentence in it, and every
                        // other cell sits in the middle of that height rather
                        // than hanging from the top of it.
                        "hover:bg-xms-cell-hover text-xms-ink px-[14px] py-[13px] align-middle",
                        column.wrap ? undefined : "whitespace-nowrap",
                        column.mono && "xms-mono",
                        column.align === "right" && "text-right",
                      )}
                    >
                      {column.render ? column.render(row) : String(column.sortValue?.(row) ?? "")}
                    </td>
                  ))}
                  {onRowPreview ? (
                    <td className="w-[44px] px-3 py-[13px] align-middle" onClick={(event) => event.stopPropagation()}>
                      {/* Opens the record beside the list rather than leaving
                          it, so a reader can read one row and stay where they
                          were. Drawn on hover, like the box. */}
                      <button
                        type="button"
                        aria-label={`Preview ${key}`}
                        onClick={() => onRowPreview(row)}
                        className="text-xms-icon hover:text-xms-accent rounded-none opacity-0 transition-opacity focus-visible:opacity-100 group-hover/row:opacity-100"
                      >
                        <EyeIcon size={ICON.row} />
                      </button>
                    </td>
                  ) : null}
                </tr>
              );
            })}
            {ordered.length === 0 && !props.loading ? (
              <tr>
                <td colSpan={drawn.length + (selectable ? 1 : 0)} className="text-xms-label px-4 py-8 text-center">
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
