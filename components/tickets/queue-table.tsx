"use client";

import { CasePreview, type PreviewAnchor } from "@/components/cases/case-preview";
import { ExportMenu } from "@/components/tickets/export-menu";
import { QUEUE_STATE_OPTIONS } from "@/components/tickets/queue-navigation";
import { QUEUE_DEFAULT_SORT } from "@/components/tickets/ticket-columns";
import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { ICON, SearchIcon, SwitchIcon, TagIcon } from "@/components/xms/icons";
import { BulkAction, SelectionBar } from "@/components/xms/selection-bar";
import { Skeleton } from "@/components/xms/skeleton";
import { TablePager } from "@/components/xms/table-pager";
import type { DisplayOptions } from "@/lib/tables/arrangement";
import type { TicketListParams } from "@/lib/tickets/queue-views";
import type { GrantedAccount, TicketView } from "@/redux/ticketsApi";

export interface QueueTableProps {
  isError: boolean;
  isLoading: boolean;
  hasData: boolean;
  refetch: () => void;
  columns: DenseColumn<TicketView>[];
  display: DisplayOptions;
  rows: TicketView[];
  selected: Set<string>;
  onSelectionChange: (next: Set<string>) => void;
  onOpen: (key: string) => void;
  onPreview: (key: string, anchor: PreviewAnchor) => void;
  query: string;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onAssign: () => void;
  onChangeState: (to: string) => void;
  onSetPriority: (priority: string) => void;
  onWatch: () => void;
  exportParams: TicketListParams;
  viewLabel: string;
  filtered: boolean;
  onClearFilters: () => void;
  page: number;
  pageSize: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onFirst: () => void;
  onPrevious: () => void;
  onNext: () => void;
  preview: { key: string; anchor: PreviewAnchor } | null;
  accounts: Map<string, GrantedAccount>;
  onClosePreview: () => void;
}

/** The count card: search, the selection bar, the rows, and the pager. */
export function QueueTable({
  isError,
  isLoading,
  hasData,
  refetch,
  columns,
  display,
  rows,
  selected,
  onSelectionChange,
  onOpen,
  onPreview,
  query,
  onQueryChange,
  onSearch,
  onAssign,
  onChangeState,
  onSetPriority,
  onWatch,
  exportParams,
  viewLabel,
  filtered,
  onClearFilters,
  page,
  pageSize,
  hasPrevious,
  hasNext,
  onFirst,
  onPrevious,
  onNext,
  preview,
  accounts,
  onClosePreview,
}: QueueTableProps) {
  return (
    <>
      {isError ? (
        <div className="border-xms-line bg-xms-card flex items-center gap-3 rounded-card border px-4 py-2 text-body">
          <span className="text-xms-ink">The list could not be refreshed. The last data stays visible.</span>
          <button type="button" onClick={() => refetch()} className="text-xms-accent ml-auto hover:underline">
            Retry
          </button>
        </div>
      ) : null}

      {isLoading && !hasData ? (
        <Skeleton lines={8} />
      ) : (
        <DenseTable<TicketView>
          title="Cases"
          titleHidden
          bleed
          // The bands run to every edge of the work area, so the list pulls
          // itself back out of the page's own gutter: 20px at the sides and
          // the 40px under it, which a list filling the height does not want
          // sitting empty below its footer.
          className="-mx-5 -mb-10"
          columns={columns}
          display={display}
          rows={rows}
          rowKey={(row) => row.key}
          defaultSort={QUEUE_DEFAULT_SORT}
          selectable
          selected={selected}
          onSelectionChange={onSelectionChange}
          onRowClick={(row) => onOpen(row.key)}
          onRowPreview={(row, anchor) => onPreview(row.key, anchor)}
          search={
            <form
              className="xms-field xms-field-typed border-xms-line-strong bg-xms-card mx-auto flex h-[38px] w-full max-w-[400px] items-center gap-2 rounded-control border px-[14px]"
              onSubmit={(event) => {
                event.preventDefault();
                onSearch();
              }}
            >
              <input
                type="search"
                aria-label="Search by key, description or requester"
                placeholder="Search by key, description or requester"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                className="text-xms-ink min-w-0 flex-1 bg-transparent text-body outline-none"
              />
              <button type="submit" aria-label="Run the search" className="text-xms-muted hover:text-xms-ink shrink-0">
                <SearchIcon size={ICON.action} />
              </button>
            </form>
          }
          banner={
            // The bar's actions (section 8.4), each one call to
            // POST /v1/tickets/bulk. A batch is not a transaction: the toast
            // says how many moved and names what stopped the rest. Add tag is
            // the one action with no route behind it and says so rather than
            // pretending to be live.
            <SelectionBar count={selected.size} onDismiss={() => onSelectionChange(new Set())}>
              <BulkAction icon={<SwitchIcon size={ICON.control} />} label="Assign" onClick={() => void onAssign()} />
              <span className="relative inline-flex items-center">
                <select
                  aria-label="Change state"
                  value=""
                  onChange={(event) => {
                    if (event.target.value) void onChangeState(event.target.value);
                  }}
                  className="border-xms-accent-border bg-xms-card text-xms-accent h-[28px] cursor-pointer appearance-none rounded-control border pr-6 pl-[10px] text-body font-medium"
                >
                  <option value="">Change state</option>
                  {QUEUE_STATE_OPTIONS.map((state) => (
                    <option key={state} value={state}>
                      {state.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </span>
              <span className="relative inline-flex items-center">
                <select
                  aria-label="Set priority"
                  value=""
                  onChange={(event) => {
                    const priority = event.target.value;
                    event.currentTarget.value = "";
                    if (priority) void onSetPriority(priority);
                  }}
                  className="border-xms-accent-border bg-xms-card text-xms-accent h-[28px] cursor-pointer appearance-none rounded-control border pr-6 pl-[10px] text-body font-medium"
                >
                  <option value="">Priority</option>
                  <option value="p1">1 - Critical</option>
                  <option value="p2">2 - High</option>
                  <option value="p3">3 - Moderate</option>
                  <option value="p4">4 - Low</option>
                </select>
              </span>
              <BulkAction
                icon={<TagIcon size={ICON.control} />}
                label="Add tag"
                disabled
                title="Tags land with the bulk route; nothing on the API takes one yet."
                onClick={() => undefined}
              />
              <ExportMenu params={exportParams} label="Export" />
              <BulkAction label="Watch" onClick={() => void onWatch()} />
            </SelectionBar>
          }
          emptyState={
            <EmptyBanner
              title={`Nothing in ${viewLabel}`}
              detail={filtered ? "Clear the filters to widen the list." : undefined}
              action={filtered ? { label: "Clear all", onClick: onClearFilters } : undefined}
            />
          }
          footer={
            <TablePager
              page={page}
              pageSize={pageSize}
              rows={rows.length}
              hasPrevious={hasPrevious}
              hasNext={hasNext}
              onFirst={onFirst}
              onPrevious={onPrevious}
              onNext={onNext}
            />
          }
        />
      )}
      {preview ? (
        <CasePreview ticketKey={preview.key} anchor={preview.anchor} accounts={accounts} onClose={onClosePreview} />
      ) : null}
    </>
  );
}
