"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * Theme provider: class-based dark mode (`.dark` on <html>), light by default.
 * The portal route group always renders light (01-architecture/DESIGN-SYSTEM.md
 * section 5); the internal application follows the user's choice.
 *
 * next-themes writes an inline script into the document to set the class
 * before the first paint, so it takes the request's nonce; without it the CSP
 * blocks that script and the page paints the wrong theme first (security
 * review finding 25).
 */
export function ThemeProvider({ children, nonce }: { children: ReactNode; nonce?: string }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      nonce={nonce}
    >
      {children}
    </NextThemesProvider>
  );
}
