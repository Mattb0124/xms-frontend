"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AdminGate } from "@/components/admin/primitives";
import type { PreviewAnchor } from "@/components/cases/case-preview";
import { QueueFilters } from "@/components/tickets/queue-filters";
import { queueSearchTarget, type QueueNavigate } from "@/components/tickets/queue-navigation";
import { QueueShow } from "@/components/tickets/queue-show";
import { QueueTable } from "@/components/tickets/queue-table";
import { useSavedViews } from "@/components/tickets/saved-views";
import { ticketColumns } from "@/components/tickets/ticket-columns";
import { useListArrangement } from "@/components/xms/use-list-arrangement";
import { Skeleton } from "@/components/xms/skeleton";
import { useToast } from "@/components/xms/toast";
import { parseConditions } from "@/lib/conditions";
import { STARS_KEY, useToggleInList } from "@/lib/persisted-set";
import { LIVE_REFRESH_MS } from "@/lib/refresh";
import { CONDITIONS_PARAM, conditionsParam, queueConditionFields } from "@/lib/tickets/queue-conditions";
import { chipsFromSearch, viewByKey, viewToParams } from "@/lib/tickets/queue-views";
import { applyDefinition, savedViewSearch } from "@/lib/tickets/saved-views";
import { useQueueBulk } from "@/components/tickets/use-queue-bulk";
import { useMe } from "@/redux/me";
import {
  useListDirectoryGroupsQuery,
  useListGrantedAccountsQuery,
  useListTicketsQuery,
  type SavedView,
} from "@/redux/ticketsApi";

/**
 * The Cases list (User Experience 3.2, Wireframes v3 section 8). The URL is
 * the state, so a pasted link reproduces the list. The strip, the filter
 * band and the table each live in their own component so this function
 * stays the place that loads the list and writes the URL.
 */
function CasesScreen() {
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
  // One case read beside the list, so a reader keeps their place, their
  // filters and their scroll while they look at it.
  const [preview, setPreview] = useState<{ key: string; anchor: PreviewAnchor } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState(parsed.q);
  // The filter builder's conditions, carried in the URL as readable JSON and
  // sent to the list route as the base64url set it decodes.
  const conditions = useMemo(
    () => parseConditions(new URLSearchParams(searchString).get(CONDITIONS_PARAM)),
    [searchString],
  );
  const conditionsSent = useMemo(() => conditionsParam(conditions), [conditions]);
  const params = useMemo(
    () =>
      viewToParams(view, parsed.chips, {
        q: parsed.q || undefined,
        limit: parsed.limit,
        cursor,
        conditions: conditionsSent,
      }),
    [view, parsed, cursor, conditionsSent],
  );
  const { data, isLoading, isError, refetch } = useListTicketsQuery(params, { pollingInterval: LIVE_REFRESH_MS });
  // The export carries the view, the chips and the conditions, never the page
  // cursor or size.
  const exportParams = useMemo(
    () => viewToParams(view, parsed.chips, { q: parsed.q || undefined, conditions: conditionsSent }),
    [view, parsed, conditionsSent],
  );
  const { data: accounts } = useListGrantedAccountsQuery();
  // The assignment groups the group chip names (TM-08); `/v1/groups` stands
  // on tickets:view, the Cases list's own gate.
  const { data: groups } = useListDirectoryGroupsQuery();
  // `/v1/views` stands on tickets:view too, so the only reason it is
  // unavailable is an API that does not serve it yet.
  const { views: savedViews, available: savedAvailable } = useSavedViews();
  const currentSaved = savedViews.find((entry) => entry.id === parsed.saved) ?? null;
  const accountsById = useMemo(() => new Map((accounts ?? []).map((account) => [account.id, account])), [accounts]);
  const authored = useMemo(() => ticketColumns({ accounts: accountsById }), [accountsById]);
  const arrangement = useListArrangement("cases", authored);
  const rows = useMemo(() => data?.items ?? [], [data]);
  const bulk = useQueueBulk(rows, selected, setSelected);
  const conditionFields = useMemo(
    () => queueConditionFields({ accounts: accounts ?? [], groups: groups ?? [] }),
    [accounts, groups],
  );
  const [, toggleStar, hasStar] = useToggleInList(STARS_KEY);
  const [seenSearch, setSeenSearch] = useState(searchString);
  // A new URL (view, chips, search, page size) restarts paging and selection
  // during render, so it is not an effect.
  if (seenSearch !== searchString) {
    setSeenSearch(searchString);
    setCursor(undefined);
    setPrevious([]);
    setSelected(new Set());
  }

  const go = (target: URLSearchParams) => router.push(target.size > 0 ? `${pathname}?${target.toString()}` : pathname);
  const navigate = (next: QueueNavigate) => go(queueSearchTarget(parsed, conditions, next));
  const applySaved = (saved: SavedView) => {
    const applied = applyDefinition(saved.definition);
    if (applied.notes.length > 0) {
      push({ title: `${saved.name} applied`, detail: applied.notes.join(" "), tone: "info" });
    }
    go(savedViewSearch(saved.id, saved.definition, parsed.limit));
  };
  const currentHref = searchString ? `${pathname}?${searchString}` : pathname;
  const filtered = parsed.chips.length > 0 || parsed.q !== "" || conditions.length > 0;
  const location = parsed;

  return (
    <div className="flex h-full min-h-0 flex-col gap-5">
      <QueueShow
        viewKey={parsed.view}
        viewLabel={view.label}
        openCount={data?.stats?.open}
        savedViews={savedViews}
        currentSaved={currentSaved}
        sort={parsed.sort}
        canCreate={me.hasPermission("tickets:create")}
        conditionFields={conditionFields}
        conditions={conditions}
        onNavigate={navigate}
        onApplySaved={applySaved}
      />
      <QueueFilters
        location={location}
        viewLabel={view.label}
        conditions={conditions}
        conditionFields={conditionFields}
        accounts={accounts ?? []}
        groups={groups}
        accountsById={accountsById}
        exportParams={exportParams}
        currentSaved={currentSaved}
        savedAvailable={savedAvailable}
        starred={hasStar(currentHref)}
        onToggleStar={() => toggleStar(currentHref)}
        onNavigate={navigate}
        onApplySaved={applySaved}
        onClearQuery={() => setQuery("")}
      />
      <QueueTable
        isError={isError}
        isLoading={isLoading}
        hasData={data !== undefined}
        refetch={() => void refetch()}
        columns={arrangement.columns}
        display={arrangement.display}
        rows={rows}
        selected={selected}
        onSelectionChange={setSelected}
        onOpen={(key) => router.push(`/cases/${key}`)}
        onPreview={(key, anchor) => setPreview({ key, anchor })}
        query={query}
        onQueryChange={setQuery}
        onSearch={() => navigate({ q: query.trim() })}
        onAssign={() => void bulk.assignSelected()}
        onChangeState={(to) => void bulk.changeStateSelected(to)}
        onSetPriority={(priority) => void bulk.setPrioritySelected(priority)}
        onWatch={() => void bulk.watchSelected()}
        exportParams={exportParams}
        viewLabel={view.label}
        filtered={filtered}
        onClearFilters={() => navigate({ chips: [], q: "" })}
        page={previous.length + 1}
        pageSize={parsed.limit}
        hasPrevious={previous.length > 0}
        hasNext={Boolean(data?.next_cursor)}
        onFirst={() => {
          setPrevious([]);
          setCursor(undefined);
        }}
        onPrevious={() => {
          const stack = [...previous];
          const last = stack.pop();
          setPrevious(stack);
          setCursor(last === "" ? undefined : last);
        }}
        onNext={() => {
          if (!data?.next_cursor) return;
          setPrevious([...previous, cursor ?? ""]);
          setCursor(data.next_cursor);
        }}
        preview={preview}
        accounts={accountsById}
        onClosePreview={() => setPreview(null)}
      />
      {arrangement.dialogue}
    </div>
  );
}

export default function CasesPage() {
  return (
    <AdminGate permission="tickets:view">
      <Suspense fallback={<Skeleton lines={8} />}>
        <CasesScreen />
      </Suspense>
    </AdminGate>
  );
}
