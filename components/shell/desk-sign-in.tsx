"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClerkSignIn } from "@/components/portal/clerk-sign-in";
import { DeskFrame } from "@/components/shell/desk-frame";
import { INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { AUTH_DEV_MODE, CLERK_ENABLED } from "@/lib/auth/dev-mode";
import { setDevToken } from "@/lib/auth/token";
import { xmsApi } from "@/redux/api";
import { useAppDispatch } from "@/redux/hooks";

/**
 * Desk sign-in. Clerk when the publishable key is set; a pasted token only
 * on a developer's machine. A session that already exists is sent home by
 * ClerkSignIn, which does not mount the form again.
 */
export function DeskSignIn() {
  return (
    <DeskFrame>
      <h1 className="text-xms-ink text-title font-semibold">Sign in</h1>
      <p className="text-xms-label text-body">Use your Hackett account to open the desk.</p>
      {CLERK_ENABLED ? <ClerkSignIn redirectUrl="/" /> : null}
      {AUTH_DEV_MODE && !CLERK_ENABLED ? <DevTokenForm /> : null}
      {!CLERK_ENABLED && !AUTH_DEV_MODE ? (
        <p className="text-xms-label max-w-[420px] text-center text-body">
          Sign-in is not configured for this environment. Ask an administrator.
        </p>
      ) : null}
    </DeskFrame>
  );
}

function DevTokenForm() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [token, setToken] = useState("");

  return (
    <form
      className="flex w-full max-w-[420px] flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        setDevToken(token.trim() || null);
        dispatch(xmsApi.util.resetApiState());
        router.replace("/");
      }}
    >
      <label htmlFor="desk-dev-token" className="text-xms-body text-body">
        Paste a token from <code className="xms-mono">pnpm dev:token</code> run in the backend folder.
      </label>
      <textarea
        id="desk-dev-token"
        rows={4}
        value={token}
        onChange={(event) => setToken(event.target.value)}
        className={`${INPUT} h-auto max-w-none py-2`}
      />
      <div className="flex gap-2">
        <button type="submit" className={PRIMARY_BUTTON}>
          Use token
        </button>
        <button
          type="button"
          className={SECONDARY_BUTTON}
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
  );
}
