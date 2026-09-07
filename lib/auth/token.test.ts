import { afterEach, describe, expect, it, vi } from "vitest";

describe("token providers", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    window.localStorage.clear();
  });

  it("defaults to the no-token provider without Clerk or dev mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_DEV_MODE", "");
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
    const mod = await import("@/lib/auth/token");
    expect(mod.getTokenProvider().kind).toBe("none");
    expect(await mod.getBearerToken()).toBeNull();
  });

  it("reads the pasted token from localStorage in dev mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_DEV_MODE", "true");
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
    const mod = await import("@/lib/auth/token");
    expect(mod.getTokenProvider().kind).toBe("dev");
    mod.setDevToken("dev.token.value");
    expect(await mod.getBearerToken()).toBe("dev.token.value");
    mod.setDevToken(null);
    expect(await mod.getBearerToken()).toBeNull();
  });

  it("uses the registered Clerk getter once registered", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_DEV_MODE", "");
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_x");
    const mod = await import("@/lib/auth/token");
    expect(mod.getTokenProvider().kind).toBe("none");
    mod.setTokenProvider(mod.clerkTokenProvider(async () => "clerk.jwt"));
    expect(mod.getTokenProvider().kind).toBe("clerk");
    expect(await mod.getBearerToken()).toBe("clerk.jwt");
  });

  it("refuses dev mode in a production build", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_DEV_MODE", "true");
    vi.stubEnv("NODE_ENV", "production");
    await expect(import("@/lib/auth/dev-mode")).rejects.toThrow(/production build/);
  });
});
