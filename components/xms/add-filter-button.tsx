import { ICON, PlusIcon } from "@/components/xms/icons";
import { cn } from "@/lib/utils";

export interface AddFilterButtonProps {
  onClick: () => void;
  className?: string;
}

/**
 * Dashed "Add filter" (v3 renders 01 and 08): opens the condition builder for
 * one new criterion. The plus is a drawn glyph beside the words, on the same
 * 4px control radius as the dimension pills it follows, so the toolbar reads
 * as one row of controls rather than a row of lozenges and a text button.
 */
export function AddFilterButton({ onClick, className }: AddFilterButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "border-xms-quiet-line bg-xms-card text-xms-body hover:border-xms-accent hover:text-xms-accent inline-flex h-[var(--xms-header-pill-h)] shrink-0 items-center gap-[6px] rounded-[var(--xms-radius-control)] border border-dashed px-[11px] text-[13px] font-medium whitespace-nowrap",
        className,
      )}
    >
      <PlusIcon size={ICON.control} />
      Add filter
    </button>
  );
}
