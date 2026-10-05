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

/**
 * The client ClerkProvider does not read `x-nonce` off the request, so the
 * nonce is handed to it: under `'strict-dynamic'` the script and preload tags
 * it renders are blocked without one. Its telemetry is off because it posts
 * to clerk-telemetry.com, which the policy does not open connect-src to.
 */
function Identity({ children, nonce }: { children: ReactNode; nonce?: string }) {
  if (!CLERK_ENABLED) return children;
  return (
    <ClerkProvider nonce={nonce} telemetry={false}>
      <ClerkTokenBridge />
      {children}
    </ClerkProvider>
  );
}

/**
 * Store, identity, theme, toasts and telemetry, in that order, once at the
 * root. `nonce` is the request's CSP nonce, read off the headers by the root
 * layout and passed down to Clerk and next-themes, which write script tags of
 * their own.
 */
export function Providers({ children, nonce }: { children: ReactNode; nonce?: string }) {
  const [store] = useState(makeStore);
  return (
    <ReduxProvider store={store}>
      <Identity nonce={nonce}>
        <ThemeProvider nonce={nonce}>
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
