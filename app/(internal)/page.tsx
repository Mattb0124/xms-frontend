"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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
import {
  attentionOrder,
  isAtRisk,
  isBreached,
  needsAttention,
  TILES,
  underLens,
  type TileKey,
} from "@/lib/my-work/attention";
import { cn } from "@/lib/utils";
import { useMe } from "@/redux/me";
import { useListGrantedAccountsQuery, useListTicketsQuery, type TicketView } from "@/redux/ticketsApi";

/**
 * My work (render 08, User Experience 3.1, Wireframes section 3.3): four
 * scorecards, the Axel brief, one "Needs attention" list, and a rail with
 * Time today and Waiting on me.
 *
 * There is one list, not two. The screen carried "Needs attention" and "My
 * open tickets" under it, and the render and section 3.3 both name one:
 * everything the second list held is in the Queue behind "Show: mine", which
 * the strip's own dimension opens.
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
  // The pressed scorecard, if any: the lens over the list rather than a place
  // to go (render 08, note 1).
  const [lens, setLens] = useState<TileKey | null>(null);
  const attention = useMemo(
    () => underLens(attentionOrder(needsAttention(mine), group), lens).slice(0, 8),
    [mine, group, lens],
  );
  const breached = mine.filter(isBreached).length;
  const atRisk = mine.filter(isAtRisk).length;
  const awaiting = mine.filter((ticket) => ticket.state.startsWith("awaiting")).length;
  // The sub-lines under the numbers in render 08 name what each is counted
  // over: the accounts the work sits on, and the key of the one that breached.
  const accountCount = new Set(mine.map((ticket) => ticket.account_id)).size;
  const firstBreached = mine.find(isBreached);

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
          says what the number is counted over. Render 08's own note 1: they
          filter the list below on click rather than navigating away, so each
          is a toggle and a second click puts the list back. */}
      <div className="grid grid-cols-2 gap-[14px] md:grid-cols-4">
        {TILES.map((tile) => (
          <ScoreTile
            key={tile.key}
            label={tile.label}
            value={tile.value({ mine, breached, atRisk, awaiting })}
            detail={tile.detail({ accountCount, firstBreached, awaiting })}
            selected={lens === tile.key}
            onClick={() => setLens((current) => (current === tile.key ? null : tile.key))}
          />
        ))}
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
