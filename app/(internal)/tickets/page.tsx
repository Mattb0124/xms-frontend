"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AdminGate, PRIMARY_BUTTON } from "@/components/admin/primitives";
import { HeaderAction, HeaderFilters } from "@/components/shell/content-header-bar";
import { ticketColumns } from "@/components/tickets/ticket-columns";
import { DenseTable } from "@/components/xms/dense-table";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { FilterBar } from "@/components/xms/filter-bar";
import { ScoreTile } from "@/components/xms/score-tile";
import { BulkAction, SelectionBar } from "@/components/xms/selection-bar";
import { Skeleton } from "@/components/xms/skeleton";
import { RowsPerPage, type RowsPerPageOption } from "@/components/xms/table-footer";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import { useTrack } from "@/lib/telemetry/provider";
import {
  CHIP_LABEL,
  chipsFromSearch,
  chipsToSearch,
  QUEUE_VIEWS,
  viewByKey,
  viewToParams,
  type Chip,
  type ChipKey,
} from "@/lib/tickets/queue-views";
import { PRIORITIES, TICKET_TYPES } from "@/lib/tickets/vocab";
import { cn } from "@/lib/utils";
import { useMe } from "@/redux/me";
import {
  useListGrantedAccountsQuery,
  useListTicketsQuery,
  usePatchTicketMutation,
  useWatchTicketMutation,
  type TicketView,
} from "@/redux/ticketsApi";

const STATE_OPTIONS = [
  "new",
  "assigned",
  "in_progress",
  "awaiting_client",
  "awaiting_third_party",
  "resolved",
  "closed",
  "cancelled",
];

const CHIP_SELECT = "border-xms-line bg-xms-card text-xms-ink h-[28px] rounded-[4px] border px-2 text-[12px]";

/**
 * The Queue (User Experience 3.2, Wireframes v3 section 8): a system view
 * switcher, removable chips, the Count card with the dense table, the
 * stats strip, a selection bar, rows per page and cursor paging. The URL
 * is the state, so a pasted link reproduces the list.
 */
function QueueScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const me = useMe();
  const { push } = useToast();
  const searchString = search.toString();
  const parsed = useMemo(() => chipsFromSearch(new URLSearchParams(searchString)), [searchString]);
  const view = viewByKey(parsed.view);
  const [cursor, setCursor] = useState<string | undefined>();
  const [previous, setPrevious] = useState<string[]>([]);
  const [adding, setAdding] = useState<ChipKey | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState(parsed.q);

  const params = useMemo(
    () => viewToParams(view, parsed.chips, { q: parsed.q || undefined, limit: parsed.limit, cursor }),
    [view, parsed, cursor],
  );
  const { data, isLoading, isError, refetch } = useListTicketsQuery(params, { pollingInterval: 60_000 });
  const { data: accounts } = useListGrantedAccountsQuery();
  const [patch] = usePatchTicketMutation();
  const [watch] = useWatchTicketMutation();
  const trackAssign = useTrack("dispatch.assign");

  const accountsById = useMemo(() => new Map((accounts ?? []).map((account) => [account.id, account])), [accounts]);
  const columns = useMemo(() => ticketColumns({ accounts: accountsById }), [accountsById]);
  const rows = useMemo(() => data?.items ?? [], [data]);

  // A new URL (view, chips, search, page size) restarts paging and selection
  // (state derived from props during render, no effect).
  const [seenSearch, setSeenSearch] = useState(searchString);
  if (seenSearch !== searchString) {
    setSeenSearch(searchString);
    setCursor(undefined);
    setPrevious([]);
    setSelected(new Set());
  }

  const navigate = (next: { view?: string; chips?: Chip[]; q?: string; limit?: number }) => {
    const target = chipsToSearch(
      next.view ?? parsed.view,
      next.chips ?? parsed.chips,
      next.q ?? parsed.q,
      next.limit ?? parsed.limit,
    );
    router.push(target.size > 0 ? `${pathname}?${target.toString()}` : pathname);
  };

  const chipValueLabel = (chip: Chip): string => {
    if (chip.key === "account_id") return accountsById.get(chip.value)?.name ?? chip.value;
    if (chip.key === "type") return TICKET_TYPES.find((type) => type.value === chip.value)?.label ?? chip.value;
    if (chip.key === "priority") return chip.value.toUpperCase();
    return chip.value.replace(/_/g, " ");
  };

  const chipOptions = (key: ChipKey): { value: string; label: string }[] => {
    switch (key) {
      case "account_id":
        return (accounts ?? []).map((account) => ({ value: account.id, label: account.name }));
      case "type":
        return TICKET_TYPES.map((type) => ({ value: type.value, label: type.label }));
      case "priority":
        return PRIORITIES.map((priority) => ({ value: priority, label: priority.toUpperCase() }));
      case "state":
        return STATE_OPTIONS.map((state) => ({ value: state, label: state.replace(/_/g, " ") }));
    }
  };

  const assignSelected = async () => {
    const userId = me.principal?.userId;
    if (!userId) return;
    const targets = rows.filter((row) => selected.has(row.key));
    let done = 0;
    for (const ticket of targets) {
      try {
        await patch({ key: ticket.key, body: { version: ticket.version, assignee_id: userId } }).unwrap();
        done += 1;
      } catch (error) {
        push({ title: `${ticket.key} not assigned`, detail: describeError(apiError(error)), tone: "error" });
      }
    }
    trackAssign({ count: done, via: "bulk" });
    push({ title: `${done} assigned to you`, tone: "success" });
    setSelected(new Set());
  };

  const watchSelected = async () => {
    for (const key of selected) {
      await watch({ key, muted: false })
        .unwrap()
        .catch(() => undefined);
    }
    push({ title: `Watching ${selected.size}`, tone: "success" });
    setSelected(new Set());
  };

  const stats = data?.stats;
  const filtered = parsed.chips.length > 0 || parsed.q !== "";

  return (
    <div className="flex flex-col gap-4">
      <HeaderFilters>
        <div className="flex items-center gap-2">
          <select
            aria-label="View"
            value={parsed.view}
            onChange={(event) => navigate({ view: event.target.value })}
            className="border-xms-accent text-xms-accent bg-xms-card h-[28px] rounded-[999px] border px-2 text-[12px] font-medium"
          >
            {QUEUE_VIEWS.map((entry) => (
              <option key={entry.key} value={entry.key}>
                Show: {entry.label}
              </option>
            ))}
          </select>
          <FilterBar
            criteria={parsed.chips.map((chip) => ({
              key: `${chip.key}:${chip.value}`,
              label: CHIP_LABEL[chip.key],
              value: chipValueLabel(chip),
            }))}
            onRemove={(id) => navigate({ chips: parsed.chips.filter((chip) => `${chip.key}:${chip.value}` !== id) })}
            onAdd={() => setAdding((current) => (current ? null : "account_id"))}
            onClearAll={() => navigate({ chips: [], q: "" })}
          />
          {adding ? (
            <span className="flex items-center gap-1" data-testid="add-filter">
              <select
                aria-label="Filter dimension"
                value={adding}
                onChange={(event) => setAdding(event.target.value as ChipKey)}
                className={CHIP_SELECT}
              >
                {(Object.keys(CHIP_LABEL) as ChipKey[]).map((key) => (
                  <option key={key} value={key}>
                    {CHIP_LABEL[key]}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter value"
                defaultValue=""
                onChange={(event) => {
                  if (!event.target.value) return;
                  navigate({ chips: [...parsed.chips, { key: adding, value: event.target.value }] });
                  setAdding(null);
                }}
                className={CHIP_SELECT}
              >
                <option value="">Choose</option>
                {chipOptions(adding).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </span>
          ) : null}
        </div>
      </HeaderFilters>
      <HeaderAction>
        {me.hasPermission("tickets:create") ? (
          <Link href="/tickets/new" className={cn(PRIMARY_BUTTON, "inline-flex items-center")}>
            + New ticket
          </Link>
        ) : null}
      </HeaderAction>

      {stats ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="stats-strip">
          <ScoreTile label="Open" value={stats.open} href="/tickets" />
          <ScoreTile
            label="Unassigned"
            value={stats.unassigned}
            tone={stats.unassigned > 0 ? "warn" : "neutral"}
            href="/tickets?view=unassigned"
          />
          <ScoreTile
            label="Breached"
            value={stats.breached}
            tone={stats.breached > 0 ? "breach" : "good"}
            href="/tickets?view=breached"
          />
          <ScoreTile
            label="P1 open"
            value={stats.p1}
            tone={stats.p1 > 0 ? "breach" : "neutral"}
            href="/tickets?view=p1"
          />
        </div>
      ) : null}

      {isError ? (
        <div className="border-xms-line bg-xms-card flex items-center gap-3 rounded-[6px] border px-4 py-2 text-[13px]">
          <span className="text-xms-ink">The list could not be refreshed. The last data stays visible.</span>
          <button type="button" onClick={() => refetch()} className="text-xms-accent ml-auto hover:underline">
            Retry
          </button>
        </div>
      ) : null}

      {isLoading && !data ? (
        <Skeleton lines={8} />
      ) : (
        <DenseTable<TicketView>
          title="Count"
          count={rows.length}
          columns={columns}
          rows={rows}
          rowKey={(row) => row.key}
          selectable
          selected={selected}
          onSelectionChange={setSelected}
          onRowClick={(row) => router.push(`/tickets/${row.key}`)}
          search={
            <form
              onSubmit={(event) => {
                event.preventDefault();
                navigate({ q: query.trim() });
              }}
            >
              <input
                type="search"
                aria-label="Search by key, description or requester"
                placeholder="Search by key, description or requester"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="border-xms-line bg-xms-card text-xms-ink h-[32px] w-[320px] rounded-[4px] border px-3 text-[13px] outline-none"
              />
            </form>
          }
          banner={
            <SelectionBar count={selected.size} onDismiss={() => setSelected(new Set())}>
              <BulkAction label="Assign to me" onClick={() => void assignSelected()} />
              <BulkAction label="Watch" onClick={() => void watchSelected()} />
            </SelectionBar>
          }
          emptyState={
            <EmptyBanner
              title={`Nothing in ${view.label}`}
              detail={filtered ? "Clear the filters to widen the list." : undefined}
              action={filtered ? { label: "Clear all", onClick: () => navigate({ chips: [], q: "" }) } : undefined}
            />
          }
          footer={
            <div className="border-xms-line flex items-center gap-4 border-t px-4 py-2">
              <span className="xms-mono text-xms-label text-[12px]">
                {rows.length} on page {previous.length + 1}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  disabled={previous.length === 0}
                  onClick={() => {
                    const stack = [...previous];
                    const last = stack.pop();
                    setPrevious(stack);
                    setCursor(last === "" ? undefined : last);
                  }}
                  className="border-xms-line text-xms-body h-[28px] rounded-[4px] border px-2 text-[12px] disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={!data?.next_cursor}
                  onClick={() => {
                    if (!data?.next_cursor) return;
                    setPrevious([...previous, cursor ?? ""]);
                    setCursor(data.next_cursor);
                  }}
                  className="border-xms-line text-xms-body h-[28px] rounded-[4px] border px-2 text-[12px] disabled:opacity-40"
                >
                  Next
                </button>
              </div>
              <RowsPerPage value={parsed.limit} onChange={(size: RowsPerPageOption) => navigate({ limit: size })} />
            </div>
          }
        />
      )}
    </div>
  );
}

export default function QueuePage() {
  return (
    <AdminGate permission="tickets:view">
      <Suspense fallback={<Skeleton lines={8} />}>
        <QueueScreen />
      </Suspense>
    </AdminGate>
  );
}
