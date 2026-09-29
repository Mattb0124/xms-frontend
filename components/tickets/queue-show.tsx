"use client";

import Link from "next/link";
import { PRIMARY_BUTTON } from "@/components/admin/primitives";
import { HeaderAction, HeaderFilterPanel, HeaderFilters } from "@/components/shell/content-header-bar";
import { savedViewLabel } from "@/components/tickets/saved-views";
import type { QueueNavigate } from "@/components/tickets/queue-navigation";
import { ConditionBuilder } from "@/components/xms/condition-builder";
import { FilterSelect, StripSelect } from "@/components/xms/filter-select";
import { ICON, PlusIcon } from "@/components/xms/icons";
import type { Condition, ConditionField } from "@/lib/conditions";
import { QUEUE_VIEWS, type TicketListParams } from "@/lib/tickets/queue-views";

const SORTS = ["updated_desc", "created_desc", "priority"] as const;

function sortOf(value: string): TicketListParams["sort"] {
  return SORTS.find((sort) => sort === value);
}
import { cn } from "@/lib/utils";
import type { SavedView } from "@/redux/ticketsApi";

export interface QueueShowProps {
  viewKey: string;
  viewLabel: string;
  openCount: number | undefined;
  savedViews: SavedView[];
  currentSaved: SavedView | null;
  sort: TicketListParams["sort"];
  canCreate: boolean;
  conditionFields: ConditionField[];
  conditions: Condition[];
  onNavigate: (next: QueueNavigate) => void;
  onApplySaved: (view: SavedView) => void;
}

/** The strip: which list is showing, how it is ordered, the builder, and New. */
export function QueueShow({
  viewKey,
  viewLabel,
  openCount,
  savedViews,
  currentSaved,
  sort,
  canCreate,
  conditionFields,
  conditions,
  onNavigate,
  onApplySaved,
}: QueueShowProps) {
  const showing = currentSaved ? savedViewLabel(currentSaved) : viewLabel;
  return (
    <>
      <HeaderFilters>
        <div className="flex items-center gap-2">
          {/* "Show: All open (26)": the primary dimension, in the link colour,
              carrying the number the list is showing under it. The saved views
              sit in the same control under their own group, so switching to
              one is the same gesture as switching to a system view. */}
          <StripSelect
            primary
            label="Show"
            value={currentSaved ? `saved:${currentSaved.id}` : viewKey}
            // The count is the server's own `stats.open`, which is the figure
            // the sidebar badge reads from the same response: one number, in
            // two places, never counted twice.
            display={`${showing}${openCount === undefined ? "" : ` (${openCount})`}`}
            onChange={(value) => {
              const saved = savedViews.find((entry) => `saved:${entry.id}` === value);
              if (saved) {
                onApplySaved(saved);
                return;
              }
              onNavigate({ view: value });
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
            value={sort ?? "updated_desc"}
            options={[
              { value: "updated_desc", label: "Last updated" },
              { value: "created_desc", label: "Newest" },
              { value: "priority", label: "Priority" },
            ]}
            onChange={(value) => onNavigate({ sort: sortOf(value) })}
          />
        </div>
      </HeaderFilters>
      {/* Everything the grammar can say that the standing dimensions cannot:
          the builder the funnel opens, on the grey under the strip. */}
      <HeaderFilterPanel count={conditions.length}>
        <ConditionBuilder
          fields={conditionFields}
          value={conditions}
          onChange={(next) => onNavigate({ conditions: next })}
        />
      </HeaderFilterPanel>
      <HeaderAction>
        {/* The primary action alone. Every action on the selection already
            lives in the bar that appears over the rows once something is. */}
        {canCreate ? (
          <Link href="/cases/new" className={cn(PRIMARY_BUTTON, "inline-flex items-center gap-1")}>
            <PlusIcon size={ICON.action} />
            New
          </Link>
        ) : null}
      </HeaderAction>
    </>
  );
}
