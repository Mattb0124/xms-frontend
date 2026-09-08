// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "@/proxy";
import { contentSecurityPolicy, newNonce, NONCE_HEADER } from "@/lib/security/csp";

/**
 * Security review finding 25: `script-src` carried `'unsafe-inline'`, so the
 * CSP was a host allowlist and a clickjacking control rather than an XSS
 * control. These tests hold the replacement in place: a nonce per request,
 * on the request headers where the framework reads it and on the response
 * where the browser enforces it.
 *
 * The file this covers is `proxy.ts` now: Next 16.3 deprecated the
 * `middleware` convention and renamed it to `proxy`. The assertions are the
 * ones the middleware carried, unchanged, since only the name moved.
 */
const run = (url = "https://xms.example.test/tickets") => proxy(new NextRequest(url));

const cspOf = (response: ReturnType<typeof run>) => response.headers.get("content-security-policy") ?? "";

const directive = (csp: string, name: string) =>
  csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `)) ?? "";

describe("the CSP nonce", () => {
  it("is base64 and carries none of the characters an HTML attribute would break on", () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const nonce = newNonce();
      expect(nonce).toMatch(/^[A-Za-z0-9+/]+=*$/);
      // Clerk refuses these outright, and they would escape the attribute.
      expect(nonce).not.toMatch(/[&><]/);
      expect(atob(nonce)).toHaveLength(16);
    }
  });

  it("is different on every request", () => {
    const nonces = new Set(Array.from({ length: 50 }, () => newNonce()));
    expect(nonces.size).toBe(50);
  });
});

describe("the policy", () => {
  it("allows the nonce and strict-dynamic, and no longer allows inline script", () => {
    const csp = contentSecurityPolicy({ nonce: "abc123", apiOrigin: "https://api.example.test", allowEval: false });
    const scriptSrc = directive(csp, "script-src");
    expect(scriptSrc).toContain("'nonce-abc123'");
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
    // Kept for CSP2-only browsers, which ignore strict-dynamic entirely.
    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).toContain("https://*.clerk.com");
  });

  it("keeps unsafe-inline in style-src, and no nonce there, so it is not ignored", () => {
    const csp = contentSecurityPolicy({ nonce: "abc123", apiOrigin: "https://api.example.test", allowEval: false });
    const styleSrc = directive(csp, "style-src");
    expect(styleSrc).toBe("style-src 'self' 'unsafe-inline'");
    // A nonce in style-src makes 'unsafe-inline' ignored, which would block
    // the inline styles next/font and next-themes write.
    expect(styleSrc).not.toContain("nonce");
  });

  it("allows eval only where the caller asks for it", () => {
    const options = { nonce: "abc123", apiOrigin: "https://api.example.test" };
    expect(contentSecurityPolicy({ ...options, allowEval: true })).toContain("'unsafe-eval'");
    expect(contentSecurityPolicy({ ...options, allowEval: false })).not.toContain("'unsafe-eval'");
  });

  it("keeps the rest of the policy the review asked for", () => {
    const csp = contentSecurityPolicy({ nonce: "abc123", apiOrigin: "https://api.example.test", allowEval: false });
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(directive(csp, "connect-src")).toContain("https://api.example.test");
  });
});

describe("the proxy", () => {
  it("hands the nonce to the framework and enforces the same one on the response", () => {
    const response = run();
    const nonce = response.headers.get("x-middleware-request-x-nonce");
    expect(nonce, "the request header the framework reads the nonce from").toBeTruthy();
    expect(cspOf(response)).toContain(`'nonce-${nonce}'`);
    // The request also carries the policy: Next and Clerk both read the nonce
    // back out of it when the header above is not the one they look at.
    expect(response.headers.get("x-middleware-request-content-security-policy")).toBe(cspOf(response));
    expect(NONCE_HEADER).toBe("x-nonce");
  });

  it("mints a new nonce for each document, so one page's nonce never opens another", () => {
    const first = cspOf(run("https://xms.example.test/"));
    const second = cspOf(run("https://xms.example.test/portal"));
    expect(first).not.toBe(second);
  });

  it("sends exactly one policy, and never one carrying unsafe-inline for script", () => {
    const response = run();
    // Two policies on one response are enforced as the intersection of both,
    // so next.config.ts must not send one as well.
    expect(directive(cspOf(response), "script-src")).not.toContain("'unsafe-inline'");
    expect(cspOf(response).split("script-src")).toHaveLength(2);
  });
});
