"use client";

import { useClerk } from "@clerk/nextjs";
import { PORTAL_SECONDARY } from "@/components/portal/primitives";

/** Ends the Clerk session too; rendered only when Clerk is the identity provider. */
export function ClerkSignOut({ onDone }: { onDone: () => void }) {
  const clerk = useClerk();
  return (
    <button
      type="button"
      role="menuitem"
      className={`${PORTAL_SECONDARY} mt-1 w-full`}
      onClick={() => {
        void clerk.signOut().finally(onDone);
      }}
    >
      Sign out everywhere
    </button>
  );
}
