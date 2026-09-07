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
        "border-xms-line bg-xms-card text-xms-body inline-flex h-[28px] items-center gap-1 rounded-[999px] border pr-1 pl-[10px] text-[12px] whitespace-nowrap",
        className,
      )}
    >
      <span className="text-xms-label">{label}:</span>
      <span className="font-medium">{value}</span>
      <button
        type="button"
        aria-label={`Remove ${label} filter`}
        onClick={onRemove}
        className="text-xms-muted hover:text-xms-ink hover:bg-xms-tint ml-1 flex h-5 w-5 items-center justify-center rounded-[999px] text-[14px] leading-none"
      >
        ×
      </button>
    </span>
  );
}
