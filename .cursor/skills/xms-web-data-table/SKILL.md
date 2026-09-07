---
name: 'xms-web-data-table'
description: 'Build data tables in frontend with the XMS dense list look fixed by the v2 and v3 wireframes: SortableTable inside a card with a Count badge, removable filter chips with Add filter and Clear all, a blue selection bar for bulk actions, a rows-per-page footer, the state ramp on state pills, 3px type bars, account identity dots, sticky header, no row striping, mono keys and SLA values, row hover then cell hover, 32 to 34px controls, 4px radii, tokenized rules. Use whenever adding or restyling a table in frontend (queue, admin lists, related-info rails, portal lists), when a task says "add a list", "show these in a table", "the table looks wrong", or when you are about to hand-roll table markup. Covers the SortableTable component and the flush recipe for tables inside a Panel or drawer.'
---

# Skill: XMS Data Tables

The dense list is the signature XMS screen and it is ServiceNow-shaped on purpose. The canonical component is **`SortableTable`** (`01-architecture/DESIGN-SYSTEM.md` §2 and `01-architecture/WIREFRAMES.md` §3.1, reference render `01-architecture/wireframes/01-queue.png`), rewritten in XMS from the AIX original with the same props and already carrying the XMS look. Every table matches it, either by using the component or by replicating its rules.

Companion skills: `xms-web-design-system` for tokens, `no-hardcoded-styling` for where styles live, `xms-web-data-endpoint` for where the rows come from.

## The rules (from the screen grammar, §4)

- **A card with a Count badge.** The list sits in a `--xms-card` with a 1px `--xms-line` border and 6px radius; the card header holds "Count 42", an in-card search ("Search by key, description or requester") and the filter and column icons; the content header bar above holds the filter pills.
- **Sticky header**, so the column titles survive a long scroll; a checkbox column first.
- **No row striping.** Rows separate on a single `--xms-line` hairline and a `--xms-row-hover` fill; the v2 wireframes overrode the POC's zebra and there is no zebra token.
- **Row hover then cell hover**: `--xms-row-hover` on the row, `--xms-cell-hover` on the cell under the pointer.
- **Selected row** carries the `--xms-accent` stroke and the `--xms-tint` fill. The accent is a stroke and a tint, never a large fill.
- **32 to 34px controls, 4px radii** in the toolbar and in the table chrome; keys, SLA values and counts in `--xms-mono`; keys are blue links.
- **Filter chips (v3).** Every non-primary pill carries a "×" that removes the criterion and rewrites the URL; a dashed "+ Add filter" opens the condition builder for one criterion; "Clear all" returns to the screen default. The primary "Show:" pill is not removable.
- **Selection bar (v3).** When rows are checked, a `--xms-tint` bar under the card header shows "N selected", the bulk actions (Assign, Change state, Add tag, Export) and the note "one audit event written per record" with a dismiss. Bulk actions write one audit event per record (TM-16).
- **Footer (v3).** "Showing 1 to 10 of 42", the pager, and a "Rows per page" select (10, 25, 50, 100); the page size is part of the saved-view state and the URL.
- **Semantic cells (v3).** State pills use the state ramp (`--xms-state-*`); the Type cell carries a 3px `--xms-type-*` bar beside the label; the Account cell carries an 8px `--xms-account-*` dot before the name. Reference render: `01-architecture/wireframes/v3/01-queue.png`.
- **Cells are ink on card.** `--xms-ink` text on `--xms-card`, rules in `--xms-line`. No gray text, no washed-out secondary cells.
- The toolbar above the list is slim: funnel, "Show" dimension dropdowns, search, New.

## Path 1: use the component

For a page-level list, use `SortableTable` directly:

```tsx
import { SortableTable, type SortableColumn } from "@/components/xms/sortable-table";

interface Row {
  id: string;
  key: string;        // sortable primitive on the row for every sortable column
  shortDescription: string;
  state: string;
  raw: Ticket;        // keep the source object for render fns
}

const COLUMNS: SortableColumn<Row>[] = [
  { key: "key", title: "Number", render: (r) => <span className="font-medium">{r.key}</span> },
  { key: "shortDescription", title: "Short description" },
  { key: "state", title: "State", render: (r) => <StatePill state={r.state} /> },
];
```

- **Sort compares the raw field value**, so put a sortable primitive (string or number) on the row for every sortable column and use `render` only for presentation.
- The component owns its own chrome. Do not wrap it in another card, and do not nest a card inside a card.
- Reach for the component before hand-rolling. A hand-rolled table that drifts is the thing this skill exists to prevent.

## Path 2: flush inside a Panel or drawer

When the table is a section of a larger surface (a `Panel` body, the related-info rail, a slide-over), it goes **flush**: an `overflow-x-auto` wrapper and nothing else. No border, no radius, no shadow. Card-in-card is banned.

Style it from the tokens, never from literals:

- Header band `bg-xms-tint`, titles in `text-xms-ink`, normal case. No uppercase micro-labels, no gray headers, no black header band.
- Row rules `border-xms-line`; no striping; hover `--xms-row-hover`.
- Cells `text-xms-ink` at the 13.5 to 14px body size. Numbers get `tabular-nums`. Code-ish values (ticket keys, correlation ids) get the mono face.
- Ticket states use the state ramp (`--xms-state-*`); SLA, priority and scan state use the `--state-*` trios, never the identity accent. A breached clock is red. P1 and P2 light up, P3 and P4 stay quiet so the priority column reads by exception. Awaiting client amber is a state; at-risk amber is a clock; they never share a cell.

## Server authority

The browser renders and counts down; it does not compute. SLA due times, breach latches, derived priority, burn-down and permissions all arrive from the server. A table cell may format and count down against a server-provided due time, but it must never derive a breach or a priority client-side.

## Steps

1. Decide standalone (use `SortableTable`) or flush inside a surface (recipe above).
2. Shape rows so every sortable column has a primitive field, keeping the source object for `render`.
3. Bind colours to tokens, and signals to `--state-*` trios.
4. Confirm the toolbar geometry (34px controls, 4px radii) and the sticky header.
5. Toggle `.dark` and confirm the band, rules and hover states all invert.

## Checkpoints

- Standalone table using `SortableTable` rather than hand-rolled markup?
- In a Count card, sticky header, no striping, row hover then cell hover?
- Removable chips with Add filter and Clear all, the selection bar on selection, and the rows-per-page footer?
- State pills on the ramp, a type bar beside the type, an account dot before the account?
- Flush inside a Panel or drawer, with no card nested in a card?
- Every colour a token, with no hex and no gray text?
- Signals on the state trios, with P3 and P4 left quiet?
- Sortable columns backed by primitive fields, presentation in `render`?
- Nothing derived client-side that the server is the author of?
