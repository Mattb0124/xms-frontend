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

/**
 * The record's tab row, measured off the prototype's own markup
 * (`proto-v3/template.pretty.html`): the row is
 * `display:flex;gap:2px;padding:0 10px` over a `1px #E4E8F5` rule; a tab is
 * `padding:15px 9px` at `14px/1`, 500 in `--xms-label` at rest and 600 in the
 * strong link colour when selected, with a 2px underline the width of the tab
 * sitting on the row's own bottom edge.
 *
 * The built row was 13px labels in a 36px box with 12px of horizontal padding
 * and a 4px gap, and the selected label went ink rather than blue, so the tabs
 * read larger than the render's and the underline shorter.
 */
export function TabBar({ tabs, active, onChange, className }: TabBarProps) {
  return (
    <div role="tablist" className={cn("border-xms-line flex items-end gap-[2px] border-b px-[10px]", className)}>
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
              "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-[9px] py-[15px] text-[14px] leading-none whitespace-nowrap",
              selected
                ? "border-xms-accent text-xms-accent-hover font-semibold"
                : "text-xms-label hover:text-xms-ink border-transparent font-medium",
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
