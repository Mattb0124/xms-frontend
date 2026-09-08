"use client";

import Link from "next/link";
import { useState } from "react";
import { CountList } from "@/components/admin/security-dashboard";
import { formatHours } from "@/components/reporting/format";
import { PeriodSwitcher } from "@/components/reporting/period-switcher";
import { HeaderFilters } from "@/components/shell/content-header-bar";
import { AccountDot } from "@/components/xms/account-dot";
import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { Panel } from "@/components/xms/panel";
import { ScoreTile } from "@/components/xms/score-tile";
import { Skeleton } from "@/components/xms/skeleton";
import { useUsageDashboardQuery, type UsageAccountRow, type UsageCount } from "@/redux/reportingApi";

function rows(list: UsageCount[] | undefined, limit = 15) {
  return (list ?? []).slice(0, limit).map((row) => ({ label: row.key, n: row.n }));
}

/**
 * The per-account strip: the same window read one account at a time. Every
 * figure is the server's, counted from the table that records it, and the
 * account name opens that account's dashboard so the row is a link a person
 * can send. The minutes are printed as hours because that is how time is
 * read everywhere else on the desk, and the label carries the unit.
 */
const ACCOUNT_COLUMNS: DenseColumn<UsageAccountRow>[] = [
  {
    key: "name",
    title: "Account",
    sortValue: (row) => row.name,
    render: (row) => (
      <Link href={`/accounts/${row.account_id}`} className="text-xms-accent font-medium" data-account={row.account_id}>
        <AccountDot name={row.name} />
      </Link>
    ),
  },
  { key: "key", title: "Key", mono: true, sortValue: (row) => row.key },
  {
    key: "tickets_created",
    title: "Tickets created",
    align: "right",
    mono: true,
    sortValue: (row) => row.tickets_created,
  },
  {
    key: "tickets_closed",
    title: "Tickets closed",
    align: "right",
    mono: true,
    sortValue: (row) => row.tickets_closed,
  },
  {
    key: "minutes_logged",
    title: "Time logged",
    align: "right",
    mono: true,
    sortValue: (row) => row.minutes_logged,
    render: (row) => formatHours(row.minutes_logged),
  },
  {
    key: "portal_signins",
    title: "Portal sign-ins",
    align: "right",
    mono: true,
    sortValue: (row) => row.portal_signins,
  },
  { key: "api_calls", title: "API client calls", align: "right", mono: true, sortValue: (row) => row.api_calls },
  { key: "active_users", title: "Active users", align: "right", mono: true, sortValue: (row) => row.active_users },
];

/**
 * Usage dashboard (Audit & Analytics 7.1, P2.19.4, XA-03): active users by
 * principal kind, top actions, top screens, searches with no results, API
 * errors by route, and the per-account strip of the same window, busiest
 * account first. Counts and registry names only; no named-user drill-down
 * without analytics:read-individual, which this cut does not offer.
 *
 * The strip is drawn only where the API answers it, so an older API leaves
 * the table out rather than showing an empty one that would read as "no
 * account did anything".
 */
export function UsageDashboard() {
  const [days, setDays] = useState(7);
  const { data, isLoading, isError, refetch, isFetching } = useUsageDashboardQuery({ days });
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
          {data.per_account ? (
            <DenseTable<UsageAccountRow>
              title="Accounts"
              count={data.per_account.length}
              columns={ACCOUNT_COLUMNS}
              rows={data.per_account}
              rowKey={(row) => row.account_id}
              defaultSort={{ key: "tickets_created", direction: "desc" }}
              loading={isFetching}
              emptyState="No granted accounts. Ask an administrator for account access."
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
