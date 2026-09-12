"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Panel } from "@/components/xms/panel";
import { Skeleton } from "@/components/xms/skeleton";
import { AUTH_DEV_MODE, CLERK_ENABLED, DEPLOY_TARGET, IS_LOCAL_TARGET } from "@/lib/auth/dev-mode";
import { setDevToken } from "@/lib/auth/token";
import { xmsApi } from "@/redux/api";
import { useAppDispatch } from "@/redux/hooks";

/**
 * Development sign-in: pick one of the seeded users and be signed in as them.
 *
 * It used to mean running `pnpm dev:token` in the backend folder, copying a
 * JWT and pasting it here, and every database reset invalidated all of them.
 * Checking how a screen reads for a Dispatcher and then for a portal
 * Requester was two trips to a terminal.
 *
 * The API mints the token (the browser has no signing secret and must not),
 * and derives the portal `org_slug` itself, since a portal token is refused
 * unless its org names that user's own account. The endpoint answers 404
 * without AUTH_DEV_SECRET, which the environment contract refuses to let a
 * production process hold at all.
 *
 * Rendered only when NEXT_PUBLIC_AUTH_DEV_MODE=true on the local deploy
 * target; the module defining that flag fails the build anywhere else
 * (security review finding 27).
 */
interface DevUser {
  email: string;
  display_name: string;
  kind: "internal" | "portal";
  account_key: string | null;
  account_name: string | null;
  roles: string[];
}

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export default function DevSignInPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [token, setToken] = useState("");
  const [users, setUsers] = useState<DevUser[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState<string | null>(null);

  useEffect(() => {
    if (!AUTH_DEV_MODE) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`${API}/v1/dev/users`);
        if (!response.ok) throw new Error(`the API answered ${response.status}`);
        const body = (await response.json()) as DevUser[];
        if (!cancelled) setUsers(body);
      } catch (caught) {
        // The paste box below still works, so this is a note rather than a
        // failure: the API may simply be starting, or seeded with nobody.
        if (!cancelled) setLoadError((caught as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!AUTH_DEV_MODE) {
    return (
      <Panel title="Development sign-in" caption="Not available">
        <p className="text-xms-body text-[14px]">
          {CLERK_ENABLED
            ? "Sign in through Clerk."
            : !IS_LOCAL_TARGET
              ? `The pasted token is local only, and this build names the ${DEPLOY_TARGET} deploy target.`
              : "Set NEXT_PUBLIC_AUTH_DEV_MODE=true in .env.local to use a pasted token."}
        </p>
      </Panel>
    );
  }

  const useToken = (value: string) => {
    setDevToken(value);
    dispatch(xmsApi.util.resetApiState());
    router.push("/");
  };

  const signInAs = async (user: DevUser) => {
    setSigningIn(user.email);
    setLoadError(null);
    try {
      const response = await fetch(`${API}/v1/dev/sign-in`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      });
      if (!response.ok) throw new Error(`the API answered ${response.status}`);
      const body = (await response.json()) as { token: string };
      useToken(body.token);
    } catch (caught) {
      setLoadError((caught as Error).message);
      setSigningIn(null);
    }
  };

  const internal = (users ?? []).filter((user) => user.kind === "internal");
  const portal = (users ?? []).filter((user) => user.kind === "portal");

  const row = (user: DevUser) => (
    <button
      key={user.email}
      type="button"
      disabled={signingIn !== null}
      onClick={() => void signInAs(user)}
      className="border-xms-line hover:bg-xms-hover flex w-full items-center justify-between gap-3 rounded-[4px] border px-3 py-2 text-left text-[14px] disabled:opacity-50"
    >
      <span className="flex flex-col">
        <span className="text-xms-ink font-medium">
          {user.display_name}
          {user.account_key ? <span className="text-xms-label"> · {user.account_name}</span> : null}
        </span>
        <span className="text-xms-label xms-mono text-[12px]">{user.email}</span>
      </span>
      <span className="text-xms-label text-[12px]">
        {signingIn === user.email ? "Signing in" : user.roles.join(", ") || "No role"}
      </span>
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Sign in as" subtitle="One of the users the seed created. No password, local only." caption="Development">
        {users === null && loadError === null ? <Skeleton lines={6} /> : null}
        {users !== null ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-2">
              <span className="text-xms-label text-[12px] uppercase">Internal desk</span>
              {internal.map(row)}
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xms-label text-[12px] uppercase">Client portal</span>
              {portal.map(row)}
            </div>
          </div>
        ) : null}
        {loadError ? (
          <p role="alert" className="text-[14px] text-[color:var(--state-overdue-text)]">
            Could not reach the sign-in list ({loadError}). Check the API is running and seeded, or paste a token below.
          </p>
        ) : null}
      </Panel>

      <Panel
        title="Or paste a token"
        subtitle="For a user the seed does not create, or a token with particular claims."
        caption="Development"
      >
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = token.trim();
            if (trimmed) useToken(trimmed);
          }}
        >
          <label htmlFor="dev-token" className="text-xms-label text-[14px]">
            Bearer token from <code className="xms-mono">pnpm dev:token --email admin@example.test</code> run in the
            backend folder
          </label>
          <textarea
            id="dev-token"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            rows={4}
            className="border-xms-line bg-xms-card text-xms-ink xms-mono rounded-[4px] border p-2 text-[14px]"
            placeholder="eyJhbGciOi..."
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-xms-accent hover:bg-xms-accent-hover h-[32px] rounded-[4px] px-3 text-[14px] font-medium text-white"
            >
              Use token
            </button>
            <button
              type="button"
              onClick={() => {
                setDevToken(null);
                dispatch(xmsApi.util.resetApiState());
                setToken("");
              }}
              className="border-xms-line text-xms-body h-[32px] rounded-[4px] border px-3 text-[14px]"
            >
              Sign out
            </button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
