"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { WaitingRail } from "@/components/my-work/waiting-rail";
import { attentionColumns, ticketColumns } from "@/components/tickets/ticket-columns";
import { TimeTodayCard } from "@/components/time/time-today-card";
import { BriefLine } from "@/components/xms/brief-line";
import { DenseTable } from "@/components/xms/dense-table";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { ScoreTile } from "@/components/xms/score-tile";
import { Skeleton } from "@/components/xms/skeleton";
import { useMe } from "@/redux/me";
import { useListGrantedAccountsQuery, useListTicketsQuery, type TicketView } from "@/redux/ticketsApi";

const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;

/** Breached, or awaiting the client for more than two days: what needs a nudge today. */
export function needsAttention(items: TicketView[], now: Date = new Date()): TicketView[] {
  return items.filter((ticket) => {
    const breached = Boolean(ticket.sla.response?.breached || ticket.sla.resolution?.breached);
    const stale =
      ticket.state === "awaiting_client" && now.getTime() - new Date(ticket.updated_at).getTime() > TWO_DAYS;
    return breached || stale;
  });
}

/** My work (User Experience 3.1, Wireframes v2 section 3.3): scorecards, the brief line, needs attention, my open tickets. */
export default function MyWorkPage() {
  const me = useMe();
  const router = useRouter();
  const ready = Boolean(me.permissions) && me.hasPermission("tickets:view");
  const { data, isLoading } = useListTicketsQuery(
    { mine: true, open: true, limit: 100 },
    { pollingInterval: 60_000, skip: !ready },
  );
  const { data: accounts } = useListGrantedAccountsQuery(undefined, { skip: !ready });
  const accountsById = useMemo(() => new Map((accounts ?? []).map((account) => [account.id, account])), [accounts]);
  const columns = useMemo(() => ticketColumns({ accounts: accountsById }), [accountsById]);
  const attentionCols = useMemo(() => attentionColumns({ accounts: accountsById }), [accountsById]);
  const mine = useMemo(() => data?.items ?? [], [data]);
  const attention = useMemo(() => needsAttention(mine), [mine]);
  const breached = mine.filter((ticket) => ticket.sla.response?.breached || ticket.sla.resolution?.breached).length;
  const atRisk = mine.filter((ticket) => {
    const clock = ticket.sla.resolution ?? ticket.sla.response;
    return clock && !clock.met && !clock.breached && clock.remainingMinutes < clock.targetMinutes * 0.25;
  }).length;
  const awaiting = mine.filter((ticket) => ticket.state.startsWith("awaiting")).length;
  // The captions under the numbers in render 08 name what each is counted
  // over: the accounts the work sits on, and the key of the one that breached.
  const accountCount = new Set(mine.map((ticket) => ticket.account_id)).size;
  const firstBreached = mine.find((ticket) => ticket.sla.response?.breached || ticket.sla.resolution?.breached);

  if (!me.permissions) return <Skeleton lines={6} />;
  if (!ready) {
    return (
      <EmptyBanner
        title="Welcome to XMS"
        detail="Ask an administrator for a role and account grants to see your work."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="sr-only">My work</h1>
      {/* The four scorecards the render (08) draws, each with the caption
          that says what the number is counted over. */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <ScoreTile
          label="Assigned to me"
          value={mine.length}
          detail={accountCount === 1 ? "on 1 account" : `across ${accountCount} accounts`}
          href="/tickets?view=mine"
        />
        <ScoreTile
          label="Breached"
          value={breached}
          detail={firstBreached?.key}
          tone={breached > 0 ? "breach" : "good"}
          href="/tickets?view=breached"
        />
        <ScoreTile
          label="At risk"
          value={atRisk}
          detail="under 25% left"
          tone={atRisk > 0 ? "warn" : "neutral"}
          href="/tickets?view=mine"
        />
        <ScoreTile
          label="Awaiting client"
          value={awaiting}
          detail={awaiting === 1 ? "clock paused" : "clocks paused"}
          href="/tickets?view=awaiting_client"
        />
      </div>
      <BriefLine
        text={
          breached > 0
            ? `${breached} of your tickets ${breached === 1 ? "has" : "have"} breached; start there.`
            : mine.length === 0
              ? "Nothing is assigned to you. The Queue has the unassigned work."
              : `${mine.length} open on your desk, ${atRisk} at risk.`
        }
      />
      {/* The render (08) puts the lists on the left and Time today and
          Waiting on me in a rail beside them, rather than stacking all four. */}
      {isLoading && !data ? (
        <Skeleton lines={6} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-4">
            <DenseTable<TicketView>
              title="Needs attention"
              count={attention.length}
              columns={attentionCols}
              rows={attention}
              rowKey={(row) => row.key}
              onRowClick={(row) => router.push(`/tickets/${row.key}`)}
              emptyState="Nothing needs a nudge right now."
            />
            <DenseTable<TicketView>
              title="My open tickets"
              count={mine.length}
              columns={columns}
              rows={mine}
              rowKey={(row) => row.key}
              onRowClick={(row) => router.push(`/tickets/${row.key}`)}
              emptyState={
                <EmptyBanner
                  title="Nothing assigned to you"
                  action={{ label: "Open the Queue", href: "/tickets?view=unassigned" }}
                />
              }
            />
          </div>
          <div className="flex flex-col gap-4">
            <TimeTodayCard />
            <WaitingRail />
          </div>
        </div>
      )}
    </div>
  );
}
