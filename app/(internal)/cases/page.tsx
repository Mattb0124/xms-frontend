"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AdminGate, PRIMARY_BUTTON } from "@/components/admin/primitives";
import { CasePreview, type PreviewAnchor } from "@/components/cases/case-preview";
import {
  HeaderAction,
  HeaderFilterPanel,
  HeaderFilters,
  HeaderSearch,
  HeaderSearchField,
  useHeaderFilterPanel,
} from "@/components/shell/content-header-bar";
import { ExportMenu } from "@/components/tickets/export-menu";
import { savedViewLabel, SavedViewsBar, useSavedViews } from "@/components/tickets/saved-views";
import { QUEUE_DEFAULT_SORT, ticketColumns } from "@/components/tickets/ticket-columns";
import { DenseTable } from "@/components/xms/dense-table";
import { useListArrangement } from "@/components/xms/use-list-arrangement";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { BreadcrumbTrail } from "@/components/xms/breadcrumb-trail";
import { ConditionBuilder } from "@/components/xms/condition-builder";
import { FilterSelect, StripSelect } from "@/components/xms/filter-select";
import {
  ICON,
  ChevronDownIcon,
  ColumnsIcon,
  FunnelIcon,
  PlusIcon,
  SearchIcon,
  SwitchIcon,
  TagIcon,
} from "@/components/xms/icons";
import { BulkAction, SelectionBar } from "@/components/xms/selection-bar";
import { Skeleton } from "@/components/xms/skeleton";
import { RowsPerPage, type RowsPerPageOption } from "@/components/xms/table-footer";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import { describeCondition, parseConditions, serializeConditions, type Condition } from "@/lib/conditions";
import { STARS_KEY, useToggleInList } from "@/lib/persisted-set";
import { useTrack } from "@/lib/telemetry/provider";
import {
  builtConditions,
  conditionsParam,
  CONDITIONS_PARAM,
  queueConditionFields,
} from "@/lib/tickets/queue-conditions";
import {
  addChip,
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
  type TicketListParams,
} from "@/lib/tickets/queue-views";
import { applyDefinition, savedViewSearch } from "@/lib/tickets/saved-views";
import { PRIORITIES, TICKET_TYPES } from "@/lib/tickets/vocab";
import { cn } from "@/lib/utils";
import { outcomeLine, useApplyBulkMutation, type BulkBody } from "@/redux/bulkApi";
import { useMe } from "@/redux/me";
import {
  useListDirectoryGroupsQuery,
  useListGrantedAccountsQuery,
  useListTicketsQuery,
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

/**
 * The dimensions the tool strip always draws, whether or not they carry a
 * criterion. Everything else the grammar can say is a condition in the
 * builder the funnel opens, which is where the reviewer's own reference puts
 * it: the strip carries the two or three dimensions a consultant switches
 * between all day, and the builder carries the rest.
 */
const STANDING: ChipKey[] = ["account_id", "state", "priority", "type"];

/** The chips with one dimension taken out, so a pill replaces rather than stacks. */
function withoutChip(chips: Chip[], key: ChipKey): Chip[] {
  return chips.filter((chip) => chip.key !== key);
}

const CARD_ICON_BUTTON =
  "border-xms-line bg-xms-card text-xms-label hover:text-xms-ink hover:border-xms-line-strong flex h-[34px] w-[38px] shrink-0 items-center justify-center rounded-[6px] border";

/**
 * The Cases list (User Experience 3.2, Wireframes v3 section 8): a system view
 * switcher, removable chips, the Count card with the dense table, the
 * stats strip, a selection bar, rows per page and cursor paging. The URL
 * is the state, so a pasted link reproduces the list.
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
  // The v3 render (01) ends the table at Assignee. SLA and Updated stay one
  // click away on the card header column control rather than being deleted.
  const filterPanel = useHeaderFilterPanel();

  // The filter builder's conditions, carried in the URL as readable JSON and
  // sent to the list route as the base64url set it decodes, so a pasted link
  // reproduces the list conditions and all.
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
  const { data, isLoading, isError, refetch } = useListTicketsQuery(params, { pollingInterval: 60_000 });
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
  // The server's saved views beside the system ones (Ticket Management
  // technical 2.5). `/v1/views` stands on tickets:view, the Cases list's own gate,
  // so the only reason it is unavailable is an API that does not serve it
  // yet, and the per-browser star stays the fallback for exactly that.
  const { views: savedViews, available: savedAvailable } = useSavedViews();
  const currentSaved = savedViews.find((entry) => entry.id === parsed.saved) ?? null;
  const [applyBulk] = useApplyBulkMutation();
  const [watch] = useWatchTicketMutation();
  const trackAssign = useTrack("dispatch.assign");

  const accountsById = useMemo(() => new Map((accounts ?? []).map((account) => [account.id, account])), [accounts]);
  const authored = useMemo(() => ticketColumns({ accounts: accountsById }), [accountsById]);
  // The reader's own arrangement of this list, and the gear that opens it.
  const arrangement = useListArrangement("cases", authored);
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
  const navigate = (next: {
    view?: string;
    chips?: Chip[];
    q?: string;
    limit?: number;
    conditions?: Condition[];
    sort?: TicketListParams["sort"];
  }) => {
    const target = chipsToSearch(
      next.view ?? parsed.view,
      next.chips ?? parsed.chips,
      next.q ?? parsed.q,
      next.limit ?? parsed.limit,
      next.sort ?? parsed.sort,
    );
    const nextConditions = next.conditions ?? conditions;
    if (nextConditions.length > 0) target.set(CONDITIONS_PARAM, serializeConditions(nextConditions));
    const criteriaKept =
      next.view === undefined && next.chips === undefined && next.q === undefined && next.conditions === undefined;
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

  /**
   * One call for the whole selection (TM-16). Each case carries the version
   * the reader read, and each comes back with its own outcome: a batch is not
   * a transaction, so the bar says how many moved and names what stopped the
   * rest, in the words of the refusal.
   */
  const runBulk = async (body: BulkBody, verb: string) => {
    const targets = rows.filter((row) => selected.has(row.key));
    if (targets.length === 0) return;
    try {
      const result = await applyBulk({
        ...body,
        tickets: targets.map((row) => ({ key: row.key, version: row.version })),
      }).unwrap();
      const refused = result.results.filter((outcome) => outcome.outcome !== "ok");
      push({
        title: `${result.succeeded} ${verb}`,
        detail:
          refused.length > 0
            ? refused
                .slice(0, 3)
                .map((outcome) => `${outcome.key}: ${outcomeLine(outcome)}`)
                .join("; ") + (refused.length > 3 ? `, and ${refused.length - 3} more` : "")
            : undefined,
        tone: refused.length > 0 ? "info" : "success",
      });
      setSelected(new Set());
    } catch (error) {
      push({ title: "Nothing was changed", detail: describeError(apiError(error)), tone: "error" });
    }
  };

  const assignSelected = async () => {
    const userId = me.principal?.userId;
    if (!userId) return;
    trackAssign({ count: selected.size, via: "bulk" });
    await runBulk({ action: "assign", assignee_id: userId, tickets: [] }, "assigned to you");
  };

  const changeStateSelected = async (to: string) =>
    runBulk({ action: "transition", to, tickets: [] }, `moved to ${to.replace(/_/g, " ")}`);

  const setPrioritySelected = async (priority: string) =>
    runBulk({ action: "set_priority", priority, tickets: [] }, `set to ${priority.toUpperCase()}`);

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
  const filtered = parsed.chips.length > 0 || parsed.q !== "" || conditions.length > 0;
  const conditionFields = useMemo(
    () => queueConditionFields({ accounts: accounts ?? [], groups: groups ?? [] }),
    [accounts, groups],
  );

  // The condition trail (Wireframes section 2): the active view, each standing
  // dimension and then each built condition in words, so the strip and the
  // builder are restated as one sentence. Clicking a segment removes that
  // criterion. Save as view sits under it, on the server's own views; the star
  // into the Favourites list the finder bar reads (frontend review finding 12)
  // is what the bar falls back to while `/v1/views` is not deployed.
  const [, toggleStar, hasStar] = useToggleInList(STARS_KEY);
  const currentHref = searchString ? `${pathname}?${searchString}` : pathname;
  const trail = [
    { key: "view", label: view.label },
    ...parsed.chips.map((chip) => ({ key: `${chip.key}:${chip.value}`, label: chipValueLabel(chip) })),
    ...conditions.map((condition, index) => ({
      key: `condition:${index}`,
      label: describeCondition(condition, conditionFields),
    })),
    ...(parsed.q ? [{ key: "q", label: `Search: ${parsed.q}` }] : []),
  ];
  const removeSegment = (key: string) => {
    if (key === "view") return navigate({ view: QUEUE_VIEWS[0].key });
    if (key === "q") {
      setQuery("");
      return navigate({ q: "" });
    }
    if (key.startsWith("condition:")) {
      const index = Number(key.slice("condition:".length));
      return navigate({ conditions: conditions.filter((_, i) => i !== index) });
    }
    navigate({ chips: parsed.chips.filter((chip) => `${chip.key}:${chip.value}` !== key) });
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-5">
      <HeaderFilters>
        <div className="flex items-center gap-2">
          {/* "Show: All open (26)": the primary dimension, in the link colour,
              carrying the number the list is showing under it. The saved views
              sit in the same control under their own group, so switching to
              one is the same gesture as switching to a system view. */}
          <StripSelect
            primary
            label="Show"
            value={currentSaved ? `saved:${currentSaved.id}` : parsed.view}
            // The count is the server's own `stats.open`, which is the figure
            // the sidebar badge reads from the same response: one number, in
            // two places, never counted twice.
            display={`${currentSaved ? savedViewLabel(currentSaved) : view.label}${stats === undefined ? "" : ` (${stats.open})`}`}
            onChange={(value) => {
              const saved = savedViews.find((entry) => `saved:${entry.id}` === value);
              if (saved) {
                applySaved(saved);
                return;
              }
              navigate({ view: value });
            }}
          >
            {QUEUE_VIEWS.map((entry) => (
              <option key={entry.key} value={entry.key}>
                {`Show: ${entry.label}`}
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
          </StripSelect>
          {/* What the list is ordered on, beside the dimension that says what
              it is showing. The direction stays on the column header, which
              is where a reader reverses it. */}
          <FilterSelect
            label="Sort"
            value={parsed.sort ?? "updated_desc"}
            options={[
              { value: "updated_desc", label: "Last updated" },
              { value: "created_desc", label: "Newest" },
              { value: "priority", label: "Priority" },
            ]}
            onChange={(value) => navigate({ sort: (value || undefined) as TicketListParams["sort"] })}
          />
        </div>
      </HeaderFilters>
      {/* Everything the grammar can say that the standing dimensions cannot:
          the builder the funnel opens, on the grey under the strip. */}
      <HeaderFilterPanel count={conditions.length}>
        <ConditionBuilder
          fields={conditionFields}
          value={conditions}
          onChange={(next) => navigate({ conditions: next })}
        />
      </HeaderFilterPanel>
      {/* The render's local search sits in the header bar beside the gear;
          the in-card field searches the same term, so both write it. */}
      <HeaderSearch>
        <HeaderSearchField
          value={query}
          onChange={setQuery}
          onSubmit={() => navigate({ q: query.trim() })}
          label="Search the queue"
        />
      </HeaderSearch>
      <HeaderAction>
        {/* "Actions on selected rows", beside the primary button. It is drawn
            disabled with nothing ticked rather than appearing and vanishing,
            so the row of controls never moves under the pointer. The same
            four actions stand in the selection bar over the rows. */}
        <span className="flex items-center gap-2">
          <select
            aria-label="Actions on selected rows"
            disabled={selected.size === 0}
            value=""
            onChange={(event) => {
              const action = event.target.value;
              event.currentTarget.value = "";
              if (action === "assign") void assignSelected();
              if (action === "watch") void watchSelected();
            }}
            className="border-xms-control-line bg-xms-card text-xms-body h-[var(--xms-header-pill-h)] rounded-[var(--xms-radius-control)] border px-[10px] text-[13px] disabled:opacity-50"
          >
            <option value="">{selected.size === 0 ? "Actions on selected rows" : `Actions on ${selected.size}`}</option>
            <option value="assign">Assign to me</option>
            <option value="watch">Watch</option>
          </select>
          {me.hasPermission("tickets:create") ? (
            <Link href="/cases/new" className={cn(PRIMARY_BUTTON, "inline-flex items-center gap-1")}>
              <PlusIcon size={ICON.action} />
              New
            </Link>
          ) : null}
        </span>
      </HeaderAction>

      {/* The condition trail and Save as view are one line. The open-ticket
          readout that stood between them is gone with the card's own count
          badge: the sidebar carries the number the queue is measured by, and
          repeating it twice more on the screen it names was noise. */}
      {/* The band under the strip carries the filter state: the standing
          dimensions, the trail that restates them in words, and Save as view.
          It wraps to a second line rather than pushing the strip into a
          scrollbar, which is what the design brief asks of both. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* The standing dimensions, drawn whether or not they filter:
            "Account: all" until a value is chosen. Setting one back to all
            is what removes it, so there is no cross to hunt for. */}
          {STANDING.map((key) => (
            <FilterSelect
              key={key}
              label={CHIP_LABEL[key]}
              value={parsed.chips.find((chip) => chip.key === key)?.value ?? ""}
              options={chipOptions(key)}
              onChange={(value) =>
                navigate({
                  chips:
                    value === ""
                      ? withoutChip(parsed.chips, key)
                      : addChip(withoutChip(parsed.chips, key), { key, value }),
                })
              }
            />
          ))}
        </div>
        <BreadcrumbTrail segments={trail} onRemove={removeSegment} className="min-w-0 flex-1" />
        <SavedViewsBar
          params={exportParams}
          built={builtConditions(conditions)}
          accounts={accounts ?? []}
          current={currentSaved}
          available={savedAvailable}
          starred={hasStar(currentHref)}
          onToggleStar={() => toggleStar(currentHref)}
          onSaved={applySaved}
          onDeleted={() => navigate({ view: parsed.view })}
        />
      </div>

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
          title="Cases"
          titleHidden
          bleed
          // The bands run to both edges of the work area, so the list pulls
          // itself back out of the page's own 20px gutter.
          className="-mx-5"
          columns={arrangement.columns}
          display={arrangement.display}
          rows={rows}
          rowKey={(row) => row.key}
          defaultSort={QUEUE_DEFAULT_SORT}
          selectable
          selected={selected}
          onSelectionChange={setSelected}
          onRowClick={(row) => router.push(`/cases/${row.key}`)}
          onRowPreview={(row, anchor) => setPreview({ key: row.key, anchor })}
          search={
            <form
              className="xms-field xms-field-typed border-xms-line bg-xms-card mx-auto flex h-[38px] w-full max-w-[400px] items-center gap-2 rounded-[4px] border px-[14px]"
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
                className="text-xms-ink min-w-0 flex-1 bg-transparent text-[13px] outline-none"
              />
              <button type="submit" aria-label="Run the search" className="text-xms-muted hover:text-xms-ink shrink-0">
                <SearchIcon size={ICON.action} />
              </button>
            </form>
          }
          actions={
            <>
              {/* The card's own funnel and the strip's are the same control:
                  both open the one builder, so the reader is never asked
                  which filter they meant. */}
              <button
                type="button"
                aria-label="Filter the list"
                aria-pressed={filterPanel.open}
                onClick={filterPanel.toggle}
                className={cn(CARD_ICON_BUTTON, filterPanel.open && "border-xms-accent text-xms-accent")}
              >
                <FunnelIcon size={ICON.field} />
              </button>
              {/* The card's columns mark and the strip's gear open the one
                  dialogue, the way the card's funnel and the strip's open the
                  one builder. */}
              <button
                type="button"
                aria-label="Personalize list columns"
                onClick={arrangement.open}
                className={CARD_ICON_BUTTON}
              >
                <ColumnsIcon size={ICON.field} />
              </button>
            </>
          }
          banner={
            // The bar's actions (section 8.4), each one call to
            // POST /v1/tickets/bulk. A batch is not a transaction: the toast
            // says how many moved and names what stopped the rest. Add tag is
            // the one action with no route behind it and says so rather than
            // pretending to be live.
            <SelectionBar count={selected.size} onDismiss={() => setSelected(new Set())}>
              <BulkAction
                icon={<SwitchIcon size={ICON.control} />}
                label="Assign"
                onClick={() => void assignSelected()}
              />
              <span className="relative inline-flex items-center">
                <select
                  aria-label="Change state"
                  value=""
                  onChange={(event) => {
                    if (event.target.value) void changeStateSelected(event.target.value);
                  }}
                  className="border-xms-accent-border bg-xms-card text-xms-accent h-[28px] cursor-pointer appearance-none rounded-[4px] border pr-6 pl-[10px] text-[12px] font-medium"
                >
                  <option value="">Change state</option>
                  {STATE_OPTIONS.map((state) => (
                    <option key={state} value={state}>
                      {state.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon
                  size={ICON.glyph}
                  className="text-xms-accent pointer-events-none absolute right-[7px]"
                />
              </span>
              <span className="relative inline-flex items-center">
                <select
                  aria-label="Set priority"
                  value=""
                  onChange={(event) => {
                    const priority = event.target.value;
                    event.currentTarget.value = "";
                    if (priority) void setPrioritySelected(priority);
                  }}
                  className="border-xms-line-strong bg-xms-card text-xms-body h-[30px] appearance-none rounded-[4px] border pr-[22px] pl-[10px] text-[13px]"
                >
                  <option value="">Priority</option>
                  <option value="p1">1 - Critical</option>
                  <option value="p2">2 - High</option>
                  <option value="p3">3 - Moderate</option>
                  <option value="p4">4 - Low</option>
                </select>
                <ChevronDownIcon
                  size={ICON.glyph}
                  className="text-xms-accent pointer-events-none absolute right-[7px]"
                />
              </span>
              <BulkAction
                icon={<TagIcon size={ICON.control} />}
                label="Add tag"
                disabled
                title="Tags land with the bulk route; nothing on the API takes one yet."
                onClick={() => undefined}
              />
              <ExportMenu params={exportParams} label="Export" />
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
      {preview ? (
        <CasePreview
          ticketKey={preview.key}
          anchor={preview.anchor}
          accounts={accountsById}
          onClose={() => setPreview(null)}
        />
      ) : null}
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
