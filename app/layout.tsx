import type { ReactNode } from "react";
import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import { headers } from "next/headers";
import { Providers } from "@/components/providers";
import { NONCE_HEADER } from "@/lib/security/csp";
import "./globals.css";

// Two typefaces and no third one (Wireframes v2 section 4): Inter for the UI,
// IBM Plex Mono for keys, SLA values, counts, tool calls and caption labels.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "XMS",
  description: "Xelerated Managed Services: tickets, SLAs, contracts and knowledge for the DMS practice.",
};

/**
 * The nonce is minted per request by `middleware.ts` and read back here, so
 * the one inline script this tree writes (next-themes, before the first
 * paint) carries it. The framework's own scripts take it from the request
 * header without being told, and so does `@clerk/nextjs`, which reads
 * `x-nonce` itself.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const nonce = (await headers()).get(NONCE_HEADER) ?? undefined;
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${plexMono.variable} xms-scope h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers nonce={nonce}>{children}</Providers>
      </body>
    </html>
  );
}
