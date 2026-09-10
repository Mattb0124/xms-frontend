import { cn } from "@/lib/utils";

export interface FilterPillProps {
  label: string;
  value: string;
  /** The primary "Show:" dimension renders in blue outline and is never removable. */
  primary?: boolean;
  onClick?: () => void;
  className?: string;
}

/** Content header bar pill: the saved-view state made visible (Wireframes v2 section 2). */
export function FilterPill({ label, value, primary, onClick, className }: FilterPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-primary={primary ? "true" : undefined}
      className={cn(
        // The toolbar dimensions are 4px controls in every v3 render; 999px is
        // reserved for the state, priority and count pills inside the list.
        "inline-flex h-[var(--xms-header-pill-h)] shrink-0 items-center gap-1 rounded-[var(--xms-radius-control)] border px-[11px] text-[14px] whitespace-nowrap",
        primary ? "border-xms-accent text-xms-accent bg-xms-card" : "border-xms-control-line bg-xms-card text-xms-body",
        className,
      )}
    >
      <span className="text-xms-label">{label}:</span>
      <span className="font-medium">{value}</span>
    </button>
  );
}
