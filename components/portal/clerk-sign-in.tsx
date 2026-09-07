"use client";

import { SignIn } from "@clerk/nextjs";

/** Clerk's sign-in, rendered only when the publishable key is configured (the provider is mounted then). */
export function ClerkSignIn() {
  return <SignIn routing="hash" forceRedirectUrl="/portal" />;
}
