"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClerkSignIn } from "@/components/portal/clerk-sign-in";
import {
  PORTAL_INPUT,
  PORTAL_PRIMARY,
  PORTAL_SECONDARY,
  PortalCard,
  PortalNotice,
} from "@/components/portal/primitives";
import { AUTH_DEV_MODE, CLERK_ENABLED } from "@/lib/auth/dev-mode";
import { setDevToken } from "@/lib/auth/token";
import { xmsApi } from "@/redux/api";
import { useAppDispatch } from "@/redux/hooks";

/**
 * Portal sign-in (User Experience 4.1). With Clerk configured the account's
 * connection decides the route; in development a token minted by the
 * backend's `pnpm dev:token --email <portal user> --org acct-<key>` is pasted.
 */
export default function PortalSignInPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [token, setToken] = useState("");

  return (
    <div className="flex w-full flex-col gap-4">
      <h1 className="text-xms-ink text-[22px] font-semibold">Sign in</h1>
      {CLERK_ENABLED ? <ClerkSignIn /> : null}
      {AUTH_DEV_MODE ? (
        <PortalCard title="Development sign-in">
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              setDevToken(token.trim() || null);
              dispatch(xmsApi.util.resetApiState());
              router.replace("/portal");
            }}
          >
            <label htmlFor="portal-dev-token" className="text-xms-body text-[13px]">
              Paste a token from <code className="xms-mono">pnpm dev:token --email pat@client.test --org acct-brk</code>{" "}
              run in the backend folder.
            </label>
            <textarea
              id="portal-dev-token"
              rows={4}
              value={token}
              onChange={(event) => setToken(event.target.value)}
              className={`${PORTAL_INPUT} h-auto py-2`}
            />
            <div className="flex gap-2">
              <button type="submit" className={PORTAL_PRIMARY}>
                Use token
              </button>
              <button
                type="button"
                className={PORTAL_SECONDARY}
                onClick={() => {
                  setDevToken(null);
                  dispatch(xmsApi.util.resetApiState());
                  setToken("");
                }}
              >
                Clear
              </button>
            </div>
          </form>
        </PortalCard>
      ) : null}
      {!CLERK_ENABLED && !AUTH_DEV_MODE ? (
        <PortalNotice>
          Your organization&apos;s portal is not active. Ask your XMS administrator to invite you.
        </PortalNotice>
      ) : null}
    </div>
  );
}
