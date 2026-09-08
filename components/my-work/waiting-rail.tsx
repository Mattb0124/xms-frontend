"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Skeleton } from "@/components/xms/skeleton";
import { waitingHref } from "@/lib/my-work/waiting-links";
import { visibleScreens, type Screen } from "@/lib/routes";
import { useMe } from "@/redux/me";
import { useWaitingOnMeQuery, type WaitingItem } from "@/redux/api";

/**
 * The statuses that mean "this API does not answer that yet": the route is
 * not deployed (404) or the deployment does not implement it (501). Either
 * way the rail is not a failure the person can act on, so My work carries on
 * without it rather than showing a broken card until the backend ships.
 */
const NOT_DEPLOYED = [404, 501];

export function isNotDeployed(error: unknown): boolean {
  const status = (error as { status?: unknown } | undefined)?.status;
  return typeof status === "number" && NOT_DEPLOYED.includes(status);
}

/** The rows worth showing: something is waiting only when the count is above zero. */
export function waitingRows(items: readonly WaitingItem[] | undefined): WaitingItem[] {
  return (items ?? []).filter((item) => item.count > 0);
}

function WaitingRow({ item, permitted }: { item: WaitingItem; permitted: readonly Screen[] }) {
  // The address is the API's own link where that link is a screen this desk
  // serves and this viewer may open, since two of them name an account no
  // key could ever express; otherwise the item's stable key resolves it
  // through the route registry (lib/my-work/waiting-links). Every link is
  // untrusted and goes through safeHref; a row with no address reads as text.
  const href = waitingHref(item, permitted);
  const body = (
    <>
      <span className="text-xms-body flex-1 text-[13px] leading-[1.4]">{item.label}</span>
      {/* The count is a chip on the right (render 08), not a bold figure. */}
      <span className="xms-mono bg-xms-chip text-xms-body rounded-[999px] px-[10px] py-[5px] text-[12px] leading-none font-medium">
        {item.count}
      </span>
    </>
  );
  const shared = "border-xms-chip flex items-center gap-[10px] border-t py-[11px]";
  return href ? (
    <Link href={href} className={`${shared} hover:text-xms-accent hover:no-underline`} data-waiting={item.key}>
      {body}
    </Link>
  ) : (
    <div className={shared} data-waiting={item.key}>
      {body}
    </div>
  );
}

/**
 * "Waiting on me" on My work (User Experience 3.1, frontend review finding
 * 13): one row per thing the signed-in person must act on, with the count
 * the server counted and the address the API named for it, checked against
 * this application's route registry and falling back to the item's key
 * (lib/my-work/waiting-links). Nothing is counted here; a count of zero is
 * not waiting on anyone, so it is left out.
 *
 * The route sits behind tickets:view, the permission every internal person
 * holds, and the counts are already scoped to the principal. Until the
 * backend deploys the route the rail hides itself rather than showing a
 * failure nobody can act on.
 */
export function WaitingRail() {
  const me = useMe();
  const allowed = me.hasPermission("tickets:view");
  const { data, isLoading, isError, error } = useWaitingOnMeQuery(undefined, {
    skip: !allowed,
    pollingInterval: 60_000,
  });
  const permitted = useMemo(() => visibleScreens(me.permissions), [me.permissions]);

  if (!allowed) return null;
  if (isError && isNotDeployed(error)) return null;

  const rows = waitingRows(data?.items);

  // Render 08 draws a plain title and the rows. The ALL-CAPS "MY WORK" eyebrow
  // over it named the screen the card was already on, and the "Counted by the
  // server as of" line explained a figure the reader had not asked about; both
  // are gone. The as-of instant is on the row's own screen, where a stale count
  // would matter.
  return (
    <section className="xms-card p-4" aria-label="Waiting on me">
      <h2 className="text-xms-ink mb-[6px] text-[14px] leading-[1.3] font-semibold">Waiting on me</h2>
      {isLoading && !data ? (
        <Skeleton lines={3} />
      ) : isError ? (
        <p className="text-xms-muted text-[13px]">The waiting list could not be loaded.</p>
      ) : rows.length === 0 ? (
        <p className="text-xms-muted text-[13px]" data-testid="waiting-empty">
          Nothing is waiting on you
        </p>
      ) : (
        <div data-testid="waiting-rail">
          {rows.map((item) => (
            <WaitingRow key={item.key} item={item} permitted={permitted} />
          ))}
        </div>
      )}
    </section>
  );
}
