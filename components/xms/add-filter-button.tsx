import { cn } from "@/lib/utils";

export interface AddFilterButtonProps {
  onClick: () => void;
  className?: string;
}

/** Dashed "+ Add filter" (v3): opens the condition builder for one new criterion. */
export function AddFilterButton({ onClick, className }: AddFilterButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "border-xms-line-strong text-xms-label hover:border-xms-accent hover:text-xms-accent inline-flex h-[var(--xms-header-pill-h)] items-center gap-1 rounded-[999px] border border-dashed px-3 text-[13px] whitespace-nowrap",
        className,
      )}
    >
      + Add filter
    </button>
  );
}
