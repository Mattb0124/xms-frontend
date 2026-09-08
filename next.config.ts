import type { NextConfig } from "next";

/**
 * XMS frontend configuration.
 *
 * Deliberately absent, and checked by scripts/check-next-config.mjs in the
 * pipeline gate: typescript.ignoreBuildErrors and eslint.ignoreDuringBuilds.
 * The build fails on either class of error (Packmind standard, ADR-09).
 */

const isProduction = process.env.NODE_ENV === "production";

/**
 * The Content-Security-Policy is not in this file (security review finding
 * 25). It carries a per-request nonce now, so it is built in
 * `lib/security/csp.ts` and sent by `proxy.ts`, the only place that can
 * mint one. Nothing here may send a CSP as well: two policies on one
 * response are enforced as the intersection of both, and a static one would
 * block every nonce'd script the other allows.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-Frame-Options", value: "DENY" },
];

/**
 * HSTS, production only (security review findings 10 and 25). Without it a
 * first visit or a cleartext downgrade on a hostile network is a plain HTTP
 * request, which is how a survey link's one-time token could be handed over.
 * One year with subdomains; `preload` is deliberately left off until the
 * apex and every subdomain are known to be HTTPS-only, since preloading is
 * hard to undo. Confirm the ALB or CloudFront in xms-infra does not strip it.
 * It is not sent in development, where localhost is served over HTTP and the
 * header would pin the browser to HTTPS for a year.
 */
if (isProduction) {
  securityHeaders.push({ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" });
}

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  // The development indicator is a fixed circle in the bottom left corner,
  // which is exactly where the sidebar's "Browse all screens" footer sits: it
  // covered the control and nothing could scroll out from under it. No part of
  // the product reads it, so it is off.
  devIndicators: false,
  images: { unoptimized: true },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
