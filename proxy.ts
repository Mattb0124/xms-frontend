import { NextResponse, type NextRequest } from "next/server";
import { contentSecurityPolicy, newNonce, NONCE_HEADER } from "@/lib/security/csp";

/**
 * The nonce proxy (security review finding 25).
 *
 * Next 16.3 renamed this file convention: `middleware.ts` exporting
 * `middleware` is deprecated, and `proxy.ts` exporting `proxy` is the
 * supported name. Only the file and the export changed; the request and
 * response objects, the `config.matcher` grammar and the behaviour below are
 * the ones the middleware had.
 *
 * Every document request gets its own nonce. It goes out twice: on the
 * request headers, where the framework reads it and stamps it on every
 * script it emits (and where `@clerk/nextjs` reads `x-nonce` for its own
 * script tag), and on the response's Content-Security-Policy, which is what
 * the browser enforces. Because the policy is per request it cannot live in
 * `next.config.ts` any more, and it does not: that file sets the rest of the
 * security headers and no CSP at all, so a document never carries two
 * policies, which a browser would enforce as the intersection of both.
 *
 * Using a nonce makes a page render dynamically, which is what this
 * application does anyway: every screen reads the principal before it draws.
 */
export function proxy(request: NextRequest): NextResponse {
  const nonce = newNonce();
  const csp = contentSecurityPolicy({
    nonce,
    apiOrigin: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001",
    allowEval: process.env.NODE_ENV !== "production",
  });

  const headers = new Headers(request.headers);
  headers.set(NONCE_HEADER, nonce);
  // Next reads the nonce out of this request header; without it the scripts
  // it emits carry none and the response policy blocks its own bootstrap.
  headers.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

/**
 * Everything but the static output: `_next/static` and `_next/image` are
 * files, not documents, so a policy on them enforces nothing, and minting a
 * nonce for each one would only make them uncacheable.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
