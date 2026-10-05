"use client";

import { SignIn, useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Clerk's sign-in, rendered only when the publishable key is configured.
 * A session that already exists must not mount <SignIn>: Clerk would send
 * the visitor on, and a refused session that came back here refreshed forever.
 * The desk and the portal each name where a finished sign-in lands.
 */
export function ClerkSignIn({ redirectUrl = "/portal" }: { redirectUrl?: string }) {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace(redirectUrl);
  }, [isLoaded, isSignedIn, redirectUrl, router]);

  if (!isLoaded || isSignedIn) return null;
  return <SignIn routing="hash" forceRedirectUrl={redirectUrl} />;
}
