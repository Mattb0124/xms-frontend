"use client";

import Link from "next/link";
import { useState } from "react";
import { PORTAL_PRIMARY, PORTAL_SECONDARY, PortalCard, PortalNotice } from "@/components/portal/primitives";
import { RequestList } from "@/components/portal/request-list";
import { Skeleton } from "@/components/xms/skeleton";
import { cn } from "@/lib/utils";
import { usePortalMeQuery, usePortalTicketsQuery } from "@/redux/portalApi";

/** My requests: scope switcher Open / All, org-wide toggle only with portal:view-org-tickets. */
export default function PortalRequestsPage() {
  const [scope, setScope] = useState<"open" | "all">("open");
  const [orgWide, setOrgWide] = useState(false);
  const me = usePortalMeQuery();
  const canSeeOrg = me.data?.principal.permissions.includes("portal:view-org-tickets") ?? false;
  const list = usePortalTicketsQuery({ scope: canSeeOrg && !orgWide ? "mine" : scope });
  const items = (list.data?.items ?? []).filter(
    (item) => scope === "all" || !["closed", "cancelled"].includes(item.state),
  );

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-xms-ink text-[22px] font-semibold">My requests</h1>
        <div role="group" aria-label="Scope" className="ml-auto flex gap-1">
          {(["open", "all"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={scope === value}
              onClick={() => setScope(value)}
              className={cn(
                PORTAL_SECONDARY,
                "h-[34px]",
                scope === value && "bg-xms-tint border-xms-accent text-xms-ink",
              )}
            >
              {value === "open" ? "Open" : "All"}
            </button>
          ))}
        </div>
        {canSeeOrg ? (
          <label className="text-xms-body flex items-center gap-2 text-[14px]">
            <input type="checkbox" checked={orgWide} onChange={(event) => setOrgWide(event.target.checked)} />
            Everyone at {me.data?.account?.name ?? "my organization"}
          </label>
        ) : null}
        <Link href="/portal/requests/new" className={PORTAL_PRIMARY}>
          New request
        </Link>
      </header>
      <PortalCard>
        {list.isLoading ? (
          <Skeleton lines={5} />
        ) : list.isError ? (
          // A failed list is not an empty list. Telling a client who has
          // requests that they have none is the worst answer available
          // (frontend review finding 2), so the refusal is worded and offered
          // again rather than dressed up as an empty state.
          <div className="flex flex-col items-start gap-3">
            <PortalNotice tone="error">
              We could not load your requests just now. Nothing has been lost; please try again.
            </PortalNotice>
            <button type="button" className={PORTAL_SECONDARY} onClick={() => void list.refetch()}>
              Try again
            </button>
          </div>
        ) : (
          <>
            <RequestList
              items={items}
              emptyText={
                scope === "open"
                  ? "No open requests. Search for a solution or make a request."
                  : "You have not made any requests yet."
              }
            />
            <UnavailableNote count={list.data?.unavailable ?? 0} />
          </>
        )}
      </PortalCard>
    </div>
  );
}

/** Words the rows the API could not build, so the list and any count agree with each other. */
function UnavailableNote({ count }: { count: number }) {
  if (count < 1) return null;
  return (
    <p role="status" className="text-xms-label mt-3 text-[13px]">
      {count === 1
        ? "1 request could not be loaded and is not shown. Your support team can see it; ask them, or try again later."
        : `${count} requests could not be loaded and are not shown. Your support team can see them; ask them, or try again later.`}
    </p>
  );
}
