"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Panel } from "@/components/xms/panel";
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
  // The address comes from this application's own route registry, keyed on
  // the item's stable key, not from the server's link: the API speaks the
  // platform's URL space, which is not this desk's. A key the registry does
  // not know falls back to the server's link, and that link is untrusted, so
  // it goes through safeHref; a row with no address at all reads as text.
  const href = waitingHref(item, permitted);
  const body = (
    <>
      <span className="text-xms-ink text-[13px]">{item.label}</span>
      <span className="xms-mono text-xms-ink ml-auto text-[13px] font-semibold">{item.count}</span>
    </>
  );
  const shared = "border-xms-line flex h-[36px] items-center gap-3 border-b px-4 last:border-b-0";
  return href ? (
    <Link href={href} className={`${shared} hover:bg-xms-row-hover hover:no-underline`} data-waiting={item.key}>
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
 * the server counted and the address this application's own route registry
 * gives for that item's key (lib/my-work/waiting-links). Nothing is counted
 * here; a count of zero is not waiting on anyone, so it is left out.
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

  return (
    <Panel
      title="Waiting on me"
      caption="My work"
      subtitle={data ? `Counted by the server as of ${data.as_of}.` : "What needs a decision or an entry from you."}
      flush
      className="overflow-hidden"
    >
      {isLoading && !data ? (
        <div className="p-4">
          <Skeleton lines={3} />
        </div>
      ) : isError ? (
        <p className="text-xms-muted px-4 py-3 text-[13px]">The waiting list could not be loaded.</p>
      ) : rows.length === 0 ? (
        <p className="text-xms-label px-4 py-3 text-[13px]" data-testid="waiting-empty">
          Nothing is waiting on you
        </p>
      ) : (
        <div data-testid="waiting-rail">
          {rows.map((item) => (
            <WaitingRow key={item.key} item={item} permitted={permitted} />
          ))}
        </div>
      )}
    </Panel>
  );
}
