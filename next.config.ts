import type { NextConfig } from "next";

/**
 * XMS frontend configuration.
 *
 * Deliberately absent, and checked by scripts/check-next-config.mjs in the
 * pipeline gate: typescript.ignoreBuildErrors and eslint.ignoreDuringBuilds.
 * The build fails on either class of error (Packmind standard, ADR-09).
 */

const isProduction = process.env.NODE_ENV === "production";
const apiOrigin = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
const clerkOrigins = "https://*.clerk.accounts.dev https://*.clerk.com https://clerk.com";

/**
 * Why 'unsafe-inline' is still in script-src (security review finding 25).
 *
 * The App Router inlines the flight payload and the bootstrap script into
 * every server-rendered document, so a host-only script-src cannot be
 * tightened without a per-request nonce. Emitting one needs a middleware.ts
 * that stamps the nonce on the header and hands it to the framework, plus
 * `strict-dynamic` so the chunk loader keeps working. That is a change with
 * its own rollout, so it is tracked in CLAUDE.md rather than done here.
 *
 * The residual risk is bounded and was checked, not assumed: the application
 * has no HTML-injection sink at all (no dangerouslySetInnerHTML, no
 * innerHTML, no markdown renderer anywhere under app/, lib/, components/ or
 * redux/), every href and window.open target built from server data is
 * validated in lib/safe-url, `object-src 'none'`, `base-uri 'self'`,
 * `form-action 'self'` and `frame-ancestors 'none'` are all set, and there is
 * no cookie authentication to steal. So the CSP is a host allowlist and a
 * clickjacking control today, not an XSS control, and this comment is here so
 * the header block is not read as complete.
 *
 * 'unsafe-eval' is allowed in development only, where React's dev-mode call
 * stacks need it; production never gets it.
 */
const scriptSrc = ["'self'", "'unsafe-inline'", ...(isProduction ? [] : ["'unsafe-eval'"]), clerkOrigins].join(" ");

const csp = [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
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

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
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
  images: { unoptimized: true },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
