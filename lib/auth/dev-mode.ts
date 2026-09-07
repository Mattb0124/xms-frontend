/**
 * Development sign-in switch. NEXT_PUBLIC_AUTH_DEV_MODE=true lets a developer
 * paste a locally minted token (see backend `pnpm dev:token`) while the XMS
 * Clerk application is being provisioned. It can never be on in a production
 * build: the module throws at load so the build itself fails.
 */
export const AUTH_DEV_MODE = process.env.NEXT_PUBLIC_AUTH_DEV_MODE === "true";
export const CLERK_ENABLED = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
export const DEV_TOKEN_STORAGE_KEY = "xms.devToken";

if (AUTH_DEV_MODE && process.env.NODE_ENV === "production") {
  throw new Error("NEXT_PUBLIC_AUTH_DEV_MODE cannot be enabled in a production build (xms-security-first).");
}
