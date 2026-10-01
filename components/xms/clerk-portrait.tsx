"use client";

import { useUser } from "@clerk/nextjs";
import Image from "next/image";
import { useState } from "react";

/**
 * The signed-in person's Clerk photo, inside the vendored avatar disc.
 * Initials stand in when Clerk has no photo, or the photo fails to load.
 * Mounted only while Clerk is the identity provider: `useUser` throws
 * without the provider.
 */
export function ClerkPortrait({ initials }: { initials: string }) {
  const { user } = useUser();
  const [failed, setFailed] = useState(false);
  const url = user?.hasImage ? user.imageUrl : null;
  if (!url || failed) return <span className="aix-avatar-disc">{initials}</span>;
  return (
    <span className="aix-avatar-disc overflow-hidden">
      <Image
        src={url}
        alt=""
        width={32}
        height={32}
        unoptimized
        className="size-full object-cover"
        onError={() => setFailed(true)}
      />
    </span>
  );
}
