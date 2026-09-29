import { afterEach, describe, expect, it, vi } from "vitest";
import { DEPLOY_TARGETS, readDeployTarget } from "@/lib/auth/dev-mode";

describe("readDeployTarget", () => {
  it("names the four targets and takes only those", () => {
    expect([...DEPLOY_TARGETS]).toEqual(["local", "dev", "demo", "production"]);
    for (const target of DEPLOY_TARGETS) expect(readDeployTarget(target, "development")).toBe(target);
    expect(readDeployTarget(" demo ", "production")).toBe("demo");
  });

  it("reads unset as local in a development build and as production in a built one", () => {
    expect(readDeployTarget(undefined, "development")).toBe("local");
    expect(readDeployTarget("", "test")).toBe("local");
    // Security review finding 27: forgetting the variable in a pipeline must
    // close the door, so an unnamed target in a built image is production.
    expect(readDeployTarget(undefined, "production")).toBe("production");
    expect(readDeployTarget("staging", "production")).toBe("production");
    expect(readDeployTarget("LOCAL", "production")).toBe("production");
  });
});

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

  it("reads the pasted token from localStorage in dev mode on the local target", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_DEV_MODE", "true");
    vi.stubEnv("NEXT_PUBLIC_DEPLOY_TARGET", "local");
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
    const mod = await import("@/lib/auth/token");
    expect((await import("@/lib/auth/dev-mode")).IS_LOCAL_TARGET).toBe(true);
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

  it("refuses dev mode on every target but local, naming the one it was given", async () => {
    for (const target of ["dev", "demo", "production"] as const) {
      vi.resetModules();
      vi.stubEnv("NEXT_PUBLIC_AUTH_DEV_MODE", "true");
      vi.stubEnv("NEXT_PUBLIC_DEPLOY_TARGET", target);
      await expect(import("@/lib/auth/dev-mode")).rejects.toThrow(
        new RegExp(`cannot be enabled for the ${target} deploy target`),
      );
    }
  });

  it("refuses dev mode in a build that names no target at all", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_DEV_MODE", "true");
    vi.stubEnv("NEXT_PUBLIC_DEPLOY_TARGET", "");
    vi.stubEnv("NODE_ENV", "production");
    await expect(import("@/lib/auth/dev-mode")).rejects.toThrow(/production deploy target/);
  });

  it("leaves the dev sign-in and the token in storage alone on a target that is not local", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_DEV_MODE", "");
    vi.stubEnv("NEXT_PUBLIC_DEPLOY_TARGET", "demo");
    const devMode = await import("@/lib/auth/dev-mode");
    expect(devMode.DEPLOY_TARGET).toBe("demo");
    expect(devMode.IS_LOCAL_TARGET).toBe(false);
    expect(devMode.AUTH_DEV_MODE).toBe(false);

    const mod = await import("@/lib/auth/token");
    expect(mod.getTokenProvider().kind).toBe("none");
    window.localStorage.setItem(devMode.DEV_TOKEN_STORAGE_KEY, "left.behind");
    mod.setDevToken("new.token");
    expect(window.localStorage.getItem(devMode.DEV_TOKEN_STORAGE_KEY)).toBe("left.behind");
    expect(await mod.devTokenProvider.getToken()).toBeNull();
  });
});
