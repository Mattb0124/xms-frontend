import { cn } from "@/lib/utils";

export interface FilterChipProps {
  label: string;
  value: string;
  onRemove: () => void;
  className?: string;
}

/** Removable filter chip (v3): the cross removes the criterion and rewrites the URL. */
export function FilterChip({ label, value, onRemove, className }: FilterChipProps) {
  return (
    <span
      className={cn(
        "border-xms-control-line bg-xms-card text-xms-body inline-flex h-[var(--xms-header-pill-h)] shrink-0 items-center gap-1 rounded-[var(--xms-radius-control)] border pr-1 pl-[11px] text-[14px] whitespace-nowrap",
        className,
      )}
    >
      <span className="text-xms-label">{label}:</span>
      <span className="font-medium">{value}</span>
      <button
        type="button"
        aria-label={`Remove ${label} filter`}
        onClick={onRemove}
        className="text-xms-muted hover:text-xms-ink hover:bg-xms-control-hover ml-1 flex h-[22px] w-[22px] items-center justify-center rounded-[var(--xms-radius-control)] text-[14px] leading-none"
      >
        ×
      </button>
    </span>
  );
}
