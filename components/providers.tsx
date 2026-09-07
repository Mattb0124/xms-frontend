"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { useEffect, useState, type ReactNode } from "react";
import { Provider as ReduxProvider } from "react-redux";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster, ToastProvider } from "@/components/xms/toast";
import { CLERK_ENABLED } from "@/lib/auth/dev-mode";
import { clerkTokenProvider, setTokenProvider } from "@/lib/auth/token";
import { ScreenViews, TelemetryProvider } from "@/lib/telemetry/provider";
import { makeStore } from "@/redux/store";

/** Registers Clerk's getToken as the bearer source once the session is ready. */
function ClerkTokenBridge() {
  const { getToken, isLoaded } = useAuth();
  useEffect(() => {
    if (isLoaded) setTokenProvider(clerkTokenProvider(() => getToken()));
  }, [getToken, isLoaded]);
  return null;
}

function Identity({ children }: { children: ReactNode }) {
  if (!CLERK_ENABLED) return <>{children}</>;
  return (
    <ClerkProvider>
      <ClerkTokenBridge />
      {children}
    </ClerkProvider>
  );
}

/** Store, identity, theme, toasts and telemetry, in that order, once at the root. */
export function Providers({ children }: { children: ReactNode }) {
  const [store] = useState(makeStore);
  return (
    <ReduxProvider store={store}>
      <Identity>
        <ThemeProvider>
          <ToastProvider>
            <TelemetryProvider>
              <ScreenViews />
              {children}
              <Toaster />
            </TelemetryProvider>
          </ToastProvider>
        </ThemeProvider>
      </Identity>
    </ReduxProvider>
  );
}
