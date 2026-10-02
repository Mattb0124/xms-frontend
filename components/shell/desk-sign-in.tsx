"use client";

import { useAuth, useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PasswordSignIn } from "@/components/shell/password-sign-in";
import { SignInStage } from "@/components/shell/sign-in-stage";
import type { DeskSignInClient } from "@/components/shell/desk-sign-in-client";
import { AUTH_DEV_MODE, CLERK_ENABLED } from "@/lib/auth/dev-mode";
import { setDevToken } from "@/lib/auth/token";
import { xmsApi } from "@/redux/api";
import { useAppDispatch } from "@/redux/hooks";

/**
 * Desk sign-in, the same card the AI Innovation Platforms web UI uses.
 * Clerk's own widget is not mounted: a session that already exists reloads
 * home, and a refused session never comes back here to mount it again.
 */
export function DeskSignIn() {
  return (
    <SignInStage>
      {CLERK_ENABLED ? <ClerkPasswordGate /> : null}
      {AUTH_DEV_MODE && !CLERK_ENABLED ? <DevTokenForm /> : null}
      {!CLERK_ENABLED && !AUTH_DEV_MODE ? (
        <p className="xms-sign-in-lead">Sign-in is not configured for this environment. Ask an administrator.</p>
      ) : null}
    </SignInStage>
  );
}

function isDeskClient(signIn: object): signIn is DeskSignInClient {
  return (
    "password" in signIn &&
    "finalize" in signIn &&
    "create" in signIn &&
    "resetPasswordEmailCode" in signIn &&
    "status" in signIn
  );
}

function ClerkPasswordGate() {
  const { isLoaded, isSignedIn } = useAuth();
  const { signIn } = useSignIn();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace("/");
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded || isSignedIn || !signIn || !isDeskClient(signIn)) {
    return (
      <p className="xms-sign-in-lead" role="status">
        Checking your sign-in
      </p>
    );
  }
  return <PasswordSignIn signIn={signIn} />;
}

function DevTokenForm() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [token, setToken] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setDevToken(token.trim() || null);
        dispatch(xmsApi.util.resetApiState());
        router.replace("/");
      }}
    >
      <h1 className="xms-sign-in-title">Sign in</h1>
      <p className="xms-sign-in-lead">to continue to X Managed Services</p>
      <label className="xms-sign-in-label" htmlFor="desk-dev-token">
        Paste a token from <code>pnpm dev:token</code> run in the backend folder.
      </label>
      <textarea
        id="desk-dev-token"
        rows={4}
        value={token}
        onChange={(event) => setToken(event.target.value)}
        className="xms-sign-in-area"
      />
      <button type="submit" className="xms-sign-in-submit">
        Use token
      </button>
    </form>
  );
}
