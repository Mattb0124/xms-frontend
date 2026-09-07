import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface BulkActionProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function BulkAction({ label, onClick, disabled }: BulkActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="border-xms-accent-border bg-xms-card text-xms-accent hover:bg-xms-accent-tint h-[28px] rounded-[4px] border px-[10px] text-[12px] font-medium disabled:opacity-50"
    >
      {label}
    </button>
  );
}

export interface SelectionBarProps {
  count: number;
  onDismiss: () => void;
  children?: ReactNode;
  /** Right-aligned note; defaults to the audit rule (TM-16). */
  note?: string;
  className?: string;
}

/** Blue-tinted selection bar under the card header (Wireframes section 8.4). */
export function SelectionBar({
  count,
  onDismiss,
  children,
  note = "one audit event written per record",
  className,
}: SelectionBarProps) {
  if (count === 0) return null;
  return (
    <div
      role="region"
      aria-label="Selection"
      className={cn(
        "bg-xms-accent-tint border-xms-accent-border flex items-center gap-2 border-b px-4 py-2 text-[12px]",
        className,
      )}
    >
      <span className="text-xms-ink font-semibold">{count} selected</span>
      <div className="flex items-center gap-2">{children}</div>
      <span className="text-xms-label ml-auto">{note}</span>
      <button
        type="button"
        aria-label="Clear selection"
        onClick={onDismiss}
        className="text-xms-muted hover:text-xms-ink ml-2 text-[14px] leading-none"
      >
        ×
      </button>
    </div>
  );
}
