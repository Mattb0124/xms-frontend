"use client";

import { SavedViewsBar } from "@/components/tickets/saved-views";
import {
  chipOptions,
  queueRemoval,
  queueTrail,
  STANDING_CHIPS,
  withoutChip,
  type QueueLocation,
  type QueueNavigate,
} from "@/components/tickets/queue-navigation";
import { BreadcrumbTrail } from "@/components/xms/breadcrumb-trail";
import { FilterSelect } from "@/components/xms/filter-select";
import type { Condition, ConditionField } from "@/lib/conditions";
import { builtConditions } from "@/lib/tickets/queue-conditions";
import { addChip, CHIP_LABEL, type TicketListParams } from "@/lib/tickets/queue-views";
import type { DirectoryGroup, GrantedAccount, SavedView } from "@/redux/ticketsApi";

export interface QueueFiltersProps {
  location: QueueLocation;
  viewLabel: string;
  conditions: Condition[];
  conditionFields: ConditionField[];
  accounts: GrantedAccount[];
  groups: DirectoryGroup[] | undefined;
  accountsById: Map<string, GrantedAccount>;
  exportParams: TicketListParams;
  currentSaved: SavedView | null;
  savedAvailable: boolean;
  starred: boolean;
  onToggleStar: () => void;
  onNavigate: (next: QueueNavigate) => void;
  onApplySaved: (view: SavedView) => void;
  onClearQuery: () => void;
}

/**
 * The band under the strip: the standing dimensions, the trail that restates
 * them in words, and Save as view. It wraps to a second line rather than
 * pushing the strip into a scrollbar.
 */
export function QueueFilters({
  location,
  viewLabel,
  conditions,
  conditionFields,
  accounts,
  groups,
  accountsById,
  exportParams,
  currentSaved,
  savedAvailable,
  starred,
  onToggleStar,
  onNavigate,
  onApplySaved,
  onClearQuery,
}: QueueFiltersProps) {
  const trail = queueTrail(location, viewLabel, conditions, conditionFields, accountsById, groups);
  const removeSegment = (key: string) => {
    const removal = queueRemoval(key, location, conditions);
    if (removal.clearQuery) onClearQuery();
    onNavigate(removal.next);
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* The standing dimensions, drawn whether or not they filter:
            "Account: all" until a value is chosen. Setting one back to all
            is what removes it, so there is no cross to hunt for. */}
        {STANDING_CHIPS.map((key) => (
          <FilterSelect
            key={key}
            label={CHIP_LABEL[key]}
            value={location.chips.find((chip) => chip.key === key)?.value ?? ""}
            options={chipOptions(key, accounts, groups)}
            onChange={(value) =>
              onNavigate({
                chips:
                  value === ""
                    ? withoutChip(location.chips, key)
                    : addChip(withoutChip(location.chips, key), { key, value }),
              })
            }
          />
        ))}
      </div>
      <BreadcrumbTrail segments={trail} onRemove={removeSegment} className="min-w-0 flex-1" />
      <SavedViewsBar
        params={exportParams}
        built={builtConditions(conditions)}
        accounts={accounts}
        current={currentSaved}
        available={savedAvailable}
        starred={starred}
        onToggleStar={onToggleStar}
        onSaved={onApplySaved}
        onDeleted={() => onNavigate({ view: location.view })}
      />
    </div>
  );
}
