"use client";

import { SignIn, useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Clerk's sign-in, rendered only when the publishable key is configured.
 * A session that already exists must not mount <SignIn>: Clerk sends that
 * component to /portal, and a refused /portal/me used to send the visitor
 * back here, which refreshed forever.
 */
export function ClerkSignIn() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace("/portal");
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded || isSignedIn) return null;
  return <SignIn routing="hash" forceRedirectUrl="/portal" />;
}
