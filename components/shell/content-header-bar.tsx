"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ICON, ChevronDownIcon, FunnelIcon, GearIcon, MenuIcon, SearchIcon } from "@/components/xms/icons";
import type { Screen } from "@/lib/routes";
import { cn } from "@/lib/utils";

const HeaderSlotContext = createContext<HTMLElement | null>(null);
const HeaderActionContext = createContext<HTMLElement | null>(null);
interface HeaderSearchApi {
  slot: HTMLElement | null;
  setFilled: (filled: boolean) => void;
}
const HeaderSearchContext = createContext<HeaderSearchApi>({ slot: null, setFilled: () => {} });

interface HeaderPanelApi {
  slot: HTMLElement | null;
  open: boolean;
  setOpen: (open: boolean | ((open: boolean) => boolean)) => void;
  /** The screen registers itself so the funnel is only offered where it does something. */
  register: (count: number) => void;
  unregister: () => void;
}

const HeaderPanelContext = createContext<HeaderPanelApi | null>(null);

interface HeaderSettingsApi {
  register: (open: () => void) => void;
  unregister: () => void;
}

const HeaderSettingsContext = createContext<HeaderSettingsApi | null>(null);

export interface ContentHeaderBarProps {
  current: Screen | undefined;
  screens: Screen[];
  onToggleSidebar: () => void;
  onSettings?: () => void;
  children: ReactNode;
}

const ICON_BUTTON =
  "text-xms-icon hover:text-xms-accent hover:bg-xms-card flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px]";

/**
 * The height of every control standing in the toolbar band, from render 01:
 * the pills measure 32px and sit with 8px between them, centred in the 51px
 * of content the 52px band leaves.
 */
export const HEADER_CONTROL = "h-[var(--xms-header-pill-h)]";

/**
 * The grey 52px tool strip (hand-off section 2c, v3 renders 01, 08, 09):
 * hamburger, funnel, the screen title with a chevron that switches screens,
 * the filter slot pages portal their dimensions into, a gear, the local
 * search slot and the primary action slot. Under it, when the funnel is
 * pressed, the filter builder panel on the same grey.
 *
 * The strip is `shrink-0` for the same reason the finder bar is: as a flex
 * child it was being squeezed below its height. The title is a real button
 * carrying the label and the chevron with a transparent `select` over it, so
 * the control reads as "Queue v" rather than as a native dropdown with the
 * platform's own arrow and border.
 */
export function ContentHeaderBar({ current, screens, onToggleSidebar, onSettings, children }: ContentHeaderBarProps) {
  const router = useRouter();
  const [filterSlot, setFilterSlot] = useState<HTMLElement | null>(null);
  const [actionSlot, setActionSlot] = useState<HTMLElement | null>(null);
  const [searchSlot, setSearchSlot] = useState<HTMLElement | null>(null);
  // Whether a screen has portalled a search into the slot this render.
  const [searchFilled, setSearchFilled] = useState(false);
  const searchApi = useMemo(() => ({ slot: searchSlot, setFilled: setSearchFilled }), [searchSlot]);
  const [panelSlot, setPanelSlot] = useState<HTMLElement | null>(null);
  // The funnel is only offered on a screen that has registered a builder, and
  // it carries the number of conditions standing behind it.
  const [panel, setPanel] = useState<{ present: boolean; count: number }>({ present: false, count: 0 });
  const [panelOpen, setPanelOpen] = useState(false);
  // What the gear opens on this screen. A screen with nothing behind it does
  // not get the tool, for the same reason a screen without a builder does not
  // get the funnel: a control that does nothing is worse than no control.
  const [settings, setSettings] = useState<(() => void) | null>(null);
  const switchable = screens.filter((s) => !s.path.includes("["));
  // Both callbacks are stable, and the context value is memoised on what it
  // actually carries: a new identity on every render would re-run the
  // registering effect in the panel, which re-renders the bar, which is an
  // update loop React stops with "Maximum update depth exceeded".
  const register = useCallback(
    (count: number) =>
      setPanel((current) => (current.present && current.count === count ? current : { present: true, count })),
    [],
  );
  const unregister = useCallback(
    () => setPanel((current) => (current.present ? { present: false, count: 0 } : current)),
    [],
  );
  const registerSettings = useCallback((open: () => void) => setSettings(() => open), []);
  const unregisterSettings = useCallback(() => setSettings(null), []);
  const settingsApi = useMemo<HeaderSettingsApi>(
    () => ({ register: registerSettings, unregister: unregisterSettings }),
    [registerSettings, unregisterSettings],
  );
  const panelApi = useMemo<HeaderPanelApi>(
    () => ({ slot: panelSlot, open: panelOpen, setOpen: setPanelOpen, register, unregister }),
    [panelSlot, panelOpen, register, unregister],
  );
  return (
    <HeaderSlotContext.Provider value={filterSlot}>
      <HeaderActionContext.Provider value={actionSlot}>
        <HeaderSearchContext.Provider value={searchApi}>
          <HeaderSettingsContext.Provider value={settingsApi}>
            <HeaderPanelContext.Provider value={panelApi}>
              <div
                className="xms-layer-strip bg-xms-bar border-xms-bar-line flex shrink-0 items-center gap-[10px] border-b px-4"
                style={{ height: "var(--xms-header-bar-h)" }}
                data-testid="content-header-bar"
              >
                <button type="button" aria-label="Toggle sidebar" onClick={onToggleSidebar} className={ICON_BUTTON}>
                  <MenuIcon size={ICON.bar} />
                </button>
                {panel.present ? (
                  <button
                    type="button"
                    aria-label="Filters"
                    aria-expanded={panelOpen}
                    onClick={() => setPanelOpen((open) => !open)}
                    className={cn(ICON_BUTTON, "relative", panelOpen && "bg-xms-card text-xms-accent")}
                  >
                    <FunnelIcon size={ICON.bar} />
                    {panel.count > 0 ? (
                      <span className="bg-xms-accent xms-mono absolute top-[2px] right-[1px] flex h-[14px] min-w-[14px] items-center justify-center rounded-[999px] px-[3px] text-[9px] font-semibold text-white">
                        {panel.count}
                      </span>
                    ) : null}
                  </button>
                ) : null}
                <span className="relative flex shrink-0 items-center gap-[6px] pr-1">
                  <span className="text-xms-ink text-[15px] font-semibold">{current?.label ?? "XMS"}</span>
                  <ChevronDownIcon size={ICON.control} className="text-xms-muted" />
                  <select
                    aria-label="Screen switcher"
                    value={current?.path ?? ""}
                    onChange={(event) => router.push(event.target.value)}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  >
                    {current && current.path.includes("[") ? (
                      <option value={current.path}>{current.label}</option>
                    ) : null}
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
                {settings || onSettings ? (
                  <button
                    type="button"
                    aria-label="Screen settings"
                    onClick={settings ?? onSettings}
                    className={ICON_BUTTON}
                  >
                    <GearIcon size={ICON.bar} />
                  </button>
                ) : null}
                {/* The render's local search sits between the gear and the primary
                action. A screen that has one portals it here. The slot used to
                hold its 186px whether or not a screen filled it, so on every
                screen without a search the gear stood marooned that far from
                the action beside it. It takes width only when it carries
                something. */}
                <div
                  ref={setSearchSlot}
                  className={cn("flex shrink-0 items-center", searchFilled && "w-[186px]")}
                  data-testid="header-search-slot"
                />
                <div
                  ref={setActionSlot}
                  className="flex shrink-0 items-center gap-2"
                  data-testid="header-action-slot"
                />
              </div>
              {/* The builder stands on the same grey as the strip, directly
                under it, so the conditions read as part of where you are
                rather than as part of the list. */}
              <div
                ref={setPanelSlot}
                hidden={!panelOpen}
                className="bg-xms-bar border-xms-bar-line shrink-0 border-b px-4 py-3"
                data-testid="header-panel-slot"
              />
              {children}
            </HeaderPanelContext.Provider>
          </HeaderSettingsContext.Provider>
        </HeaderSearchContext.Provider>
      </HeaderActionContext.Provider>
    </HeaderSlotContext.Provider>
  );
}

/**
 * A screen's filter builder: registers the funnel (and the count on it) and
 * portals the builder into the panel under the strip. Children are mounted
 * only while the panel is open, so a closed builder costs nothing.
 */
export function useHeaderFilterPanel(): { open: boolean; toggle: () => void } {
  const panel = useContext(HeaderPanelContext);
  return { open: panel?.open ?? false, toggle: () => panel?.setOpen((open) => !open) };
}

export function HeaderFilterPanel({ count, children }: { count: number; children: ReactNode }) {
  const panel = useContext(HeaderPanelContext);
  const register = panel?.register;
  const unregister = panel?.unregister;
  useEffect(() => {
    register?.(count);
    return () => unregister?.();
  }, [register, unregister, count]);
  return panel?.slot && panel.open ? createPortal(children, panel.slot) : null;
}

/**
 * Put something behind the strip's gear for as long as this screen is
 * mounted. The handler is held in a ref so a screen may pass a fresh closure
 * on every render without re-registering, which would loop.
 */
export function useHeaderSettings(open: () => void): void {
  const settings = useContext(HeaderSettingsContext);
  const held = useRef(open);
  // Written after the render, never during it: the effect below registers
  // once and calls whatever the latest render left here.
  useEffect(() => {
    held.current = open;
  });
  const register = settings?.register;
  const unregister = settings?.unregister;
  useEffect(() => {
    register?.(() => held.current());
    return () => unregister?.();
  }, [register, unregister]);
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
  const { slot, setFilled } = useContext(HeaderSearchContext);
  useEffect(() => {
    setFilled(true);
    return () => setFilled(false);
  }, [setFilled]);
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
      className={cn(
        "xms-field bg-xms-card flex h-[var(--xms-header-pill-h)] w-full items-center gap-2 rounded-[var(--xms-radius-control)] border px-[11px]",
        // A search reads in one ink too: ink until it carries a term, blue
        // once it does, since a term is a filter like any other.
        value ? "border-xms-accent text-xms-accent" : "border-xms-ink text-xms-ink",
      )}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      <SearchIcon size={ICON.control} className="text-xms-muted shrink-0" />
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
