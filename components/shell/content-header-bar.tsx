"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Screen } from "@/lib/routes";

const HeaderSlotContext = createContext<HTMLElement | null>(null);
const HeaderActionContext = createContext<HTMLElement | null>(null);

export interface ContentHeaderBarProps {
  current: Screen | undefined;
  screens: Screen[];
  onToggleSidebar: () => void;
  onFilters?: () => void;
  onSettings?: () => void;
  children: ReactNode;
}

/**
 * Grey 44px bar: hamburger, funnel, screen switcher, the filter slot (pages
 * portal their FilterBar into it), gear, local search and the primary action
 * slot (Wireframes v2 section 2).
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
  const switchable = screens.filter((s) => !s.path.includes("["));
  return (
    <HeaderSlotContext.Provider value={filterSlot}>
      <HeaderActionContext.Provider value={actionSlot}>
        <div
          className="bg-xms-bar border-xms-line flex items-center gap-2 border-b px-3"
          style={{ height: "var(--xms-header-bar-h)" }}
          data-testid="content-header-bar"
        >
          <button
            type="button"
            aria-label="Toggle sidebar"
            onClick={onToggleSidebar}
            className="text-xms-label hover:text-xms-ink h-8 w-8 rounded-[4px] text-[16px]"
          >
            ☰
          </button>
          <button
            type="button"
            aria-label="Filters"
            onClick={onFilters}
            className="text-xms-label hover:text-xms-ink h-8 w-8 rounded-[4px] text-[14px]"
          >
            ⏷
          </button>
          <label className="flex items-center">
            <span className="sr-only">Screen</span>
            <select
              aria-label="Screen switcher"
              value={current?.path ?? ""}
              onChange={(event) => router.push(event.target.value)}
              className="text-xms-ink h-8 cursor-pointer appearance-none bg-transparent pr-5 text-[14px] font-semibold"
              style={{ backgroundImage: "none" }}
            >
              {current && current.path.includes("[") ? <option value={current.path}>{current.label}</option> : null}
              {switchable.map((screen) => (
                <option key={screen.path} value={screen.path}>
                  {screen.label}
                </option>
              ))}
            </select>
            <span aria-hidden className="text-xms-muted -ml-4 text-[10px]">
              ▾
            </span>
          </label>
          <div
            ref={setFilterSlot}
            className="flex flex-1 items-center gap-2 overflow-x-auto"
            data-testid="header-filter-slot"
          />
          <button
            type="button"
            aria-label="Screen settings"
            onClick={onSettings}
            className="text-xms-label hover:text-xms-ink h-8 w-8 rounded-[4px] text-[14px]"
          >
            ⚙
          </button>
          <div ref={setActionSlot} className="flex items-center gap-2" data-testid="header-action-slot" />
        </div>
        {children}
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
