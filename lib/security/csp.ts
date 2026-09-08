/**
 * The Content Security Policy, in one place, built per request around a
 * nonce (security review finding 25).
 *
 * The App Router inlines the flight payload and the bootstrap script into
 * every server-rendered document, so a host-only `script-src` could not drop
 * `'unsafe-inline'` and the policy was a host allowlist and a clickjacking
 * control rather than an XSS control. `proxy.ts` now mints a nonce per
 * request, hands it to the framework on the request headers and sends this
 * policy on the response, so the scripts Next emits carry the nonce and an
 * injected `<script>` does not.
 *
 * `'strict-dynamic'` is what makes that workable: the bootstrap script loads
 * the chunks, and a script loaded by a trusted script is trusted. It also
 * tells a CSP3 browser to ignore `'self'` and the host allowlist, which are
 * kept for CSP2-only browsers, where they are the whole policy.
 *
 * `style-src` keeps `'unsafe-inline'`, and this is deliberate: `next/font`
 * and next-themes write inline `style` attributes and elements that carry no
 * nonce, and a nonce in `style-src` would make `'unsafe-inline'` ignored and
 * break the page. Inline style is not a script-execution sink here (no
 * `expression()` in any browser this application supports), so the residual
 * risk is style injection on a page that has no HTML-injection sink at all.
 */

/** Clerk's script, frame and websocket origins; also the CSP2 fallback allowlist. */
export const CLERK_ORIGINS = "https://*.clerk.accounts.dev https://*.clerk.com https://clerk.com";

/** The header the proxy puts the nonce on, and the one Clerk reads it from. */
export const NONCE_HEADER = "x-nonce";

/** 16 random bytes, base64: no `<`, `>` or `&`, which Clerk refuses in a nonce. */
export function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export interface CspOptions {
  nonce: string;
  /** The API origin the browser may call; also in `connect-src`. */
  apiOrigin: string;
  /** React's development call stacks need `'unsafe-eval'`; production never gets it. */
  allowEval: boolean;
}

export function contentSecurityPolicy({ nonce, apiOrigin, allowEval }: CspOptions): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...(allowEval ? ["'unsafe-eval'"] : []),
    CLERK_ORIGINS,
  ].join(" ");
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://img.clerk.com",
    "font-src 'self' data:",
    `connect-src 'self' ${apiOrigin} ${CLERK_ORIGINS} wss://*.clerk.accounts.dev`,
    `frame-src ${CLERK_ORIGINS}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}
