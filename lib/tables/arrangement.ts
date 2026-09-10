import type { DenseColumn } from "@/components/xms/dense-table";

/**
 * How a reader has arranged a list, and the rules for reading that
 * arrangement back over a column set the screen still owns.
 *
 * The screen is authoritative about which columns exist, what they are
 * called, how they sort and how wide they are. The arrangement says only
 * which of them this reader wants and in what order. That split is what
 * makes the store safe to keep: a column that leaves the product simply
 * stops being recognized, and a reader who had chosen it loses one cell
 * rather than their whole list.
 */

/** The display switches beside the two column lists in the dialogue. */
export interface DisplayOptions {
  /** Let every cell wrap to a second line rather than staying on one. */
  wrap: boolean;
  /** Tighter rows, so more of the list fits on a screen. */
  compact: boolean;
  /** Mark the row last opened, so a reader returning to the list finds it. */
  activeRow: boolean;
  /** Let the clock and priority cells carry their color. */
  coloring: boolean;
}

export const DISPLAY_DEFAULTS: DisplayOptions = {
  wrap: false,
  compact: false,
  activeRow: true,
  coloring: true,
};

/** One row of the Available and Selected lists: a column key and its name. */
export interface ColumnChoice {
  key: string;
  title: string;
}

/**
 * A column the screen draws by default is one the arrangement starts with.
 * A column carried only for sorting (`hidden`) starts in Available, where a
 * reader can bring it in.
 */
export function defaultSelection<Row>(columns: DenseColumn<Row>[]): string[] {
  return columns.filter((column) => !column.hidden).map((column) => column.key);
}

/** Every column the screen has, in the order it authored them. */
export function choices<Row>(columns: DenseColumn<Row>[]): ColumnChoice[] {
  return columns.map((column) => ({ key: column.key, title: column.title }));
}

/**
 * Read a saved arrangement over a column set.
 *
 * A saved key the screen no longer has is dropped. A column the screen has
 * that the arrangement does not name is kept, marked hidden, rather than
 * removed: hidden columns still sort, which is how a list can open on a
 * clock the reader has chosen not to draw.
 */
export function arrange<Row>(columns: DenseColumn<Row>[], selection: string[] | undefined): DenseColumn<Row>[] {
  if (!selection || selection.length === 0) return columns;
  const byKey = new Map(columns.map((column) => [column.key, column]));
  const wanted = selection.filter((key) => byKey.has(key));
  if (wanted.length === 0) return columns;
  const drawn = wanted.map((key) => ({ ...(byKey.get(key) as DenseColumn<Row>), hidden: false }));
  const rest = columns.filter((column) => !wanted.includes(column.key)).map((column) => ({ ...column, hidden: true }));
  return [...drawn, ...rest];
}

/**
 * Read saved switches over the defaults, ignoring anything that is not a
 * boolean. The store holds free-form JSON, so a value written by an older
 * version of the dialogue must not be able to make the list unreadable.
 */
export function readOptions(saved: Record<string, unknown> | undefined): DisplayOptions {
  const options = { ...DISPLAY_DEFAULTS };
  if (!saved) return options;
  for (const key of Object.keys(DISPLAY_DEFAULTS) as (keyof DisplayOptions)[]) {
    const value = saved[key];
    if (typeof value === "boolean") options[key] = value;
  }
  return options;
}

/** Move one key up or down within the selection, without letting it fall off. */
export function move(selection: string[], key: string, delta: number): string[] {
  const from = selection.indexOf(key);
  if (from < 0) return selection;
  const to = from + delta;
  if (to < 0 || to >= selection.length) return selection;
  const next = [...selection];
  next.splice(from, 1);
  next.splice(to, 0, key);
  return next;
}
