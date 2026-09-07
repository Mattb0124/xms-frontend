import { cn } from "@/lib/utils";

export interface TabItem {
  key: string;
  label: string;
  count?: number;
}

export interface TabBarProps {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}

/** Record tab bar: ink labels, a 2px accent underline on the active tab, mono counts. */
export function TabBar({ tabs, active, onChange, className }: TabBarProps) {
  return (
    <div role="tablist" className={cn("border-xms-line flex items-end gap-1 border-b", className)}>
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <button
            key={tab.key}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => onChange(tab.key)}
            className={cn(
              "-mb-px flex h-[36px] items-center gap-2 border-b-2 px-3 text-[13px]",
              selected
                ? "border-xms-accent text-xms-ink font-medium"
                : "text-xms-label hover:text-xms-ink border-transparent",
            )}
          >
            {tab.label}
            {typeof tab.count === "number" ? (
              <span className="xms-mono text-xms-muted text-[11px]">{tab.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
