"use client";

import { useCallback, useMemo, useState } from "react";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { Panel } from "@/components/xms/panel";
import { Skeleton } from "@/components/xms/skeleton";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import { downloadFile } from "@/lib/exports/download";
import { useTrack } from "@/lib/telemetry/provider";
import { cn } from "@/lib/utils";
import { useMe } from "@/redux/me";
import {
  useLazyAuditSearchQuery,
  type AuditCondition,
  type AuditEvent,
  type AuditField,
  type AuditOperator,
  type AuditQuery,
} from "@/redux/reportingApi";

type FieldKind = "text" | "select" | "datetime";

interface AuditFieldSpec {
  key: AuditField;
  label: string;
  kind: FieldKind;
  options?: Array<{ value: string; label: string }>;
}

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
  { key: "actor_id", label: "Actor", kind: "text" },
  { key: "actor_kind", label: "Actor kind", kind: "text" },
  { key: "principal_kind", label: "Principal kind", kind: "text" },
  { key: "account_id", label: "Account", kind: "text" },
  { key: "entity_kind", label: "Entity kind", kind: "text" },
  { key: "entity_id", label: "Entity", kind: "text" },
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
  { key: "request_id", label: "Request id", kind: "text" },
  { key: "correlation_id", label: "Correlation id", kind: "text" },
  { key: "occurred_at", label: "Occurred", kind: "datetime" },
];

const OPERATORS_BY_KIND: Record<FieldKind, AuditOperator[]> = {
  text: ["eq", "neq", "contains", "in"],
  select: ["eq", "neq", "in"],
  datetime: ["after", "before"],
};

const OPERATOR_LABEL: Record<AuditOperator, string> = {
  eq: "is",
  neq: "is not",
  in: "is any of",
  contains: "contains",
  before: "before",
  after: "after",
};

/** Screen rows keep the raw text; the request body carries typed values (lists for `in`, ISO for dates). */
export interface AuditRow {
  field: AuditField;
  op: AuditOperator;
  value: string;
}

export function rowsToQuery(rows: AuditRow[]): AuditCondition[] {
  const conditions: AuditCondition[] = [];
  for (const row of rows) {
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

const CONTROL = "border-xms-line bg-xms-card text-xms-ink h-[32px] rounded-[4px] border px-2 text-[13px]";

function AuditConditionBuilder({ rows, onChange }: { rows: AuditRow[]; onChange: (rows: AuditRow[]) => void }) {
  const update = (index: number, patch: Partial<AuditRow>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const remove = (index: number) => onChange(rows.filter((_, i) => i !== index));
  const add = () => onChange([...rows, { field: "event_type", op: "contains", value: "" }]);
  return (
    <div className="flex flex-col gap-2" role="group" aria-label="Conditions">
      {rows.map((row, index) => {
        const spec = AUDIT_FIELDS.find((field) => field.key === row.field) ?? AUDIT_FIELDS[0];
        const operators = OPERATORS_BY_KIND[spec.kind];
        return (
          <div key={index} className="flex items-center gap-2" data-condition-row>
            <span className="xms-mono text-xms-muted w-8 text-[11px]">{index === 0 ? "" : "AND"}</span>
            <select
              aria-label="Field"
              value={row.field}
              onChange={(event) => {
                const next = AUDIT_FIELDS.find((field) => field.key === event.target.value) ?? AUDIT_FIELDS[0];
                update(index, { field: next.key, op: OPERATORS_BY_KIND[next.kind][0], value: "" });
              }}
              className={CONTROL}
            >
              {AUDIT_FIELDS.map((field) => (
                <option key={field.key} value={field.key}>
                  {field.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Operator"
              value={row.op}
              onChange={(event) => update(index, { op: event.target.value as AuditOperator })}
              className={CONTROL}
            >
              {operators.map((op) => (
                <option key={op} value={op}>
                  {OPERATOR_LABEL[op]}
                </option>
              ))}
            </select>
            {spec.kind === "select" && row.op !== "in" ? (
              <select
                aria-label="Value"
                value={row.value}
                onChange={(event) => update(index, { value: event.target.value })}
                className={CONTROL}
              >
                <option value="">Choose</option>
                {spec.options!.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
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
              className="text-xms-muted hover:text-xms-ink text-[14px]"
            >
              ×
            </button>
          </div>
        );
      })}
      <button type="button" onClick={add} className="text-xms-accent self-start text-[12px] hover:underline">
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
        <span className="xms-mono text-xms-ink text-[13px] font-semibold">{event.event_type}</span>
        <button type="button" onClick={onClose} className="text-xms-muted hover:text-xms-ink ml-auto text-[14px]">
          Close
        </button>
      </header>
      <p className="xms-mono text-xms-label text-[12px]">{event.occurred_at}</p>
      {event.request_id ? (
        <button type="button" onClick={() => onPivot(event.request_id!)} className={cn(SECONDARY_BUTTON, "self-start")}>
          Show this request
        </button>
      ) : null}
      <section>
        <h3 className="xms-caption mb-1">Envelope</h3>
        <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-1 text-[12px]">
          {Object.entries(envelope).map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="text-xms-label">{key}</dt>
              <dd className="xms-mono text-xms-ink break-all">
                {value === null || value === undefined ? "" : String(value)}
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
                className="xms-mono bg-xms-tint overflow-auto rounded-[4px] p-2 text-[11px]"
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
        <pre className="xms-mono bg-xms-tint overflow-auto rounded-[4px] p-2 text-[11px]" data-testid="attrs">
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
  { key: "stream", title: "Stream", width: "90px", render: (row) => <StreamChip stream={row.stream} /> },
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

  const onSearch = () => void run(rowsToQuery(rows));
  const onPivot = (requestId: string) => {
    const next: AuditRow[] = [{ field: "request_id", op: "eq", value: requestId }];
    setRows(next);
    setSelected(null);
    void run(rowsToQuery(next));
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

  const summary = useMemo(() => (lastQuery ? `${items.length} loaded` : "Run a search"), [items.length, lastQuery]);

  return (
    <div className="flex flex-col gap-4" data-testid="audit-search">
      <Panel
        title="Conditions"
        caption="One search over audit, security and usage"
        actions={
          <>
            {me.hasPermission("audit:export") ? (
              <button type="button" onClick={() => void onExport()} disabled={exporting} className={SECONDARY_BUTTON}>
                {exporting ? "Exporting" : "Export CSV"}
              </button>
            ) : null}
            <button type="button" onClick={onSearch} disabled={result.isFetching} className={PRIMARY_BUTTON}>
              Search
            </button>
          </>
        }
      >
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
          count={items.length}
          columns={COLUMNS}
          rows={items}
          rowKey={(row) => row.id}
          onRowClick={setSelected}
          emptyState={summary}
          footer={
            <div className="border-xms-line flex items-center gap-4 border-t px-4 py-2">
              <span className="xms-mono text-xms-label text-[12px]">{summary}</span>
              {cursor ? (
                <button
                  type="button"
                  onClick={() => void run(lastQuery ?? [], cursor)}
                  disabled={result.isFetching}
                  className={cn(SECONDARY_BUTTON, "ml-auto")}
                >
                  Load more
                </button>
              ) : null}
            </div>
          }
        />
      )}

      {selected ? <RecordDrawer event={selected} onClose={() => setSelected(null)} onPivot={onPivot} /> : null}
    </div>
  );
}
