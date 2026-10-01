// @vitest-environment node
import { describe, expect, it } from "vitest";
import { contentSecurityPolicy } from "@/lib/security/csp";

/**
 * What Clerk's sign-in needs from the policy, held against the list
 * `@clerk/nextjs` builds for itself (`server/content-security-policy.js`):
 * only what sign-in reaches is taken from it, and its telemetry origin is not.
 */
const CLERK =
  "https://*.clerk.accounts.dev https://*.clerk.com https://clerk.com https://famous-porpoise-22.clerk.accounts.dev";

const csp = contentSecurityPolicy({
  nonce: "abc123",
  allowEval: false,
  clerkFrontendApi: "https://famous-porpoise-22.clerk.accounts.dev",
});

const directive = (name: string) =>
  csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `)) ?? "";

describe("the policy Clerk's sign-in runs under", () => {
  it("frames Clerk and the Cloudflare challenge of its bot protection, and nothing else", () => {
    expect(directive("frame-src")).toBe(`frame-src ${CLERK} https://challenges.cloudflare.com`);
  });

  it("names the challenge script beside the Clerk origins, for browsers that ignore strict-dynamic", () => {
    expect(directive("script-src")).toBe(
      `script-src 'self' 'nonce-abc123' 'strict-dynamic' ${CLERK} https://challenges.cloudflare.com`,
    );
  });

  it("keeps the image host and the blob workers Clerk's components use", () => {
    expect(directive("img-src")).toContain("https://img.clerk.com");
    expect(directive("worker-src")).toBe("worker-src 'self' blob:");
  });

  it("does not open connect-src to Clerk's telemetry, which the provider turns off", () => {
    expect(directive("connect-src")).toBe(`connect-src 'self' ${CLERK} wss://*.clerk.accounts.dev`);
    expect(csp).not.toContain("clerk-telemetry.com");
  });
});
