"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { SignInStage } from "@/components/shell/sign-in-stage";
import { Shell } from "@/components/shell/shell";
import { CLERK_ENABLED } from "@/lib/auth/dev-mode";
import { xmsApi, useMeQuery } from "@/redux/api";
import { useAppDispatch } from "@/redux/hooks";

/**
 * The desk asks nothing until Clerk has a session. An anonymous visitor goes
 * to /sign-in, which lives outside this layout so the form is not wrapped in
 * the shell it is trying to reach. A session the API refuses stays on a
 * sign-out screen: sending it back to the form would mount Clerk's sign-in
 * and bounce home again.
 */
export function DeskSession({ children }: { children: ReactNode }) {
  if (!CLERK_ENABLED) return <Shell>{children}</Shell>;
  return <ClerkDesk>{children}</ClerkDesk>;
}

function ClerkDesk({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace("/sign-in");
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded || !isSignedIn) {
    return (
      <SignInStage>
        <p className="xms-sign-in-lead" role="status">
          Checking your sign-in
        </p>
      </SignInStage>
    );
  }
  return <SignedInDesk>{children}</SignedInDesk>;
}

function SignedInDesk({ children }: { children: ReactNode }) {
  const me = useMeQuery();
  const status = me.error && typeof me.error === "object" && "status" in me.error ? me.error.status : undefined;
  if (me.isLoading) {
    return (
      <SignInStage>
        <p className="xms-sign-in-lead" role="status">
          Checking your sign-in
        </p>
      </SignInStage>
    );
  }
  if (status === 401 || status === 403) return <DeskRefused />;
  return <Shell>{children}</Shell>;
}

function DeskRefused() {
  const clerk = useClerk();
  const dispatch = useAppDispatch();
  return (
    <SignInStage>
      <h1 className="xms-sign-in-title">Sign-in refused</h1>
      <p className="xms-sign-in-lead">This sign-in is not an XMS account. Ask an administrator to invite you.</p>
      <button
        type="button"
        className="xms-sign-in-submit"
        onClick={() => {
          dispatch(xmsApi.util.resetApiState());
          void clerk.signOut({ redirectUrl: "/sign-in" });
        }}
      >
        Sign out
      </button>
    </SignInStage>
  );
}
