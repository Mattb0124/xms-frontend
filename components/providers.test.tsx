import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const clerkProvider = vi.hoisted(() => vi.fn());

vi.mock("@clerk/nextjs", () => ({
  ClerkProvider: ({ children, ...props }: { children: ReactNode }) => {
    clerkProvider(props);
    return children;
  },
  useAuth: () => ({ getToken: async () => null, isLoaded: false }),
}));

// No registered screen answers this path, so ScreenViews queues no telemetry.
vi.mock("next/navigation", () => ({ usePathname: () => "/providers-test" }));

async function renderProviders(publishableKey: string) {
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", publishableKey);
  const { Providers } = await import("@/components/providers");
  render(
    <Providers nonce="abc123">
      <p>Page</p>
    </Providers>,
  );
}

describe("Providers", () => {
  beforeEach(() => {
    // next-themes reads the colour scheme in an effect, and jsdom has no matchMedia.
    vi.stubGlobal("matchMedia", () => ({ matches: false, addListener: () => {}, removeListener: () => {} }));
  });

  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    clerkProvider.mockClear();
  });

  it("hands Clerk the request's nonce and turns its telemetry off", async () => {
    await renderProviders("pk_test_x");
    expect(screen.getByText("Page")).toBeInTheDocument();
    expect(clerkProvider).toHaveBeenCalledWith(expect.objectContaining({ nonce: "abc123", telemetry: false }));
  });

  it("renders the page without Clerk when the build has no publishable key", async () => {
    await renderProviders("");
    expect(screen.getByText("Page")).toBeInTheDocument();
    expect(clerkProvider).not.toHaveBeenCalled();
  });
});
