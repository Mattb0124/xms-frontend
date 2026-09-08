"use client";

import Link from "next/link";
import { useState } from "react";
import { SECONDARY_BUTTON } from "@/components/admin/primitives";
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
import { ReportsCard } from "@/components/reporting/reports-card";
import { HeaderAction, HeaderFilters } from "@/components/shell/content-header-bar";
import { CompTimePanel } from "@/components/time/comp-time-panel";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { Skeleton } from "@/components/xms/skeleton";
import { ticketTypeLabel } from "@/lib/tickets/vocab";
import { cn } from "@/lib/utils";
import { useMe } from "@/redux/me";
import { useAccountDashboardQuery } from "@/redux/reportingApi";
import { useListGrantedAccountsQuery } from "@/redux/ticketsApi";

/**
 * One account's dashboard (User Experience 3.11, DR-03): the same panels as
 * Operations for one scope, plus "View as client", which re-fetches with
 * as_client=true and renders only what the API returned, so the internal
 * user sees exactly the portal's picture. The Reports card sits below.
 */
export function AccountDashboard({ accountId, initialDays = 7 }: { accountId: string; initialDays?: number }) {
  const me = useMe();
  const [days, setDays] = useState(initialDays);
  const [asClient, setAsClient] = useState(false);
  const accounts = useListGrantedAccountsQuery();
  const account = accounts.data?.find((row) => row.id === accountId);
  const { data, isLoading, isError, refetch } = useAccountDashboardQuery({ id: accountId, days, asClient });
  const queueBase = `/tickets?account_id=${encodeURIComponent(accountId)}`;

  return (
    <div className="flex flex-col gap-4" data-testid="account-dashboard" data-as-client={asClient ? "true" : "false"}>
      <HeaderFilters>
        <PeriodSwitcher value={days} onChange={setDays} />
      </HeaderFilters>
      <HeaderAction>
        <button
          type="button"
          role="switch"
          aria-checked={asClient}
          onClick={() => setAsClient((value) => !value)}
          className={cn(SECONDARY_BUTTON, asClient && "border-xms-accent text-xms-accent")}
        >
          View as client
        </button>
      </HeaderAction>

      {/* The account is named once, with no identity swatch and no back link:
          the reviewer took the dot off every screen, and Accounts is a row in
          the sidebar and in the All overlay. */}
      <div className="flex flex-wrap items-center gap-3">
        {account ? (
          <>
            <span className="text-xms-ink text-[18px] font-semibold">{account.name}</span>
            <span className="xms-mono text-xms-label text-[12px]">{account.key}</span>
          </>
        ) : null}
        <div className="ml-auto flex items-center gap-3 text-[12px]">
          <Link href={queueBase} className="text-xms-accent hover:underline">
            Open the queue
          </Link>
          {me.hasPermission("admin:accounts") ? (
            <Link href={`/admin/accounts/${accountId}`} className="text-xms-accent hover:underline">
              Account record
            </Link>
          ) : null}
          <button
            type="button"
            role="switch"
            aria-checked={asClient}
            onClick={() => setAsClient((value) => !value)}
            className={cn(SECONDARY_BUTTON, "md:hidden", asClient && "border-xms-accent text-xms-accent")}
          >
            View as client
          </button>
        </div>
      </div>

      {asClient ? (
        <p
          role="status"
          className="border-xms-accent-border bg-xms-tint text-xms-ink rounded-[6px] border px-4 py-2 text-[13px]"
        >
          This is what the client sees. Measures the account does not expose are left out.
        </p>
      ) : null}

      {isError ? (
        <EmptyBanner
          title="The dashboard could not be loaded"
          detail="Check that you are granted this account."
          action={{ label: "Retry", onClick: () => void refetch() }}
        />
      ) : null}
      {isLoading && !data ? <Skeleton lines={10} /> : null}

      {data ? (
        <>
          <p className="text-xms-label text-[12px]">{formatPeriod(data.period)}</p>
          {!asClient ? (
            // The same ruling Operations took in pass three: a line written
            // from the measures the tiles read is generated text, so it takes
            // the tint this product gives generated text. On the shell's navy
            // it read as a system banner, which is the one thing it is not.
            <p className="xms-ai text-xms-body px-5 py-[18px] text-[15px] leading-[1.6]" data-testid="synthesis">
              {synthesisLine(data.measures)}
            </p>
          ) : null}
          <TileStrip measures={data.measures} links={{ base: queueBase }} />
          <div className="grid gap-4 lg:grid-cols-2">
            <SlaPanel measures={data.measures} />
            <OutcomesPanel measures={data.measures} />
            <BacklogPanel measures={data.measures} />
            <BreakdownPanel
              title="Open by priority"
              values={data.measures.open_by_priority}
              linkBase={queueBase}
              param="priority"
            />
            <BreakdownPanel
              title="Open by type"
              values={data.measures.open_by_type}
              linkBase={queueBase}
              param="type"
              labelOf={ticketTypeLabel}
            />
            <ConsumptionPanel measures={data.measures} />
          </div>
          <NotablePanel notable={data.notable} />
        </>
      ) : null}

      {!asClient ? <ReportsCard accountId={accountId} /> : null}
      {!asClient ? <CompTimePanel accountId={accountId} /> : null}
    </div>
  );
}
