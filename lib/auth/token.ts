import { AUTH_DEV_MODE, CLERK_ENABLED, DEV_TOKEN_STORAGE_KEY, IS_LOCAL_TARGET } from "@/lib/auth/dev-mode";

/**
 * A bearer in browser storage is readable by any script on the origin, so it
 * is kept on a developer's own machine and nowhere else (security review
 * finding 27). AUTH_DEV_MODE already implies the local target; the second
 * clause says so where the storage is touched rather than three files away.
 */
const DEV_TOKEN_STORAGE_ALLOWED = AUTH_DEV_MODE && IS_LOCAL_TARGET;

/**
 * Where the bearer for the XMS API comes from. RTK Query's prepareHeaders
 * runs outside React, so the provider is registered once by the Providers
 * tree and read here. The browser never decides authorization; it only
 * carries the token the API will verify.
 */
export interface TokenProvider {
  readonly kind: "clerk" | "dev" | "none";
  getToken(): Promise<string | null>;
}

export const noTokenProvider: TokenProvider = {
  kind: "none",
  getToken: async () => null,
};

/** Reads the pasted token from localStorage; only on the local deploy target in dev mode. */
export const devTokenProvider: TokenProvider = {
  kind: "dev",
  async getToken() {
    if (!DEV_TOKEN_STORAGE_ALLOWED || typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(DEV_TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  },
};

export function setDevToken(token: string | null): void {
  if (!DEV_TOKEN_STORAGE_ALLOWED || typeof window === "undefined") return;
  if (token) window.localStorage.setItem(DEV_TOKEN_STORAGE_KEY, token);
  else window.localStorage.removeItem(DEV_TOKEN_STORAGE_KEY);
}

/** Wraps Clerk's getToken (from useAuth) once the ClerkProvider is mounted. */
export function clerkTokenProvider(getToken: () => Promise<string | null>): TokenProvider {
  return { kind: "clerk", getToken };
}

let current: TokenProvider = CLERK_ENABLED ? noTokenProvider : AUTH_DEV_MODE ? devTokenProvider : noTokenProvider;

export function setTokenProvider(provider: TokenProvider): void {
  current = provider;
}

export function getTokenProvider(): TokenProvider {
  return current;
}

export async function getBearerToken(): Promise<string | null> {
  return current.getToken();
}
