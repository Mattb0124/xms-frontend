"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { getBearerToken } from "@/lib/auth/token";
import { matchScreen } from "@/lib/routes";
import { fetchTransport, TelemetryClient, type UsageAttrs, type UsageEventType } from "@/lib/telemetry/client";
import { API_BASE_URL } from "@/redux/api";

const TelemetryContext = createContext<TelemetryClient | null>(null);

export function TelemetryProvider({ children, client }: { children: ReactNode; client?: TelemetryClient }) {
  const value = useMemo(
    () => client ?? new TelemetryClient({ transport: fetchTransport(API_BASE_URL, getBearerToken) }),
    [client],
  );
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void value.flush({ keepalive: true });
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, [value]);
  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>;
}

export function useTelemetry(): TelemetryClient | null {
  return useContext(TelemetryContext);
}

/** Emits screen.view from the route registry on every navigation, plus screen.leave with the dwell. */
export function ScreenViews() {
  const pathname = usePathname();
  const client = useTelemetry();
  const enteredAt = useRef<number>(0);
  useEffect(() => {
    const screen = matchScreen(pathname)?.screen;
    if (!client || !screen) return;
    enteredAt.current = Date.now();
    client.track("screen.view", { path_template: matchScreen(pathname)?.path ?? pathname }, screen);
    return () => {
      client.track("screen.leave", { duration_ms: Date.now() - enteredAt.current }, screen);
    };
  }, [pathname, client]);
  return null;
}

/**
 * useTrack("ticket.create") returns a function that records action.completed
 * with the current screen id and any structured facts. Identifiers only.
 */
export function useTrack(action: string): (attrs?: UsageAttrs, type?: UsageEventType) => void {
  const client = useTelemetry();
  const pathname = usePathname();
  return useCallback(
    (attrs: UsageAttrs = {}, type: UsageEventType = "action.completed") => {
      client?.track(type, { action, ...attrs }, matchScreen(pathname)?.screen);
    },
    [client, pathname, action],
  );
}
