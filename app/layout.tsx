import type { ReactNode } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Providers } from "@/components/providers";
import { NONCE_HEADER } from "@/lib/security/csp";
import "./globals.css";

// Two typefaces and no third one (Wireframes v2 section 4): Inter for the UI,
// IBM Plex Mono for keys, SLA values, counts, tool calls and caption labels.
// Both are declared in styles/tokens/fonts.css over files in public/fonts
// rather than fetched by next/font at build time, which failed silently for
// Inter and left every screen in the platform sans (reviewer finding 6).

export const metadata: Metadata = {
  // The tab reads the product name in full. XMS is the short form the
  // interface uses; a browser tab is where a person meets the name first.
  title: "X Managed Services",
  description: "X Managed Services: cases, SLAs, contracts and knowledge for the DMS practice.",
};

/**
 * The nonce is minted per request by `proxy.ts` and read back here, so
 * the one inline script this tree writes (next-themes, before the first
 * paint) carries it. The framework's own scripts take it from the request
 * header without being told, and so does `@clerk/nextjs`, which reads
 * `x-nonce` itself.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const nonce = (await headers()).get(NONCE_HEADER) ?? undefined;
  return (
    <html lang="en" suppressHydrationWarning className="xms-scope h-full antialiased">
      <body className="flex min-h-full flex-col">
        <Providers nonce={nonce}>{children}</Providers>
      </body>
    </html>
  );
}
