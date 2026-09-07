import { cn } from "@/lib/utils";

export interface DisciplineItem {
  key: "time" | "resolution_code" | "solution" | "notes" | string;
  label: string;
  done: boolean;
  detail?: string;
}

export interface CloseDisciplineChecklistProps {
  items: DisciplineItem[];
  className?: string;
}

/** The Resolve dialog checklist: what is still missing before Resolved (Domain invariant 6). */
export function CloseDisciplineChecklist({ items, className }: CloseDisciplineChecklistProps) {
  const missing = items.filter((item) => !item.done).length;
  return (
    <div className={cn("flex flex-col gap-2", className)} data-missing={missing}>
      <p className="xms-caption">Close discipline</p>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-2 text-[13px]" data-done={item.done ? "true" : "false"}>
            <span
              aria-hidden
              className={cn(
                "xms-mono flex h-4 w-4 items-center justify-center rounded-[999px] border text-[10px]",
                item.done
                  ? "border-[color:var(--state-complete-border)] bg-[color:var(--state-complete-bg)] text-[color:var(--state-complete-text)]"
                  : "border-[color:var(--state-overdue-border)] bg-[color:var(--state-overdue-bg)] text-[color:var(--state-overdue-text)]",
              )}
            >
              {item.done ? "✓" : "!"}
            </span>
            <span className={item.done ? "text-xms-body" : "text-xms-ink font-medium"}>{item.label}</span>
            {item.detail ? <span className="text-xms-label text-[12px]">{item.detail}</span> : null}
          </li>
        ))}
      </ul>
      <p className="text-xms-label text-[12px]">
        {missing === 0 ? "Ready to resolve." : `${missing} item${missing === 1 ? "" : "s"} missing before Resolved.`}
      </p>
    </div>
  );
}
