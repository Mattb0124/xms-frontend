"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * Theme provider: class-based dark mode (`.dark` on <html>), light by default.
 * The portal route group always renders light (01-architecture/DESIGN-SYSTEM.md
 * section 5); the internal application follows the user's choice.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
