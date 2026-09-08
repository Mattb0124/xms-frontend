// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The security header block (security review findings 10, 25 and 27). It read
 * as complete while carrying no Strict-Transport-Security at all, so a first
 * visit or a downgrade on a hostile network was a plain HTTP request, which is
 * how a survey link's one-time token could be handed over.
 */
async function headersFor(nodeEnv: string): Promise<Record<string, string>> {
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.resetModules();
  const config = (await import("@/next.config")).default;
  const groups = await config.headers!();
  expect(groups).toHaveLength(1);
  expect(groups[0].source).toBe("/(.*)");
  return Object.fromEntries(groups[0].headers.map((header) => [header.key, header.value]));
}

describe("the security headers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("sends HSTS for a year including subdomains in production", async () => {
    const headers = await headersFor("production");
    expect(headers["Strict-Transport-Security"]).toBe("max-age=31536000; includeSubDomains");
    // One year, per the review; anything shorter leaves the downgrade window open.
    const maxAge = Number(/max-age=(\d+)/.exec(headers["Strict-Transport-Security"])![1]);
    expect(maxAge).toBeGreaterThanOrEqual(31_536_000);
    // preload is a one-way door and is deliberately not claimed yet.
    expect(headers["Strict-Transport-Security"]).not.toContain("preload");
  });

  it("does not pin localhost to HTTPS in development", async () => {
    const headers = await headersFor("development");
    expect(headers["Strict-Transport-Security"]).toBeUndefined();
  });

  it("keeps the rest of the block on every environment", async () => {
    for (const environment of ["production", "development"]) {
      const headers = await headersFor(environment);
      expect(headers["X-Content-Type-Options"]).toBe("nosniff");
      expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
      expect(headers["X-Frame-Options"]).toBe("DENY");
      expect(headers["Permissions-Policy"]).toContain("camera=()");
    }
  });

  /**
   * The CSP moved to middleware.ts when it gained a per-request nonce
   * (security review finding 25). It must not be sent from here as well: a
   * response carrying two policies is held to the intersection of both, so a
   * static one would block every nonce'd script the other allows.
   */
  it("sends no Content-Security-Policy of its own, which middleware.ts now owns", async () => {
    for (const environment of ["production", "development"]) {
      expect(await headersFor(environment)).not.toHaveProperty("Content-Security-Policy");
    }
    expect(readFileSync(join(process.cwd(), "next.config.ts"), "utf8")).not.toContain("script-src");
  });
});
