"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AdminGate, PRIMARY_BUTTON } from "@/components/admin/primitives";
import { HeaderAction, HeaderFilters } from "@/components/shell/content-header-bar";
import { ExportMenu } from "@/components/tickets/export-menu";
import { savedViewLabel, SavedViewsBar, useSavedViews } from "@/components/tickets/saved-views";
import { QUEUE_DEFAULT_SORT, ticketColumns } from "@/components/tickets/ticket-columns";
import { DenseTable } from "@/components/xms/dense-table";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { BreadcrumbTrail } from "@/components/xms/breadcrumb-trail";
import { FilterBar } from "@/components/xms/filter-bar";
import { ScoreTile } from "@/components/xms/score-tile";
import { BulkAction, SelectionBar } from "@/components/xms/selection-bar";
import { Skeleton } from "@/components/xms/skeleton";
import { RowsPerPage, type RowsPerPageOption } from "@/components/xms/table-footer";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import { STARS_KEY, useToggleInList } from "@/lib/persisted-set";
import { useTrack } from "@/lib/telemetry/provider";
import {
  addChip,
  CHIP_KEYS,
  CHIP_LABEL,
  chipsFromSearch,
  chipsToSearch,
  MY_GROUPS,
  OUT_OF_SCOPE,
  outOfScopeLabel,
  QUEUE_VIEWS,
  viewByKey,
  viewToParams,
  type Chip,
  type ChipKey,
} from "@/lib/tickets/queue-views";
import { applyDefinition, savedViewSearch } from "@/lib/tickets/saved-views";
import { PRIORITIES, TICKET_TYPES } from "@/lib/tickets/vocab";
import { cn } from "@/lib/utils";
import { useMe } from "@/redux/me";
import {
  useListDirectoryGroupsQuery,
  useListGrantedAccountsQuery,
  useListTicketsQuery,
  usePatchTicketMutation,
  useWatchTicketMutation,
  type SavedView,
  type TicketView,
} from "@/redux/ticketsApi";
import { groupLabel } from "@/components/tickets/group-picker";

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
  // The export carries the view and chips, never the page cursor or size.
  const exportParams = useMemo(() => viewToParams(view, parsed.chips, { q: parsed.q || undefined }), [view, parsed]);
  const { data: accounts } = useListGrantedAccountsQuery();
  // The assignment groups the group chip names (TM-08); `/v1/groups` stands
  // on tickets:view, the Queue's own gate.
  const { data: groups } = useListDirectoryGroupsQuery();
  // The server's saved views beside the system ones (Ticket Management
  // technical 2.5). `/v1/views` stands on tickets:view, the Queue's own gate,
  // so the only reason it is unavailable is an API that does not serve it
  // yet, and the per-browser star stays the fallback for exactly that.
  const { views: savedViews, available: savedAvailable } = useSavedViews();
  const currentSaved = savedViews.find((entry) => entry.id === parsed.saved) ?? null;
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

  const go = (target: URLSearchParams) => router.push(target.size > 0 ? `${pathname}?${target.toString()}` : pathname);

  // Changing a criterion drops the saved view id: the list is no longer the
  // saved one, and a name over a different list would be a lie. The page size
  // leaves it alone, since it does not change what is being listed.
  const navigate = (next: { view?: string; chips?: Chip[]; q?: string; limit?: number }) => {
    const target = chipsToSearch(
      next.view ?? parsed.view,
      next.chips ?? parsed.chips,
      next.q ?? parsed.q,
      next.limit ?? parsed.limit,
    );
    const criteriaKept = next.view === undefined && next.chips === undefined && next.q === undefined;
    if (criteriaKept && parsed.saved) target.set("saved", parsed.saved);
    go(target);
  };

  /**
   * A saved view is applied by writing its conditions into the URL, so the
   * chips stay removable and the link is still the list. Anything the chip
   * grammar cannot say is named rather than dropped in silence.
   */
  const applySaved = (view: SavedView) => {
    const applied = applyDefinition(view.definition);
    if (applied.notes.length > 0)
      push({ title: `${view.name} applied`, detail: applied.notes.join(" "), tone: "info" });
    go(savedViewSearch(view.id, view.definition, parsed.limit));
  };

  const chipValueLabel = (chip: Chip): string => {
    if (chip.key === "account_id") return accountsById.get(chip.value)?.name ?? chip.value;
    if (chip.key === "type") return TICKET_TYPES.find((type) => type.value === chip.value)?.label ?? chip.value;
    if (chip.key === "priority") return chip.value.toUpperCase();
    if (chip.key === "out_of_scope") return outOfScopeLabel(chip.value);
    if (chip.key === "group_id") return groupLabel(groups, chip.value);
    if (chip.key === "my_groups") return "My groups";
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
      case "out_of_scope":
        return OUT_OF_SCOPE.map((value) => ({ value, label: outOfScopeLabel(value) }));
      case "group_id":
        return (groups ?? []).map((group) => ({ value: group.id, label: group.name }));
      // The group queue is a flag the server answers from the membership
      // table, so the only value on offer is the flag itself.
      case "my_groups":
        return [{ value: MY_GROUPS, label: "My groups" }];
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

  // The condition trail (Wireframes section 2): the active view then each chip,
  // clicking a segment removes that criterion, with the count on the right.
  // Save as view sits under it, on the server's own views; the star into the
  // Favourites list the finder bar reads (frontend review finding 12) is what
  // the bar falls back to while `/v1/views` is not deployed.
  const [, toggleStar, hasStar] = useToggleInList(STARS_KEY);
  const currentHref = searchString ? `${pathname}?${searchString}` : pathname;
  const trail = [
    { key: "view", label: view.label },
    ...parsed.chips.map((chip) => ({ key: `${chip.key}:${chip.value}`, label: chipValueLabel(chip) })),
    ...(parsed.q ? [{ key: "q", label: `Search: ${parsed.q}` }] : []),
  ];
  const removeSegment = (key: string) => {
    if (key === "view") return navigate({ view: QUEUE_VIEWS[0].key });
    if (key === "q") {
      setQuery("");
      return navigate({ q: "" });
    }
    navigate({ chips: parsed.chips.filter((chip) => `${chip.key}:${chip.value}` !== key) });
  };
  const countLabel =
    stats !== undefined ? `${stats.open} open ticket${stats.open === 1 ? "" : "s"}` : `${rows.length} shown`;

  return (
    <div className="flex flex-col gap-4">
      <HeaderFilters>
        <div className="flex items-center gap-2">
          <select
            aria-label="View"
            value={currentSaved ? `saved:${currentSaved.id}` : parsed.view}
            onChange={(event) => {
              const value = event.target.value;
              const saved = savedViews.find((entry) => `saved:${entry.id}` === value);
              if (saved) {
                applySaved(saved);
                return;
              }
              navigate({ view: value });
            }}
            className="border-xms-accent text-xms-accent bg-xms-card h-[28px] rounded-[999px] border px-2 text-[12px] font-medium"
          >
            {QUEUE_VIEWS.map((entry) => (
              <option key={entry.key} value={entry.key}>
                Show: {entry.label}
              </option>
            ))}
            {savedViews.length > 0 ? (
              <optgroup label="Saved views">
                {savedViews.map((entry) => (
                  <option key={entry.id} value={`saved:${entry.id}`}>
                    {savedViewLabel(entry)}
                  </option>
                ))}
              </optgroup>
            ) : null}
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
                {CHIP_KEYS.map((key) => (
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
                  navigate({ chips: addChip(parsed.chips, { key: adding, value: event.target.value }) });
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
        <span className="inline-flex items-center gap-2">
          <ExportMenu params={exportParams} />
          {me.hasPermission("tickets:create") ? (
            <Link href="/tickets/new" className={cn(PRIMARY_BUTTON, "inline-flex items-center")}>
              + New ticket
            </Link>
          ) : null}
        </span>
      </HeaderAction>

      <BreadcrumbTrail segments={trail} onRemove={removeSegment} count={countLabel} />

      <SavedViewsBar
        params={exportParams}
        accounts={accounts ?? []}
        current={currentSaved}
        available={savedAvailable}
        starred={hasStar(currentHref)}
        onToggleStar={() => toggleStar(currentHref)}
        onSaved={applySaved}
        onDeleted={() => navigate({ view: parsed.view })}
      />

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
          defaultSort={QUEUE_DEFAULT_SORT}
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
                className="border-xms-line bg-xms-card text-xms-ink h-[32px] w-full max-w-full rounded-[4px] border px-3 text-[13px] outline-none sm:w-[320px]"
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
