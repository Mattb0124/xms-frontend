"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A per-browser set of strings (pinned screens, starred views, history) kept
 * in localStorage. Product state that must survive the browser (saved views,
 * account pins for a team) lives on the server; this is only the shell's
 * per-person convenience layer, and it renders empty on the server.
 */
const listeners = new Map<string, Set<() => void>>();
const cache = new Map<string, string[]>();

function read(key: string): string[] {
  if (typeof window === "undefined") return [];
  const cached = cache.get(key);
  if (cached) return cached;
  try {
    const raw = window.localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const value = Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
    cache.set(key, value);
    return value;
  } catch {
    cache.set(key, []);
    return [];
  }
}

function write(key: string, value: string[]): void {
  cache.set(key, value);
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage may be unavailable; the in-memory cache still serves the session
  }
  listeners.get(key)?.forEach((fn) => fn());
}

const EMPTY: string[] = [];

export function usePersistedList(key: string, max = 50): [string[], (next: string[]) => void] {
  const subscribe = useCallback(
    (fn: () => void) => {
      const set = listeners.get(key) ?? new Set();
      set.add(fn);
      listeners.set(key, set);
      return () => {
        set.delete(fn);
      };
    },
    [key],
  );
  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => EMPTY,
  );
  const set = useCallback((next: string[]) => write(key, next.slice(0, max)), [key, max]);
  return [value, set];
}

export function useToggleInList(key: string): [string[], (item: string) => void, (item: string) => boolean] {
  const [list, set] = usePersistedList(key);
  const toggle = useCallback(
    (item: string) => set(list.includes(item) ? list.filter((v) => v !== item) : [...list, item]),
    [list, set],
  );
  const has = useCallback((item: string) => list.includes(item), [list]);
  return [list, toggle, has];
}

/** Test and sign-out helper. */
export function resetPersisted(): void {
  cache.clear();
}
