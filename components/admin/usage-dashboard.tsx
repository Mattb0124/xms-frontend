"use client";

import { useState } from "react";
import { CountList } from "@/components/admin/security-dashboard";
import { PeriodSwitcher } from "@/components/reporting/period-switcher";
import { HeaderFilters } from "@/components/shell/content-header-bar";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { Panel } from "@/components/xms/panel";
import { ScoreTile } from "@/components/xms/score-tile";
import { Skeleton } from "@/components/xms/skeleton";
import { useUsageDashboardQuery, type UsageCount } from "@/redux/reportingApi";

function rows(list: UsageCount[] | undefined, limit = 15) {
  return (list ?? []).slice(0, limit).map((row) => ({ label: row.key, n: row.n }));
}

/**
 * Usage dashboard (Audit & Analytics 7.1, P2.19.4): active users by
 * principal kind, top actions, top screens, searches with no results and API
 * errors by route. Counts and registry names only; no named-user drill-down
 * without analytics:read-individual, which this cut does not offer.
 */
export function UsageDashboard() {
  const [days, setDays] = useState(7);
  const { data, isLoading, isError, refetch } = useUsageDashboardQuery({ days });
  const activeTotal = (data?.active_users ?? []).reduce((total, row) => total + row.n, 0);
  const errorTotal = (data?.api_errors ?? []).reduce((total, row) => total + row.n, 0);
  const noResultTotal = (data?.no_result_searches ?? []).reduce((total, row) => total + row.n, 0);

  return (
    <div className="flex flex-col gap-4" data-testid="usage-dashboard">
      <HeaderFilters>
        <PeriodSwitcher value={days} onChange={setDays} />
      </HeaderFilters>
      {isError ? (
        <EmptyBanner
          title="The usage dashboard could not be loaded"
          action={{ label: "Retry", onClick: () => void refetch() }}
        />
      ) : null}
      {isLoading && !data ? <Skeleton lines={8} /> : null}
      {data ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <ScoreTile label="Active users" value={activeTotal} />
            <ScoreTile
              label="Searches with no result"
              value={noResultTotal}
              tone={noResultTotal > 0 ? "warn" : "neutral"}
            />
            <ScoreTile label="API errors" value={errorTotal} tone={errorTotal > 0 ? "warn" : "good"} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Active users" caption="By principal kind">
              <CountList rows={rows(data.active_users)} empty="No activity in the period." />
            </Panel>
            <Panel title="Top actions" caption="action.completed by action">
              <CountList rows={rows(data.actions)} empty="No actions recorded in the period." />
            </Panel>
            <Panel title="Top screens" caption="screen.view by screen">
              <CountList rows={rows(data.screens)} empty="No screen views recorded in the period." />
            </Panel>
            <Panel title="Searches with no result" caption="Knowledge gaps by scope">
              <CountList rows={rows(data.no_result_searches)} empty="Every search found something." />
            </Panel>
            <Panel title="API errors" caption="By route" className="lg:col-span-2">
              <CountList rows={rows(data.api_errors, 30)} empty="No API errors in the period." />
            </Panel>
          </div>
        </>
      ) : null}
    </div>
  );
}
