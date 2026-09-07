import { AddFilterButton } from "@/components/xms/add-filter-button";
import { ClearAllLink } from "@/components/xms/clear-all-link";
import { FilterChip } from "@/components/xms/filter-chip";
import { FilterPill } from "@/components/xms/filter-pill";
import { cn } from "@/lib/utils";

export interface FilterCriterion {
  key: string;
  label: string;
  value: string;
}

export interface FilterBarProps {
  /** The primary "Show:" dimension; not removable. */
  primary?: { label: string; value: string; onClick?: () => void };
  criteria: FilterCriterion[];
  onRemove: (key: string) => void;
  onAdd: () => void;
  onClearAll: () => void;
  className?: string;
}

/** Composes the primary pill, removable chips, Add filter and Clear all (Wireframes section 8.4). */
export function FilterBar({ primary, criteria, onRemove, onAdd, onClearAll, className }: FilterBarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)} role="group" aria-label="Filters">
      {primary ? <FilterPill primary label={primary.label} value={primary.value} onClick={primary.onClick} /> : null}
      {criteria.map((criterion) => (
        <FilterChip
          key={criterion.key}
          label={criterion.label}
          value={criterion.value}
          onRemove={() => onRemove(criterion.key)}
        />
      ))}
      <AddFilterButton onClick={onAdd} />
      {criteria.length > 0 ? <ClearAllLink onClick={onClearAll} /> : null}
    </div>
  );
}
