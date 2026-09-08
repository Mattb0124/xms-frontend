"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatPeriod } from "@/components/reporting/format";
import {
  BacklogPanel,
  BreakdownPanel,
  ConsumptionPanel,
  NotablePanel,
  OutcomesPanel,
  SlaPanel,
  synthesisLine,
  TileStrip,
} from "@/components/reporting/measure-panels";
import { PeriodSwitcher } from "@/components/reporting/period-switcher";
import { HeaderFilters } from "@/components/shell/content-header-bar";
import { AccountDot } from "@/components/xms/account-dot";
import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { Skeleton } from "@/components/xms/skeleton";
import { ticketTypeLabel } from "@/lib/tickets/vocab";
import { useOperationsDashboardQuery, type AccountStrip } from "@/redux/reportingApi";

const COLUMNS: DenseColumn<AccountStrip>[] = [
  {
    key: "name",
    title: "Account",
    sortValue: (row) => row.name,
    render: (row) => <AccountDot name={row.name} />,
  },
  { key: "key", title: "Key", mono: true, sortValue: (row) => row.key },
  { key: "open", title: "Open", align: "right", mono: true, sortValue: (row) => row.measures.open_tickets },
  {
    key: "breached",
    title: "Breached",
    align: "right",
    mono: true,
    sortValue: (row) => row.measures.breached_now,
    render: (row) => (
      <span
        className={row.measures.breached_now > 0 ? "text-[color:var(--state-overdue-text)] font-semibold" : undefined}
      >
        {row.measures.breached_now}
      </span>
    ),
  },
  { key: "at_risk", title: "At risk", align: "right", mono: true, sortValue: (row) => row.measures.at_risk_now },
  {
    key: "unassigned",
    title: "Unassigned",
    align: "right",
    mono: true,
    sortValue: (row) => row.measures.unassigned_now,
  },
  { key: "created", title: "Created", align: "right", mono: true, sortValue: (row) => row.measures.volume_created },
  { key: "resolved", title: "Resolved", align: "right", mono: true, sortValue: (row) => row.measures.volume_resolved },
];

/**
 * The Operations dashboard (Dashboards functional 5.3, Operations wireframe):
 * a synthesis line written from the measures, the six tiles, SLA meters,
 * outcomes, backlog by age, notable tickets and the per-account strip. Every
 * tile links into the Queue; every account row opens its dashboard.
 */
export function OperationsDashboard({ initialDays = 7 }: { initialDays?: number }) {
  const router = useRouter();
  const [days, setDays] = useState(initialDays);
  const { data, isLoading, isError, refetch, isFetching } = useOperationsDashboardQuery(
    { days },
    { pollingInterval: 60_000 },
  );

  return (
    <div className="flex flex-col gap-4" data-testid="operations-dashboard">
      <HeaderFilters>
        <PeriodSwitcher value={days} onChange={setDays} />
      </HeaderFilters>
      <div className="flex items-center gap-3">
        <PeriodSwitcher value={days} onChange={setDays} className="md:hidden" />
        {data ? (
          <span className="text-xms-label ml-auto text-[12px]">
            {formatPeriod(data.period)}
            {isFetching ? " · refreshing" : ""}
          </span>
        ) : null}
      </div>

      {isError ? (
        <EmptyBanner
          title="The dashboard could not be loaded"
          detail="The last numbers stay visible while the API is unreachable."
          action={{ label: "Retry", onClick: () => void refetch() }}
        />
      ) : null}

      {isLoading && !data ? <Skeleton lines={10} /> : null}

      {data ? (
        <>
          <p className="bg-xms-navy rounded-[6px] px-5 py-4 text-[14px] text-white" data-testid="synthesis">
            {synthesisLine(data.measures, data.per_account.length)}
          </p>
          <TileStrip measures={data.measures} links={{ base: "/tickets" }} />
          <div className="grid gap-4 lg:grid-cols-2">
            <SlaPanel measures={data.measures} />
            <OutcomesPanel measures={data.measures} />
            <BacklogPanel measures={data.measures} />
            <BreakdownPanel
              title="Open by priority"
              values={data.measures.open_by_priority}
              linkBase="/tickets"
              param="priority"
            />
            <BreakdownPanel
              title="Open by type"
              values={data.measures.open_by_type}
              linkBase="/tickets"
              param="type"
              labelOf={ticketTypeLabel}
            />
            <ConsumptionPanel measures={data.measures} />
          </div>
          <NotablePanel notable={data.notable} />
          <DenseTable<AccountStrip>
            title="Accounts"
            columns={COLUMNS}
            rows={data.per_account}
            rowKey={(row) => row.account_id}
            onRowClick={(row) => router.push(`/accounts/${row.account_id}`)}
            emptyState="No granted accounts. Ask an administrator for account access."
          />
        </>
      ) : null}
    </div>
  );
}
