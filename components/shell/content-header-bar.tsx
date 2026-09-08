"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDownIcon, FunnelIcon, GearIcon, MenuIcon, SearchIcon } from "@/components/xms/icons";
import type { Screen } from "@/lib/routes";

const HeaderSlotContext = createContext<HTMLElement | null>(null);
const HeaderActionContext = createContext<HTMLElement | null>(null);
const HeaderSearchContext = createContext<HTMLElement | null>(null);

export interface ContentHeaderBarProps {
  current: Screen | undefined;
  screens: Screen[];
  onToggleSidebar: () => void;
  onFilters?: () => void;
  onSettings?: () => void;
  children: ReactNode;
}

const ICON_BUTTON =
  "text-xms-label hover:text-xms-ink hover:bg-xms-card flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px]";

/**
 * The height of every control standing in the toolbar band, from render 01:
 * the pills measure 32px and sit with 8px between them, centred in the 51px
 * of content the 52px band leaves.
 */
export const HEADER_CONTROL = "h-[var(--xms-header-pill-h)]";

/**
 * Grey 44px bar (Wireframes v2 section 2, v3 renders 01, 08, 09): hamburger,
 * funnel, the screen title with a chevron that switches screens, the filter
 * slot pages portal their pills into, a gear, the local search slot and the
 * primary action slot.
 *
 * The bar is `shrink-0` for the same reason the finder bar is: as a flex child
 * it was being squeezed below its 44px. The title is a real button carrying
 * the label and the chevron with a transparent `select` over it, so the
 * control reads as the render's "Queue v" rather than as a native dropdown
 * with the platform's own arrow and border.
 */
export function ContentHeaderBar({
  current,
  screens,
  onToggleSidebar,
  onFilters,
  onSettings,
  children,
}: ContentHeaderBarProps) {
  const router = useRouter();
  const [filterSlot, setFilterSlot] = useState<HTMLElement | null>(null);
  const [actionSlot, setActionSlot] = useState<HTMLElement | null>(null);
  const [searchSlot, setSearchSlot] = useState<HTMLElement | null>(null);
  const switchable = screens.filter((s) => !s.path.includes("["));
  return (
    <HeaderSlotContext.Provider value={filterSlot}>
      <HeaderActionContext.Provider value={actionSlot}>
        <HeaderSearchContext.Provider value={searchSlot}>
          <div
            className="bg-xms-bar border-xms-bar-line flex shrink-0 items-center gap-[10px] border-b px-4"
            style={{ height: "var(--xms-header-bar-h)" }}
            data-testid="content-header-bar"
          >
            <button type="button" aria-label="Toggle sidebar" onClick={onToggleSidebar} className={ICON_BUTTON}>
              <MenuIcon size={18} />
            </button>
            <button type="button" aria-label="Filters" onClick={onFilters} className={ICON_BUTTON}>
              <FunnelIcon size={16} />
            </button>
            <span className="relative flex shrink-0 items-center gap-[6px] pr-1">
              <span className="text-xms-ink text-[15px] font-semibold">{current?.label ?? "XMS"}</span>
              <ChevronDownIcon size={14} className="text-xms-muted" />
              <select
                aria-label="Screen switcher"
                value={current?.path ?? ""}
                onChange={(event) => router.push(event.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
              >
                {current && current.path.includes("[") ? <option value={current.path}>{current.label}</option> : null}
                {switchable.map((screen) => (
                  <option key={screen.path} value={screen.path}>
                    {screen.label}
                  </option>
                ))}
              </select>
            </span>
            <div
              ref={setFilterSlot}
              className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto"
              data-testid="header-filter-slot"
            />
            <button type="button" aria-label="Screen settings" onClick={onSettings} className={ICON_BUTTON}>
              <GearIcon size={16} />
            </button>
            {/* The render's local search sits between the gear and the primary
                action. A screen that has one portals it here; the placeholder
                keeps the width reserved so the blue action never moves. */}
            <div
              ref={setSearchSlot}
              className="flex w-[186px] shrink-0 items-center"
              data-testid="header-search-slot"
            />
            <div ref={setActionSlot} className="flex shrink-0 items-center gap-2" data-testid="header-action-slot" />
          </div>
          {children}
        </HeaderSearchContext.Provider>
      </HeaderActionContext.Provider>
    </HeaderSlotContext.Provider>
  );
}

/** Pages render their FilterBar inside this; it lands in the header bar's slot. */
export function HeaderFilters({ children }: { children: ReactNode }) {
  const slot = useContext(HeaderSlotContext);
  return slot ? createPortal(children, slot) : null;
}

/** The primary action (blue "New") for the current screen. */
export function HeaderAction({ children }: { children: ReactNode }) {
  const slot = useContext(HeaderActionContext);
  return slot ? createPortal(children, slot) : null;
}

/** The screen's own search field, in the header bar beside the gear. */
export function HeaderSearch({ children }: { children: ReactNode }) {
  const slot = useContext(HeaderSearchContext);
  return slot ? createPortal(children, slot) : null;
}

/**
 * The header bar's search field: the rounded control with the magnifier that
 * every v3 render carries to the left of the primary action.
 */
export function HeaderSearchField({
  value,
  onChange,
  onSubmit,
  label = "Search",
}: {
  value: string;
  onChange: (next: string) => void;
  onSubmit?: () => void;
  label?: string;
}) {
  return (
    <form
      className="border-xms-control-line bg-xms-card flex h-[var(--xms-header-pill-h)] w-full items-center gap-2 rounded-[var(--xms-radius-control)] border px-[11px]"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      <SearchIcon size={14} className="text-xms-muted shrink-0" />
      <input
        type="search"
        aria-label={label}
        placeholder="Search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="text-xms-ink min-w-0 flex-1 bg-transparent text-[13px] outline-none"
      />
    </form>
  );
}
