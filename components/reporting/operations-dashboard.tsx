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
    render: (row) => <span className="text-xms-body">{row.name}</span>,
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
    // 16px between the bands, which is the prototype's own margin under the
    // synthesis line and under the tiles.
    <div className="flex flex-col gap-4" data-testid="operations-dashboard">
      <HeaderFilters>
        <PeriodSwitcher value={days} onChange={setDays} />
        {/* The window the measures were taken over, beside the control that
            set it. It stood on a line of its own above the synthesis, which
            render 10 does not draw and which pushed every band below it down
            by the height of that line. */}
        {data ? (
          <span className="text-xms-label text-[12px] whitespace-nowrap">
            {formatPeriod(data.period)}
            {isFetching ? " · refreshing" : ""}
          </span>
        ) : null}
      </HeaderFilters>

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
          {/* The synthesis line is written from the same snapshots the tiles
              read (render 10, note 1), so it takes the AI tint the whole
              product gives generated text, not the navy of the shell. Drawn
              in navy it read as a system banner, which is the one thing it is
              not: 18px by 20px, 15px on a 1.6 line, the prototype's own. */}
          <p className="xms-ai text-xms-body px-5 py-[18px] text-[15px] leading-[1.6]" data-testid="synthesis">
            {synthesisLine(data.measures, data.per_account.length)}
          </p>
          <TileStrip measures={data.measures} links={{ base: "/cases" }} />
          <div className="grid gap-[14px] lg:grid-cols-2">
            <SlaPanel measures={data.measures} />
            <OutcomesPanel measures={data.measures} />
            <BacklogPanel measures={data.measures} />
            <BreakdownPanel
              title="Open by priority"
              note="click to filter the queue"
              values={data.measures.open_by_priority}
              linkBase="/cases"
              param="priority"
            />
            <BreakdownPanel
              title="Open by type"
              note="click to filter the queue"
              values={data.measures.open_by_type}
              linkBase="/cases"
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
