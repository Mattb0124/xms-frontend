import type { NextConfig } from "next";

/**
 * XMS frontend configuration.
 *
 * Deliberately absent, and checked by scripts/check-next-config.mjs in the
 * pipeline gate: typescript.ignoreBuildErrors and eslint.ignoreDuringBuilds.
 * The build fails on either class of error (Packmind standard, ADR-09).
 */

const apiOrigin = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
const clerkOrigins = "https://*.clerk.accounts.dev https://*.clerk.com https://clerk.com";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${clerkOrigins}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://img.clerk.com",
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin} ${clerkOrigins} wss://*.clerk.accounts.dev`,
  `frame-src ${clerkOrigins}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
