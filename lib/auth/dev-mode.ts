/**
 * Where this build is going, and what that allows.
 *
 * Security review finding 27: the development sign-in, the /dev pages and the
 * pasted token in `localStorage` were keyed on `NODE_ENV` alone. `next build`
 * sets NODE_ENV to production for every deployed environment, so the guard
 * could not tell a shared dev or demo host from the real thing, and a build
 * made by hand with NODE_ENV unset turned on nothing at all. A bearer token
 * in browser storage is readable by any script on the origin, so it belongs
 * on a developer's own machine and nowhere else.
 *
 * `NEXT_PUBLIC_DEPLOY_TARGET` names the destination instead, and the
 * developer conveniences exist only when it is `local`. Unset in a
 * development build means a developer's own machine; unset in a production
 * build means production, so a pipeline that forgets the variable closes the
 * door rather than opening it.
 */
export const DEPLOY_TARGETS = ["local", "dev", "demo", "production"] as const;

export type DeployTarget = (typeof DEPLOY_TARGETS)[number];

export function readDeployTarget(raw: string | undefined, nodeEnv: string | undefined): DeployTarget {
  const value = (raw ?? "").trim();
  if ((DEPLOY_TARGETS as readonly string[]).includes(value)) return value as DeployTarget;
  return nodeEnv === "production" ? "production" : "local";
}

export const DEPLOY_TARGET = readDeployTarget(process.env.NEXT_PUBLIC_DEPLOY_TARGET, process.env.NODE_ENV);

/** A developer's own machine: the only target that may paste and store a token. */
export const IS_LOCAL_TARGET = DEPLOY_TARGET === "local";

export const CLERK_ENABLED = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
export const DEV_TOKEN_STORAGE_KEY = "xms.devToken";

const DEV_MODE_REQUESTED = process.env.NEXT_PUBLIC_AUTH_DEV_MODE === "true";

/**
 * Asking for the dev sign-in anywhere but `local` fails the build: the module
 * throws at load, so `next build` cannot produce an image that would keep a
 * bearer token in the browser of a shared environment.
 */
if (DEV_MODE_REQUESTED && !IS_LOCAL_TARGET) {
  throw new Error(
    `NEXT_PUBLIC_AUTH_DEV_MODE cannot be enabled for the ${DEPLOY_TARGET} deploy target; it is local only (xms-security-first).`,
  );
}

/**
 * Development sign-in switch. NEXT_PUBLIC_AUTH_DEV_MODE=true lets a developer
 * paste a locally minted token (see the backend's `pnpm dev:token`) while the
 * XMS Clerk application is being provisioned. True only on a local target, so
 * every reader of it is local-only by construction.
 */
export const AUTH_DEV_MODE = DEV_MODE_REQUESTED && IS_LOCAL_TARGET;
