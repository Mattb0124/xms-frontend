"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A CSS media query as React state. Used so the shell can choose a layout the
 * viewport can actually hold: the 238px sidebar left about 150px of content at
 * 390px wide (frontend review finding 8).
 *
 * It reads through useSyncExternalStore rather than an effect, so the server
 * render and the first client render agree on `false` and there is no
 * hydration mismatch or cascading render.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  const snapshot = useCallback(
    () => (typeof window === "undefined" || !window.matchMedia ? false : window.matchMedia(query).matches),
    [query],
  );
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

/** Below Tailwind's `md`, where the desk collapses to one column. */
export const NARROW_QUERY = "(max-width: 767px)";
