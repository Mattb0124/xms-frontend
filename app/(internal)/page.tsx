"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { WaitingRail } from "@/components/my-work/waiting-rail";
import { HeaderAction, HeaderFilters, HeaderSearch, HeaderSearchField } from "@/components/shell/content-header-bar";
import { PRIMARY_BUTTON } from "@/components/admin/primitives";
import Link from "next/link";
import { attentionColumns } from "@/components/tickets/ticket-columns";
import { TimeTodayCard } from "@/components/time/time-today-card";
import { BriefLine } from "@/components/xms/brief-line";
import { DenseTable } from "@/components/xms/dense-table";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { FilterSelect, StripSelect } from "@/components/xms/filter-select";
import { ICON, PlusIcon } from "@/components/xms/icons";
import { ScoreTile } from "@/components/xms/score-tile";
import { Skeleton } from "@/components/xms/skeleton";
import { tighterClock } from "@/lib/tickets/sla";
import { cn } from "@/lib/utils";
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

/** Tightest clock first, and a ticket with no clock last: the order the list is read in. */
function byClock(a: TicketView, b: TicketView): number {
  const left = tighterClock(a.sla)?.remainingMinutes ?? Number.MAX_SAFE_INTEGER;
  const right = tighterClock(b.sla)?.remainingMinutes ?? Number.MAX_SAFE_INTEGER;
  return left - right;
}

/**
 * "Mine first, then group unassigned", which is what render 08's own subtitle
 * says the list is: everything assigned to me on the tightest clock, then the
 * unassigned work in my groups on the same order, with nothing counted twice.
 */
export function attentionOrder(mine: TicketView[], group: TicketView[]): TicketView[] {
  const seen = new Set(mine.map((ticket) => ticket.key));
  return [...[...mine].sort(byClock), ...group.filter((ticket) => !seen.has(ticket.key)).sort(byClock)];
}

/**
 * My work (render 08, User Experience 3.1, Wireframes section 3.3): four
 * scorecards, the Axel brief, one "Needs attention" list, and a rail with
 * Time today and Waiting on me.
 *
 * There is one list, not two. The screen carried "Needs attention" and "My
 * open tickets" under it, and the render and section 3.3 both name one:
 * everything the second list held is in the Queue behind "Show: mine", which
 * the Assigned to me tile links to.
 */
export default function MyWorkPage() {
  const me = useMe();
  const router = useRouter();
  const ready = Boolean(me.permissions) && me.hasPermission("tickets:view");
  const { data, isLoading } = useListTicketsQuery(
    { mine: true, open: true, limit: 100 },
    { pollingInterval: 60_000, skip: !ready },
  );
  // The second half of "mine first, then group unassigned": the server
  // resolves my groups from the membership table, so the browser never names
  // them (TM-08).
  const { data: groupWork } = useListTicketsQuery(
    { my_groups: true, unassigned: true, open: true, limit: 50 },
    { pollingInterval: 60_000, skip: !ready },
  );
  const { data: accounts } = useListGrantedAccountsQuery(undefined, { skip: !ready });
  const accountsById = useMemo(() => new Map((accounts ?? []).map((account) => [account.id, account])), [accounts]);
  const attentionCols = useMemo(() => attentionColumns({ accounts: accountsById }), [accountsById]);
  const mine = useMemo(() => data?.items ?? [], [data]);
  const group = useMemo(() => groupWork?.items ?? [], [groupWork]);
  const attention = useMemo(() => attentionOrder(needsAttention(mine), group).slice(0, 8), [mine, group]);
  const breached = mine.filter((ticket) => ticket.sla.response?.breached || ticket.sla.resolution?.breached).length;
  const atRisk = mine.filter((ticket) => {
    const clock = ticket.sla.resolution ?? ticket.sla.response;
    return clock && !clock.met && !clock.breached && clock.remainingMinutes < clock.targetMinutes * 0.25;
  }).length;
  const awaiting = mine.filter((ticket) => ticket.state.startsWith("awaiting")).length;
  // The sub-lines under the numbers in render 08 name what each is counted
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
    <div className="flex flex-col gap-4">
      <h1 className="sr-only">My work</h1>
      {/* The toolbar grammar every list screen carries (render 08): the
          primary "Show:" dimension, the standing account dimension, the
          screen's own search and the blue New. */}
      <HeaderFilters>
        <div className="flex items-center gap-2">
          <StripSelect
            primary
            label="Show"
            value="mine"
            display={`mine (${mine.length})`}
            onChange={(value) => router.push(`/tickets?view=${value}`)}
          >
            <option value="mine">Show: mine</option>
            <option value="unassigned">Show: unassigned</option>
            <option value="open">Show: all open</option>
          </StripSelect>
          <FilterSelect
            label="Account"
            value=""
            options={(accounts ?? []).map((account) => ({ value: account.id, label: account.name }))}
            onChange={(value) => router.push(value ? `/tickets?view=mine&account_id=${value}` : "/tickets?view=mine")}
          />
        </div>
      </HeaderFilters>
      <HeaderSearch>
        <HeaderSearchField
          value=""
          onChange={() => undefined}
          onSubmit={() => router.push("/tickets")}
          label="Search my work"
        />
      </HeaderSearch>
      <HeaderAction>
        {me.hasPermission("tickets:create") ? (
          <Link href="/tickets/new" className={cn(PRIMARY_BUTTON, "inline-flex items-center gap-1")}>
            <PlusIcon size={ICON.action} />
            New
          </Link>
        ) : null}
      </HeaderAction>

      {/* The four scorecards the render draws, each with the sub-line that
          says what the number is counted over. */}
      <div className="grid grid-cols-2 gap-[14px] md:grid-cols-4">
        <ScoreTile
          label="Assigned to me"
          value={mine.length}
          detail={accountCount === 1 ? "on 1 account" : `across ${accountCount} accounts`}
          href="/tickets?view=mine"
        />
        <ScoreTile label="Breached" value={breached} detail={firstBreached?.key} href="/tickets?view=breached" />
        <ScoreTile label="At risk" value={atRisk} detail="under 25% left" href="/tickets?view=mine" />
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
      {/* The render puts the list on the left and Time today and Waiting on me
          in a 300px rail beside it. */}
      {isLoading && !data ? (
        <Skeleton lines={6} />
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <DenseTable<TicketView>
            title="Needs attention"
            subtitle="mine first, then group unassigned"
            headless
            columns={attentionCols}
            rows={attention}
            rowKey={(row) => row.key}
            onRowClick={(row) => router.push(`/tickets/${row.key}`)}
            emptyState="Nothing needs a nudge right now."
          />
          <div className="flex flex-col gap-[14px]">
            <TimeTodayCard />
            <WaitingRail />
          </div>
        </div>
      )}
    </div>
  );
}
