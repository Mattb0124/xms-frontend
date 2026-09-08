"use client";

import Link from "next/link";
import { PortalCard } from "@/components/portal/primitives";
import { formatHours, formatPercent } from "@/components/reporting/format";
import { usePortalMeQuery, usePortalTicketsQuery } from "@/redux/portalApi";
import { usePortalDashboardQuery } from "@/redux/reportingApi";

/**
 * The client's own numbers on the portal home (Dashboards functional 5.5,
 * DR-03) in client language: open, raised, resolved, response and
 * resolution targets met. Consumption renders only when the API sent it,
 * which follows the account's "consumption visible" setting.
 *
 * Open requests deliberately comes from the same query "My requests" runs,
 * not from the dashboard measure, so the home cannot say "Open requests 63"
 * while the list on the next click shows none (frontend review finding 2).
 * The query key matches that screen's opening state exactly, so the two
 * share one cache entry and one API call.
 */
export function DashboardStrip({ days = 30 }: { days?: number }) {
  const { data, isLoading } = usePortalDashboardQuery({ days });
  const me = usePortalMeQuery();
  const canSeeOrg = me.data?.principal.permissions.includes("portal:view-org-tickets") ?? false;
  const open = usePortalTicketsQuery({ scope: canSeeOrg ? "mine" : "open" }, { skip: !me.data });
  const measures = data?.measures;
  const tiles: Array<{ label: string; value: string }> = [];
  const openItems = open.data?.items;
  if (openItems && !open.isError) {
    tiles.push({
      label: "Open requests",
      value: String(openItems.filter((item) => !["closed", "cancelled"].includes(item.state)).length),
    });
  }
  if (measures) {
    if (typeof measures.volume_created === "number")
      tiles.push({ label: "Raised", value: String(measures.volume_created) });
    if (typeof measures.volume_resolved === "number")
      tiles.push({ label: "Resolved", value: String(measures.volume_resolved) });
    if (measures.sla_response_attainment)
      tiles.push({ label: "Response target met", value: formatPercent(measures.sla_response_attainment) });
    if (measures.sla_resolution_attainment)
      tiles.push({ label: "Resolution target met", value: formatPercent(measures.sla_resolution_attainment) });
    if (typeof measures.consumption_minutes === "number")
      tiles.push({ label: "Hours used", value: formatHours(measures.consumption_minutes) });
  }

  return (
    <PortalCard
      title={`Your last ${days} days`}
      actions={
        <Link
          href="/portal/requests"
          className="text-xms-accent text-[14px] font-medium underline-offset-2 hover:underline"
        >
          See my requests
        </Link>
      }
    >
      {isLoading && !data ? (
        <p className="text-xms-label text-[14px]">Loading your numbers</p>
      ) : tiles.length === 0 ? (
        <p className="text-xms-label text-[14px]" role="status">
          Nothing to show yet. Your numbers appear once you have raised a request.
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-3" data-testid="portal-dashboard">
            {tiles.map((tile) => (
              <div key={tile.label}>
                <dt className="text-xms-label text-[13px]">{tile.label}</dt>
                <dd className="text-xms-ink text-[24px] font-semibold" aria-label={tile.label}>
                  {tile.value}
                </dd>
              </div>
            ))}
          </dl>
          {open.data?.unavailable ? (
            <p role="status" className="text-xms-label mt-3 text-[13px]">
              {open.data.unavailable === 1
                ? "1 more request could not be loaded and is not counted."
                : `${open.data.unavailable} more requests could not be loaded and are not counted.`}
            </p>
          ) : null}
        </>
      )}
    </PortalCard>
  );
}
