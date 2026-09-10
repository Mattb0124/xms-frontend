"use client";

import { useCallback, useMemo, useState } from "react";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { HeaderAction } from "@/components/shell/content-header-bar";
import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { StripSelect } from "@/components/xms/filter-select";
import { ICON, CloseIcon } from "@/components/xms/icons";
import { Panel } from "@/components/xms/panel";
import { Skeleton } from "@/components/xms/skeleton";
import { useToast } from "@/components/xms/toast";
import { SavedQueriesPanel } from "@/components/admin/saved-queries";
import { apiError, describeError } from "@/lib/admin/api-error";
import { downloadFile } from "@/lib/exports/download";
import { describeSavedQueryError } from "@/lib/reporting/saved-queries";
import { useTrack } from "@/lib/telemetry/provider";
import { cn } from "@/lib/utils";
import { useMe } from "@/redux/me";
import {
  useLazyAuditSearchQuery,
  useRunAuditSavedQueryMutation,
  type AuditCondition,
  type AuditEvent,
  type AuditField,
  type AuditOperator,
  type AuditQuery,
  type AuditSavedQuery,
  type SavedQueryPage,
} from "@/redux/reportingApi";

type FieldKind = "text" | "select" | "datetime";

interface AuditFieldSpec {
  key: AuditField;
  label: string;
  kind: FieldKind;
  options?: Array<{ value: string; label: string }>;
  /**
   * The two null tests, worded for this field. Only a column of
   * `rpt.events_v` that can be null carries them; the API refuses the pair on
   * every column each branch of the view writes, where a null test would be
   * a mistake rather than a filter.
   */
  nulls?: { is_null: string; is_not_null: string };
}

/** The default wording where a nullable field needs no better one. */
const NULL_LABELS = { is_null: "is empty", is_not_null: "is not empty" };

export const AUDIT_FIELDS: AuditFieldSpec[] = [
  {
    key: "stream",
    label: "Stream",
    kind: "select",
    options: [
      { value: "audit", label: "Audit" },
      { value: "security", label: "Security" },
      { value: "usage", label: "Usage" },
    ],
  },
  { key: "event_type", label: "Event type", kind: "text" },
  { key: "actor_id", label: "Actor", kind: "text", nulls: { is_null: "is nobody", is_not_null: "is anybody" } },
  { key: "actor_kind", label: "Actor kind", kind: "text" },
  { key: "principal_kind", label: "Principal kind", kind: "text", nulls: NULL_LABELS },
  // The Portfolio-wide filter (backend c16f7f0). `account_id` is nullable in
  // `rpt.events_v`: the operator audit stream and the portfolio-wide security
  // events carry none, and asking for exactly those rows is `is_null`. `neq`
  // is not that question, since it compiles to "is distinct from" and returns
  // every other account beside them, and no stand-in value could stand for a
  // null on a uuid column. "Any account" is the other half of the pair.
  {
    key: "account_id",
    label: "Account",
    kind: "text",
    nulls: { is_null: "is Portfolio-wide", is_not_null: "is any account" },
  },
  { key: "entity_kind", label: "Entity kind", kind: "text", nulls: NULL_LABELS },
  { key: "entity_id", label: "Entity", kind: "text", nulls: NULL_LABELS },
  {
    key: "outcome",
    label: "Outcome",
    kind: "select",
    options: [
      { value: "success", label: "Success" },
      { value: "denied", label: "Denied" },
      { value: "failed", label: "Failed" },
    ],
  },
  { key: "request_id", label: "Request id", kind: "text", nulls: NULL_LABELS },
  { key: "correlation_id", label: "Correlation id", kind: "text", nulls: NULL_LABELS },
  { key: "occurred_at", label: "Occurred", kind: "datetime" },
];

const OPERATORS_BY_KIND: Record<FieldKind, AuditOperator[]> = {
  text: ["eq", "neq", "contains", "in"],
  select: ["eq", "neq", "in"],
  datetime: ["after", "before"],
};

/** The operators this field offers: its kind's, then the null tests where the column can be null. */
export function operatorsFor(spec: AuditFieldSpec): AuditOperator[] {
  const base = OPERATORS_BY_KIND[spec.kind];
  return spec.nulls ? [...base, "is_null", "is_not_null"] : base;
}

const OPERATOR_LABEL: Record<AuditOperator, string> = {
  eq: "is",
  neq: "is not",
  in: "is any of",
  contains: "contains",
  before: "before",
  after: "after",
  is_null: "is empty",
  is_not_null: "is not empty",
};

/** The null tests read in the field's own words ("is Portfolio-wide"), the rest in the operator's. */
export function operatorLabel(spec: AuditFieldSpec, op: AuditOperator): string {
  if (op === "is_null" || op === "is_not_null") return spec.nulls?.[op] ?? OPERATOR_LABEL[op];
  return OPERATOR_LABEL[op];
}

/** True for the two operators that ask about the column itself and carry no value. */
export function isNullTest(op: AuditOperator): boolean {
  return op === "is_null" || op === "is_not_null";
}

/** Screen rows keep the raw text; the request body carries typed values (lists for `in`, ISO for dates). */
export interface AuditRow {
  field: AuditField;
  op: AuditOperator;
  value: string;
}

export function rowsToQuery(rows: AuditRow[]): AuditCondition[] {
  const conditions: AuditCondition[] = [];
  for (const row of rows) {
    // A null test asks about the column and carries no value; sending one
    // with it is a 400, so the row's text is dropped rather than attached.
    if (isNullTest(row.op)) {
      conditions.push({ field: row.field, op: row.op });
      continue;
    }
    const text = row.value.trim();
    if (!text) continue;
    if (row.op === "in") {
      const list = text
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
      if (list.length > 0) conditions.push({ field: row.field, op: "in", value: list });
      continue;
    }
    const spec = AUDIT_FIELDS.find((field) => field.key === row.field);
    const value =
      spec?.kind === "datetime" && !Number.isNaN(new Date(text).getTime()) ? new Date(text).toISOString() : text;
    conditions.push({ field: row.field, op: row.op, value });
  }
  return conditions;
}

/**
 * The other direction, for loading a saved query back into the builder: the
 * request body as screen rows. A datetime is written in the local wording the
 * `datetime-local` control reads rather than the ISO instant, so a loaded row
 * sends back the moment it was saved and not one shifted by the reader's own
 * offset.
 */
export function rowsFromConditions(conditions: AuditCondition[]): AuditRow[] {
  return conditions.map((condition) => {
    if (isNullTest(condition.op)) return { field: condition.field, op: condition.op, value: "" };
    if (condition.op === "in")
      return {
        field: condition.field,
        op: condition.op,
        value: (Array.isArray(condition.value) ? condition.value : []).join(", "),
      };
    const spec = AUDIT_FIELDS.find((field) => field.key === condition.field);
    const raw = String(condition.value ?? "");
    return { field: condition.field, op: condition.op, value: spec?.kind === "datetime" ? localMoment(raw) : raw };
  });
}

function localMoment(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

const CONTROL = "border-xms-line bg-xms-card text-xms-ink h-[32px] rounded-[4px] border px-2 text-[14px]";

function AuditConditionBuilder({ rows, onChange }: { rows: AuditRow[]; onChange: (rows: AuditRow[]) => void }) {
  const update = (index: number, patch: Partial<AuditRow>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const remove = (index: number) => onChange(rows.filter((_, i) => i !== index));
  const add = () => onChange([...rows, { field: "event_type", op: "contains", value: "" }]);
  return (
    <div className="flex flex-col gap-2" role="group" aria-label="Conditions">
      {rows.map((row, index) => {
        const spec = AUDIT_FIELDS.find((field) => field.key === row.field) ?? AUDIT_FIELDS[0];
        const operators = operatorsFor(spec);
        return (
          <div key={index} className="flex items-center gap-2" data-condition-row>
            <span className="xms-mono text-xms-muted w-8 text-[14px]">{index === 0 ? "" : "AND"}</span>
            {/* The Cases list's builder settled this in pass two: a bare select
                takes the platform's height, padding and chevron, so a row of
                them reads as browser widgets rather than as the reference's
                32px controls. */}
            <StripSelect
              ariaLabel="Field"
              value={row.field}
              display={spec.label}
              onChange={(value) => {
                const next = AUDIT_FIELDS.find((field) => field.key === value) ?? AUDIT_FIELDS[0];
                update(index, { field: next.key, op: operatorsFor(next)[0], value: "" });
              }}
            >
              {AUDIT_FIELDS.map((field) => (
                <option key={field.key} value={field.key}>
                  {field.label}
                </option>
              ))}
            </StripSelect>
            <StripSelect
              ariaLabel="Operator"
              value={row.op}
              display={operatorLabel(spec, row.op)}
              onChange={(value) => update(index, { op: value as AuditOperator })}
            >
              {operators.map((op) => (
                <option key={op} value={op}>
                  {operatorLabel(spec, op)}
                </option>
              ))}
            </StripSelect>
            {isNullTest(row.op) ? null : spec.kind === "select" && row.op !== "in" ? (
              <StripSelect
                ariaLabel="Value"
                value={row.value}
                display={spec.options!.find((option) => option.value === row.value)?.label ?? "Choose"}
                onChange={(value) => update(index, { value })}
              >
                <option value="">Choose</option>
                {spec.options!.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </StripSelect>
            ) : (
              <input
                aria-label="Value"
                type={spec.kind === "datetime" ? "datetime-local" : "text"}
                placeholder={row.op === "in" ? "a, b, c" : undefined}
                value={row.value}
                onChange={(event) => update(index, { value: event.target.value })}
                className={cn(CONTROL, "min-w-[200px]")}
              />
            )}
            <button
              type="button"
              aria-label="Remove condition"
              onClick={() => remove(index)}
              className="text-xms-muted hover:text-xms-ink"
            >
              <CloseIcon size={ICON.glyph} />
            </button>
          </div>
        );
      })}
      <button type="button" onClick={add} className="text-xms-accent self-start text-[14px] hover:underline">
        + Add condition
      </button>
    </div>
  );
}

const STREAM_TONE: Record<string, string> = {
  audit: "new",
  security: "awaiting-client",
  usage: "closed",
};

function StreamChip({ stream }: { stream: string }) {
  return (
    <span className="xms-state" data-state={STREAM_TONE[stream] ?? "closed"}>
      {stream}
    </span>
  );
}

const SCOPE_LABEL: Record<string, string> = { operator: "Operator" };

/**
 * The scope the server recorded the row at. Everything done to a user, a
 * role, a group or a configuration catalog goes to `op.audit_events`, and
 * migration 0033 unions that table into the same `audit` stream with a null
 * account and `attrs.scope = 'operator'`, because those entities have no
 * account of their own. The chip is read off the attribute the server sent
 * and nothing else, so a stream that starts carrying another scope names it
 * rather than being mistaken for an operator record.
 */
export function scopeOf(event: AuditEvent): string | null {
  const scope = event.attrs && typeof event.attrs === "object" ? (event.attrs as Record<string, unknown>).scope : null;
  return typeof scope === "string" && scope.length > 0 ? scope : null;
}

function ScopeChip({ scope }: { scope: string }) {
  return (
    <span className="xms-state" data-state="ready" data-scope={scope}>
      {SCOPE_LABEL[scope] ?? scope}
    </span>
  );
}

/**
 * A row with no account is portfolio-wide: the operator audit stream and the
 * security events the platform records for nobody in particular. It is
 * labelled rather than left blank, so an empty cell is never read as a
 * missing account.
 */
export function accountLabel(event: AuditEvent): string {
  return event.account_id ? event.account_id.slice(0, 8) : "Portfolio";
}

function outcomeClass(outcome: string | null): string {
  if (outcome === "denied" || outcome === "failed") return "text-[color:var(--state-overdue-text)] font-semibold";
  if (outcome === "success") return "text-[color:var(--state-complete-text)]";
  return "text-xms-label";
}

function RecordDrawer({
  event,
  onClose,
  onPivot,
}: {
  event: AuditEvent;
  onClose: () => void;
  onPivot: (requestId: string) => void;
}) {
  const { attrs, ...envelope } = event;
  const changes = attrs && typeof attrs === "object" && ("old" in attrs || "new" in attrs) ? attrs : null;
  return (
    <aside
      role="dialog"
      aria-label="Event record"
      className="border-xms-line bg-xms-card fixed inset-y-0 right-0 z-30 flex w-full max-w-[520px] flex-col gap-3 overflow-auto border-l p-4 shadow-xl"
    >
      <header className="flex items-center gap-3">
        <StreamChip stream={event.stream} />
        {scopeOf(event) ? <ScopeChip scope={scopeOf(event)!} /> : null}
        <span className="xms-mono text-xms-ink text-[14px] font-semibold">{event.event_type}</span>
        <button type="button" onClick={onClose} className="text-xms-muted hover:text-xms-ink ml-auto text-[14px]">
          Close
        </button>
      </header>
      <p className="xms-mono text-xms-label text-[14px]">{event.occurred_at}</p>
      {event.request_id ? (
        <button type="button" onClick={() => onPivot(event.request_id!)} className={cn(SECONDARY_BUTTON, "self-start")}>
          Show this request
        </button>
      ) : null}
      <section>
        <h3 className="xms-caption mb-1">Envelope</h3>
        <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-1 text-[14px]">
          {Object.entries(envelope).map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="text-xms-label">{key}</dt>
              <dd className="xms-mono text-xms-ink break-all">
                {key === "account_id" && value === null
                  ? "Portfolio"
                  : value === null || value === undefined
                    ? ""
                    : String(value)}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      {changes ? (
        <section className="grid grid-cols-2 gap-3">
          {(["old", "new"] as const).map((side) => (
            <div key={side}>
              <h3 className="xms-caption mb-1">{side === "old" ? "Old values" : "New values"}</h3>
              <pre
                className="xms-mono bg-xms-tint overflow-auto rounded-[4px] p-2 text-[14px]"
                data-testid={`attrs-${side}`}
              >
                {JSON.stringify((changes as Record<string, unknown>)[side] ?? null, null, 2)}
              </pre>
            </div>
          ))}
        </section>
      ) : null}
      <section>
        <h3 className="xms-caption mb-1">Attributes</h3>
        <pre className="xms-mono bg-xms-tint overflow-auto rounded-[4px] p-2 text-[14px]" data-testid="attrs">
          {JSON.stringify(attrs ?? {}, null, 2)}
        </pre>
      </section>
    </aside>
  );
}

const COLUMNS: DenseColumn<AuditEvent>[] = [
  {
    key: "occurred_at",
    title: "Time",
    mono: true,
    width: "160px",
    render: (row) => row.occurred_at.slice(0, 19).replace("T", " "),
  },
  {
    key: "stream",
    title: "Stream",
    width: "150px",
    render: (row) => {
      const scope = scopeOf(row);
      return (
        <span className="flex flex-wrap items-center gap-1">
          <StreamChip stream={row.stream} />
          {scope ? <ScopeChip scope={scope} /> : null}
        </span>
      );
    },
  },
  {
    key: "account",
    title: "Account",
    width: "110px",
    sortValue: (row) => accountLabel(row),
    render: (row) =>
      row.account_id ? (
        <span className="xms-mono text-xms-body" data-account={row.account_id}>
          {accountLabel(row)}
        </span>
      ) : (
        <span className="text-xms-label" data-account="portfolio">
          {accountLabel(row)}
        </span>
      ),
  },
  { key: "event_type", title: "Event", mono: true, render: (row) => row.event_type },
  { key: "actor", title: "Actor", render: (row) => row.actor_name ?? row.actor_id ?? "" },
  {
    key: "outcome",
    title: "Outcome",
    render: (row) => <span className={outcomeClass(row.outcome)}>{row.outcome ?? ""}</span>,
  },
  {
    key: "entity",
    title: "Entity",
    render: (row) => (row.entity_kind ? `${row.entity_kind} ${row.entity_id ?? ""}`.trim() : ""),
  },
  { key: "request_id", title: "Request", mono: true, render: (row) => row.request_id ?? "" },
];

const PAGE = 100;

/**
 * Audit search (Audit & Analytics 7.1, P2.11.5): one search over the three
 * event streams with the condition builder, the results list, a record
 * drawer with the full envelope and old and new values, "Show this request"
 * and Load more over the keyset cursor. Export CSV needs audit:export.
 *
 * The `audit` stream carries the operator half as well now (backend
 * migration 0033): a change to a user, a role, a group or a configuration
 * catalog arrives with no account and `attrs.scope = 'operator'`. Those rows
 * read as Portfolio where the account would be and carry an Operator chip,
 * so a portfolio-wide record is never mistaken for one whose account went
 * missing.
 */
export function AuditSearch({ initialRows }: { initialRows?: AuditRow[] }) {
  const me = useMe();
  const { push } = useToast();
  const track = useTrack("audit.search");
  const [rows, setRows] = useState<AuditRow[]>(initialRows ?? [{ field: "stream", op: "eq", value: "audit" }]);
  const [items, setItems] = useState<AuditEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState<AuditCondition[] | null>(null);
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const [search, result] = useLazyAuditSearchQuery();
  const [exporting, setExporting] = useState(false);
  // The saved query these rows came from, where they came from one. It names
  // the list and decides which route pages it: a saved query pages through
  // its own run route, so the second page is the same query the first was.
  const [ranQuery, setRanQuery] = useState<AuditSavedQuery | null>(null);
  const [runSaved, runningSaved] = useRunAuditSavedQueryMutation();

  const run = useCallback(
    async (conditions: AuditCondition[], after?: string) => {
      const query: AuditQuery = { conditions, limit: PAGE, ...(after ? { cursor: after } : {}) };
      try {
        const page = await search(query).unwrap();
        setItems((current) => (after ? [...current, ...page.items] : page.items));
        setCursor(page.next_cursor);
        setLastQuery(conditions);
        if (!after) track({ conditions: conditions.length, result_count: page.items.length }, "search.run");
      } catch (error) {
        push({ title: "Search failed", detail: describeError(apiError(error)), tone: "error" });
      }
    },
    [search, track, push],
  );

  const onSearch = () => {
    setRanQuery(null);
    void run(rowsToQuery(rows));
  };
  const onPivot = (requestId: string) => {
    const next: AuditRow[] = [{ field: "request_id", op: "eq", value: requestId }];
    setRows(next);
    setSelected(null);
    setRanQuery(null);
    void run(rowsToQuery(next));
  };

  /** The first page of a saved query, from the panel below the results. */
  const onRan = (page: SavedQueryPage) => {
    setItems(page.items);
    setCursor(page.next_cursor);
    setLastQuery(page.saved_query.conditions);
    setRanQuery(page.saved_query);
    setSelected(null);
    track({ conditions: page.saved_query.conditions.length, result_count: page.items.length }, "search.run");
  };

  const loadMore = async () => {
    if (!cursor) return;
    if (!ranQuery) return void run(lastQuery ?? [], cursor);
    try {
      const page = await runSaved({ id: ranQuery.id, limit: PAGE, cursor }).unwrap();
      setItems((current) => [...current, ...page.items]);
      setCursor(page.next_cursor);
    } catch (error) {
      const { code, details, permission } = apiError(error);
      push({
        title: `${ranQuery.name} did not run`,
        detail: describeSavedQueryError(code, details, permission),
        tone: "error",
      });
    }
  };

  const onExport = async () => {
    setExporting(true);
    try {
      const file = await downloadFile({
        url: "/v1/audit/export",
        method: "POST",
        body: { conditions: lastQuery ?? rowsToQuery(rows) },
        fallbackName: "events.csv",
      });
      push({ title: "Events exported", detail: file.fileName, tone: "success" });
    } catch {
      push({ title: "Export not produced", tone: "error" });
    } finally {
      setExporting(false);
    }
  };

  const summary = useMemo(() => {
    if (!lastQuery) return "Run a search";
    return ranQuery ? `${items.length} loaded from ${ranQuery.name}` : `${items.length} loaded`;
  }, [items.length, lastQuery, ranQuery]);

  return (
    <div className="flex flex-col gap-4" data-testid="audit-search">
      {/* The two actions are the screen's, not the card's, so they stand in
          the toolbar right where every other screen puts its own. */}
      <HeaderAction>
        {me.hasPermission("audit:export") ? (
          <button type="button" onClick={() => void onExport()} disabled={exporting} className={SECONDARY_BUTTON}>
            {exporting ? "Exporting" : "Export CSV"}
          </button>
        ) : null}
        <button type="button" onClick={onSearch} disabled={result.isFetching} className={PRIMARY_BUTTON}>
          Search
        </button>
      </HeaderAction>
      <Panel title="Conditions" caption="One search over audit, security and usage">
        <AuditConditionBuilder rows={rows} onChange={setRows} />
      </Panel>

      {result.isError && items.length === 0 ? (
        <EmptyBanner title="The search failed" detail="Check the conditions and try again." />
      ) : null}

      {result.isFetching && items.length === 0 ? (
        <Skeleton lines={6} />
      ) : (
        <DenseTable<AuditEvent>
          title="Events"
          columns={COLUMNS}
          rows={items}
          rowKey={(row) => row.id}
          onRowClick={setSelected}
          emptyState={summary}
          // The count is said once. It was in the footer and again in the
          // empty state, so an unrun search read "Run a search" twice.
          footer={
            items.length === 0 ? null : (
              <div className="border-xms-line flex items-center gap-4 border-t px-4 py-2">
                <span className="xms-mono text-xms-label text-[14px]">{summary}</span>
                {cursor ? (
                  <button
                    type="button"
                    onClick={() => void loadMore()}
                    disabled={result.isFetching || runningSaved.isLoading}
                    className={cn(SECONDARY_BUTTON, "ml-auto")}
                  >
                    Load more
                  </button>
                ) : null}
              </div>
            )
          }
        />
      )}

      <SavedQueriesPanel
        conditions={rowsToQuery(rows)}
        onRan={onRan}
        onLoad={(query) => {
          setRows(rowsFromConditions(query.conditions));
          setRanQuery(null);
        }}
      />

      {selected ? <RecordDrawer event={selected} onClose={() => setSelected(null)} onPivot={onPivot} /> : null}
    </div>
  );
}
