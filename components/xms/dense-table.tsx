"use client";

import { useMemo, useState, type ReactNode } from "react";
import { SortCaret } from "@/components/xms/icons";
import { ICON, InfoIcon } from "@/components/xms/icons";
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

/**
 * What the personalize dialogue's display switches ask of the table. The
 * screen passes what the reader chose; the defaults are what a list looks
 * like for anyone who has never opened the dialogue.
 */
export interface TableDisplay {
  wrap: boolean;
  compact: boolean;
  activeRow: boolean;
  coloring: boolean;
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
   * screen gives one, every row carries a preview mark on hover. The mark's
   * own rectangle comes with it, so the card can open against the mark
   * rather than in the middle of the screen.
   */
  onRowPreview?: (row: Row, anchor: { top: number; left: number; bottom: number }) => void;
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
  /** The reader's display switches, from useListArrangement. */
  display?: TableDisplay;
}

function compare(a: string | number | null | undefined, b: string | number | null | undefined): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

const ARIA_SORT: Record<SortDirection, "ascending" | "descending"> = { asc: "ascending", desc: "descending" };

/** The sort in force (the screen's when it controls one) and the rows in that order. */
function useSortedRows<Row>({
  columns,
  rows,
  sort: controlled,
  defaultSort,
  onSortChange,
}: Pick<DenseTableProps<Row>, "columns" | "rows" | "sort" | "defaultSort" | "onSortChange">) {
  const [localSort, setLocalSort] = useState<SortState | undefined>(defaultSort);
  const sort = controlled ?? localSort;

  const setSort = (key: string) => {
    const column = columns.find((c) => c.key === key);
    if (!column?.sortValue) return;
    const next: SortState =
      sort?.key === key ? { key, direction: sort.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" };
    if (onSortChange) onSortChange(next);
    else setLocalSort(next);
  };

  const ordered = useMemo(() => {
    if (controlled || !sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column?.sortValue) return rows;
    const accessor = column.sortValue;
    const copy = [...rows].sort((a, b) => compare(accessor(a), accessor(b)));
    return sort.direction === "asc" ? copy : copy.reverse();
  }, [rows, sort, columns, controlled]);

  return { sort, ordered, setSort };
}

export interface CardHeaderProps {
  title: string;
  titleHidden?: boolean;
  search?: ReactNode;
  actions?: ReactNode;
}

function CardHeader({ title, titleHidden, search, actions }: CardHeaderProps) {
  return (
    <header className="border-xms-line flex min-h-[48px] flex-wrap items-center gap-[14px] border-b px-5 py-3">
      {/* The search field opens the header: a reader looking for a row
          starts at the left edge of the card, not at its far corner. A card
          that carries one needs no title beside it, since the strip above
          already names the screen and the field says what it searches; the
          title stays on the card's accessible name for anyone not reading
          the screen. The card's own actions close the row. */}
      {search ? <div className="min-w-0 max-w-[360px] flex-1">{search}</div> : null}
      {!search && !titleHidden ? (
        <span className="text-xms-ink text-lead leading-[1.3] font-semibold">{title}</span>
      ) : null}
      {actions ? <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export interface ColumnWidthsProps<Row> {
  columns: DenseColumn<Row>[];
  selectable?: boolean;
  previewable: boolean;
}

/** Without a header row the widths have nowhere else to live. */
function ColumnWidths<Row>({ columns, selectable, previewable }: ColumnWidthsProps<Row>) {
  return (
    <colgroup>
      {selectable ? <col style={{ width: "44px" }} /> : null}
      {previewable ? <col style={{ width: "36px" }} /> : null}
      {columns.map((column) => (
        <col key={column.key} style={{ width: column.width }} />
      ))}
    </colgroup>
  );
}

export interface ColumnHeaderProps<Row> {
  column: DenseColumn<Row>;
  sort: SortState | undefined;
  headY: string;
  onSort: (key: string) => void;
}

function ColumnHeader<Row>({ column, sort, headY, onSort }: ColumnHeaderProps<Row>) {
  const direction = sort?.key === column.key ? sort.direction : undefined;
  return (
    <th
      style={{ width: column.width }}
      aria-sort={direction ? ARIA_SORT[direction] : undefined}
      className={cn(
        // No colour or weight here: the treatment is .xms-sticky-head th in
        // xms-scope.css, which puts a column header in the muted ink at
        // 600. These carried text-xms-ink and font-bold, and a utility
        // beats a layered rule, so the header stayed near-black and bold
        // when that rule was added on 2026-09-14 and the change looked
        // like it had worked.
        "px-[14px] text-left whitespace-nowrap",
        headY,
        column.align === "right" && "text-right",
      )}
    >
      {column.sortValue ? (
        <button
          type="button"
          onClick={() => onSort(column.key)}
          className="hover:text-xms-accent inline-flex items-center gap-[5px]"
        >
          {column.title}
          {/* 13px, and the idle glyph is the quietest line in
              the system, not the label grey it was drawn in
              (hand-off section 5). */}
          <SortCaret
            className={cn("xms-sort-caret", direction ? "text-xms-accent" : "text-xms-quiet-line")}
            direction={direction}
          />
        </button>
      ) : (
        column.title
      )}
    </th>
  );
}

export interface ColumnHeadersProps<Row> {
  columns: DenseColumn<Row>[];
  headless?: boolean;
  compact?: boolean;
  selectable?: boolean;
  previewable: boolean;
  allSelected: boolean;
  sort: SortState | undefined;
  onToggleAll: () => void;
  onSort: (key: string) => void;
}

function ColumnHeaders<Row>({
  columns,
  headless,
  compact,
  selectable,
  previewable,
  allSelected,
  sort,
  onToggleAll,
  onSort,
}: ColumnHeadersProps<Row>) {
  const headY = compact ? "py-[7px]" : "py-[11px]";
  return (
    <thead className={cn("bg-xms-card sticky top-0 z-10", headless && "hidden")}>
      <tr className={cn(!headless && "border-xms-line-head border-b-[1px]")}>
        {selectable ? (
          <th className={cn("w-11 px-5", headY)}>
            <input type="checkbox" aria-label="Select all rows" checked={allSelected} onChange={onToggleAll} />
          </th>
        ) : null}
        {previewable ? <th className="w-[36px] pr-2 pl-0" aria-label="Preview" /> : null}
        {columns.map((column) => (
          <ColumnHeader key={column.key} column={column} sort={sort} headY={headY} onSort={onSort} />
        ))}
      </tr>
    </thead>
  );
}

export interface SelectCellProps {
  id: string;
  selected: boolean;
  cellY: string;
  onToggle: (id: string) => void;
}

function SelectCell({ id, selected, cellY, onToggle }: SelectCellProps) {
  return (
    <td className={cn("px-5 align-middle", cellY)} onClick={(event) => event.stopPropagation()}>
      {/* The box stands where the pointer is, or where a row is
          already ticked. It keeps its space either way, so a
          row does not shift as the pointer crosses it, and it
          stays reachable by keyboard because only its opacity
          changes. */}
      <input
        type="checkbox"
        aria-label={`Select ${id}`}
        checked={selected}
        onChange={() => onToggle(id)}
        className={cn(
          "transition-opacity focus-visible:opacity-100 group-hover/row:opacity-100",
          selected ? "opacity-100" : "opacity-0",
        )}
      />
    </td>
  );
}

export interface PreviewCellProps {
  id: string;
  cellY: string;
  onPreview: (anchor: { top: number; left: number; bottom: number }) => void;
}

function PreviewCell({ id, cellY, onPreview }: PreviewCellProps) {
  return (
    <td className={cn("w-[36px] pr-2 pl-0 align-middle", cellY)} onClick={(event) => event.stopPropagation()}>
      {/* Opens the record beside the list rather than leaving
          it, so a reader can read one row and stay where they
          were. Drawn on hover, like the box it stands next
          to. */}
      <button
        type="button"
        aria-label={`Preview ${id}`}
        onClick={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          onPreview({ top: box.top, left: box.left, bottom: box.bottom });
        }}
        className="text-xms-icon hover:text-xms-accent rounded-none opacity-0 transition-opacity focus-visible:opacity-100 group-hover/row:opacity-100"
      >
        <InfoIcon size={ICON.row} />
      </button>
    </td>
  );
}

export interface DenseRowProps<Row> {
  row: Row;
  id: string;
  columns: DenseColumn<Row>[];
  display?: TableDisplay;
  selectable?: boolean;
  selected: boolean;
  active: boolean;
  onToggle: (id: string) => void;
  onActivate: (id: string) => void;
  onRowClick?: (row: Row) => void;
  onRowPreview?: DenseTableProps<Row>["onRowPreview"];
}

function DenseRow<Row>({
  row,
  id,
  columns,
  display,
  selectable,
  selected,
  active,
  onToggle,
  onActivate,
  onRowClick,
  onRowPreview,
}: DenseRowProps<Row>) {
  // Tighter rows fit more of the list on a screen; the default is the height
  // the renders draw.
  // 8px compact, which puts the row pitch at 40px: Docker's own table measures
  // exactly 40 between separators (sampled down the left of its data area,
  // deltas 41, 40, 40, 40, 40, 40, 40), and 7px landed us at 38.
  const cellY = display?.compact ? "py-[8px]" : "py-[13px]";
  return (
    // An openable row is reachable from the keyboard and opens on
    // Enter (Design System section 6, review finding 19): without
    // a tab stop the only way in was the key link. A keypress that
    // started inside the row, in the checkbox or the key link,
    // belongs to that control and is left alone.
    <tr
      data-row-key={id}
      data-selected={selected ? "true" : undefined}
      tabIndex={onRowClick ? 0 : undefined}
      onClick={
        onRowClick
          ? (event) => {
              // A row opens its record, but a link inside a cell
              // opens what it names: the contact, the CSM, the
              // person it is assigned to. Without this the row
              // swallowed every one of them.
              if ((event.target as HTMLElement).closest("a,button,input,select,textarea,label")) return;
              onActivate(id);
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
        selected && "bg-xms-tint shadow-[inset_3px_0_0_var(--xms-accent-hover)]",
        display?.activeRow !== false && active && !selected && "bg-xms-row-hover",
        onRowClick && "cursor-pointer",
      )}
    >
      {selectable ? <SelectCell id={id} selected={selected} cellY={cellY} onToggle={onToggle} /> : null}
      {onRowPreview ? <PreviewCell id={id} cellY={cellY} onPreview={(anchor) => onRowPreview(row, anchor)} /> : null}
      {columns.map((column) => (
        <td
          key={column.key}
          className={cn(
            // 13px vertical, 14px horizontal (hand-off section 4).
            // A row is as tall as the sentence in it, and every
            // other cell sits in the middle of that height rather
            // than hanging from the top of it.
            "hover:bg-xms-cell-hover text-xms-ink px-[14px] align-middle",
            cellY,
            column.wrap || display?.wrap ? undefined : "whitespace-nowrap",
            column.mono && "xms-mono",
            column.align === "right" && "text-right",
          )}
        >
          {column.render ? column.render(row) : String(column.sortValue?.(row) ?? "")}
        </td>
      ))}
    </tr>
  );
}

/**
 * The dense list in a Count card: sticky header, no striping, row then cell
 * hover, mono keys and SLA values (xms-web-data-table skill, Wireframes v2
 * section 3.1 and v3 section 8.4). The server is the author of every value.
 */
export function DenseTable<Row>(props: DenseTableProps<Row>) {
  const { columns, rowKey, selectable, onRowClick, onRowPreview } = props;
  const display = props.display;
  // The row last opened keeps a quiet mark, so a reader coming back from a
  // record finds their place. It is not a selection, so it carries no rail.
  const [active, setActive] = useState<string | null>(null);
  const drawn = useMemo(() => columns.filter((column) => !column.hidden), [columns]);
  const { sort, ordered, setSort } = useSortedRows(props);
  const selected = props.selected ?? new Set<string>();

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
        props.bleed ? "bg-xms-card border-xms-line min-h-0 flex-1 border-y" : "xms-card",
        props.className,
      )}
      aria-label={props.title}
    >
      <CardHeader title={props.title} titleHidden={props.titleHidden} search={props.search} actions={props.actions} />
      {props.banner}
      {/* Horizontal overflow scrolls inside the card, never the page
          (hand-off section 5). On a list screen it carries the vertical
          scroll too, so the sticky column header has something to pin
          against: a header stuck to a box that never scrolls vertically
          simply travels with the rows. */}
      <div className={cn("overflow-x-auto", props.bleed && "min-h-0 flex-1 overflow-y-auto")}>
        {/* The card names itself even where the header draws a search in
            place of the title, so the table is still findable by name. */}
        <table
          aria-label={props.title}
          data-plain={display && !display.coloring ? "true" : undefined}
          className="xms-sticky-head w-full border-collapse text-body"
        >
          {props.headless ? (
            <ColumnWidths columns={drawn} selectable={selectable} previewable={Boolean(onRowPreview)} />
          ) : null}
          <ColumnHeaders
            columns={drawn}
            headless={props.headless}
            compact={display?.compact}
            selectable={selectable}
            previewable={Boolean(onRowPreview)}
            allSelected={allSelected}
            sort={sort}
            onToggleAll={toggleAll}
            onSort={setSort}
          />
          <tbody>
            {ordered.map((row) => {
              const key = rowKey(row);
              return (
                <DenseRow
                  key={key}
                  id={key}
                  row={row}
                  columns={drawn}
                  display={display}
                  selectable={selectable}
                  selected={selected.has(key)}
                  active={active === key}
                  onToggle={toggleOne}
                  onActivate={setActive}
                  onRowClick={onRowClick}
                  onRowPreview={onRowPreview}
                />
              );
            })}
            {ordered.length === 0 && !props.loading ? (
              <tr>
                <td
                  colSpan={drawn.length + (selectable ? 1 : 0) + (onRowPreview ? 1 : 0)}
                  className="text-xms-label px-4 py-8 text-center"
                >
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
