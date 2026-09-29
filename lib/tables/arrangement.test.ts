import { describe, expect, it } from "vitest";
import type { DenseColumn } from "@/components/xms/dense-table";
import { arrange, choices, defaultSelection, DISPLAY_DEFAULTS, move, readOptions } from "@/lib/tables/arrangement";

interface Row {
  key: string;
}

const COLUMNS: DenseColumn<Row>[] = [
  { key: "key", title: "Key" },
  { key: "state", title: "State" },
  { key: "priority", title: "Priority" },
  // Carried for sorting, not drawn: the Queue opens on the tightest clock
  // without showing the column.
  { key: "sla", title: "SLA", hidden: true, sortValue: (row) => row.key },
];

describe("defaultSelection", () => {
  it("starts with the columns the screen draws, and leaves the sort-only ones out", () => {
    expect(defaultSelection(COLUMNS)).toEqual(["key", "state", "priority"]);
  });
});

describe("choices", () => {
  it("offers every column the screen has, drawn or not", () => {
    expect(choices(COLUMNS).map((choice) => choice.key)).toEqual(["key", "state", "priority", "sla"]);
  });
});

describe("arrange", () => {
  it("draws the reader's columns in the reader's order", () => {
    const arranged = arrange(COLUMNS, ["priority", "key"]);
    expect(arranged.filter((column) => !column.hidden).map((column) => column.key)).toEqual(["priority", "key"]);
  });

  it("keeps an unchosen column for sorting rather than dropping it", () => {
    const arranged = arrange(COLUMNS, ["key"]);
    const sla = arranged.find((column) => column.key === "sla");
    expect(sla?.hidden).toBe(true);
    expect(sla?.sortValue).toBeTypeOf("function");
  });

  it("draws a column the reader chose even where the screen hid it", () => {
    const arranged = arrange(COLUMNS, ["key", "sla"]);
    expect(arranged.find((column) => column.key === "sla")?.hidden).toBe(false);
  });

  it("ignores a key the screen no longer has", () => {
    const arranged = arrange(COLUMNS, ["key", "assigned_building"]);
    expect(arranged.filter((column) => !column.hidden).map((column) => column.key)).toEqual(["key"]);
  });

  it("falls back to the screen's own set when nothing recognised is left", () => {
    expect(arrange(COLUMNS, ["gone", "also_gone"])).toEqual(COLUMNS);
    expect(arrange(COLUMNS, [])).toEqual(COLUMNS);
    expect(arrange(COLUMNS, undefined)).toEqual(COLUMNS);
  });
});

describe("readOptions", () => {
  it("uses the defaults where nothing is saved", () => {
    expect(readOptions(undefined)).toEqual(DISPLAY_DEFAULTS);
  });

  it("takes only booleans, so a stray value cannot make a list unreadable", () => {
    expect(readOptions({ wrap: true, compact: "yes", nonsense: 4 })).toEqual({
      ...DISPLAY_DEFAULTS,
      wrap: true,
    });
  });
});

describe("move", () => {
  it("moves a column up and down the order", () => {
    expect(move(["a", "b", "c"], "c", -1)).toEqual(["a", "c", "b"]);
    expect(move(["a", "b", "c"], "a", 1)).toEqual(["b", "a", "c"]);
  });

  it("refuses to move a column off either end", () => {
    expect(move(["a", "b"], "a", -1)).toEqual(["a", "b"]);
    expect(move(["a", "b"], "b", 1)).toEqual(["a", "b"]);
    expect(move(["a", "b"], "missing", 1)).toEqual(["a", "b"]);
  });
});
