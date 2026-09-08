"use client";

import { useState } from "react";
import { SECONDARY_BUTTON } from "@/components/admin/primitives";
import { BudgetEntriesList } from "@/components/time/budget-entries";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { Panel } from "@/components/xms/panel";
import { SignalPill, type SignalTone } from "@/components/xms/signal-pill";
import { Skeleton } from "@/components/xms/skeleton";
import { useCatalogs, type DeskCatalogs } from "@/lib/tickets/use-catalogs";
import {
  budgetTone,
  consumedPercent,
  describeOverage,
  describeRollover,
  forecastBasis,
  forecastSentence,
  formatHours,
  thresholdLabel,
  thresholdMarkers,
  unratedNote,
  type BudgetTone,
  type ThresholdMarker,
} from "@/lib/time/budget";
import { cn } from "@/lib/utils";
import { useMe } from "@/redux/me";
import { useAccountBudgetQuery, type BudgetContractCard, type PositionStatus } from "@/redux/timeApi";

const MODEL_LABEL: Record<string, string> = {
  retainer: "Retainer",
  prepaid_block: "Prepaid block",
  time_and_materials: "Time and materials",
  fixed_fee: "Fixed fee",
};

const STATUS: Record<PositionStatus, { label: string; tone: SignalTone }> = {
  on_track: { label: "On track", tone: "complete" },
  watch: { label: "Watch", tone: "needs-input" },
  over: { label: "Over", tone: "overdue" },
};

const FILL: Record<BudgetTone, string> = {
  good: "var(--xms-accent)",
  warn: "var(--state-needs-input-text)",
  breach: "var(--state-overdue-text)",
};

const LEGEND: Record<"fired" | "next" | "ahead", string> = {
  fired: "text-[color:var(--state-needs-input-text)]",
  next: "text-xms-ink font-medium",
  ahead: "text-xms-label",
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export interface BurnBarProps {
  /** Consumed as a share of available; over 100 renders full. */
  percent: number;
  tone: BudgetTone;
  markers: ThresholdMarker[];
  label: string;
}

/**
 * The burn bar (5.5): consumed against available, amber from the first
 * fired threshold and red once over, with a tick per configured threshold
 * (fired ones in the amber, the next one in ink) and the legend beneath.
 */
export function BurnBar({ percent, tone, markers, label }: BurnBarProps) {
  const fill = clamp(percent);
  return (
    <div className="flex flex-col gap-2">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(fill)}
        aria-valuemin={0}
        aria-valuemax={100}
        data-tone={tone}
        className="bg-xms-tint relative h-2.5 w-full rounded-[999px]"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-[999px]"
          style={{ width: `${fill}%`, background: FILL[tone] }}
        />
        {markers
          .filter((marker) => marker.percent <= 100)
          .map((marker) => (
            <span
              key={marker.percent}
              data-marker={marker.percent}
              data-fired={marker.fired ? "true" : undefined}
              data-next={marker.next ? "true" : undefined}
              title={thresholdLabel(marker)}
              className="absolute -top-[3px] h-4 w-[2px]"
              style={{
                left: `calc(${marker.percent}% - 1px)`,
                background: marker.fired
                  ? "var(--state-needs-input-text)"
                  : marker.next
                    ? "var(--xms-ink)"
                    : "var(--xms-line-strong)",
              }}
            />
          ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]" aria-label="Thresholds">
        {markers.map((marker) => (
          <li
            key={marker.percent}
            data-threshold={marker.percent}
            className={LEGEND[marker.fired ? "fired" : marker.next ? "next" : "ahead"]}
          >
            {thresholdLabel(marker)}
          </li>
        ))}
        {markers.length === 0 ? <li className="text-xms-label">No thresholds configured.</li> : null}
      </ul>
    </div>
  );
}

/** One contract's card on the Budget view: the burn bar, the forecast sentence, the thresholds and the drill-through. */
export function ContractBudgetCard({
  accountId,
  card,
  catalogs,
}: {
  accountId: string;
  card: BudgetContractCard;
  catalogs: DeskCatalogs;
}) {
  const [open, setOpen] = useState(false);
  const { contract, period, position, forecast, thresholds } = card;
  const tone = budgetTone(card);
  const rules = [
    MODEL_LABEL[contract.model] ?? contract.model,
    describeOverage(contract.overage_rule),
    describeRollover(contract.rollover_rule),
  ].join(", ");
  const unrated = unratedNote(card.unrated_minutes);

  return (
    <Panel
      title={`${contract.key} ${contract.name}`}
      caption="Contract"
      subtitle={`${rules}.`}
      actions={
        position ? <SignalPill tone={STATUS[position.status].tone} label={STATUS[position.status].label} /> : null
      }
    >
      <div className="flex flex-col gap-3" data-contract={contract.id} data-tone={tone}>
        {!period || !position ? (
          <p className="text-xms-label text-[13px]">
            No period on this contract yet. Add one on the Contracts tab; until then time logged here is not measured
            against a budget.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="xms-mono text-xms-ink text-[20px] font-semibold" data-consumed>
                {formatHours(position.consumed_minutes)}
              </span>
              <span className="text-xms-body text-[13px]">
                of <span className="xms-mono">{formatHours(position.available_minutes)}</span> used,{" "}
                <span className="xms-mono">{formatHours(position.remaining_minutes)}</span> remaining
                {position.carried_over_minutes > 0 ? (
                  <>
                    {" "}
                    (<span className="xms-mono">{formatHours(position.carried_over_minutes)}</span> carried over)
                  </>
                ) : null}
              </span>
              <span className="xms-mono text-xms-label ml-auto text-[11px]">
                {period.starts_on} to {period.ends_on}
                {period.locked ? ", locked" : ""}
              </span>
            </div>
            <BurnBar
              percent={consumedPercent(position)}
              tone={tone}
              markers={thresholds ? thresholdMarkers(thresholds, position.available_minutes) : []}
              label={`${formatHours(position.consumed_minutes)} of ${formatHours(position.available_minutes)}`}
            />
            {forecast ? (
              <div>
                <p className="text-xms-ink text-[13px]" data-forecast>
                  {forecastSentence(forecast, position.available_minutes)}
                </p>
                <p className="text-xms-label text-[11px]">{forecastBasis(forecast)}</p>
              </div>
            ) : null}
            {unrated ? (
              <p className="text-[12px] text-[color:var(--state-needs-input-text)]" data-unrated>
                {unrated}
              </p>
            ) : null}
            <div>
              <button
                type="button"
                className={cn(SECONDARY_BUTTON, "h-[26px] px-2 text-[12px]")}
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
              >
                {open ? "Hide entries" : "Show entries"}
              </button>
            </div>
            {open ? (
              <BudgetEntriesList accountId={accountId} contract={contract} period={period} catalogs={catalogs} />
            ) : null}
          </>
        )}
      </div>
    </Panel>
  );
}

/**
 * The account's Budget view (Time & Budget 5.5, TB-07 to TB-09): one card
 * per active contract from /v1/accounts/:id/budget. That route and its
 * drill-through are guarded by contracts:view, which Consultants and
 * Dispatchers do not hold, so the view fails closed on that permission and
 * never asks the API without it.
 */
export function AccountBudgetView({ accountId }: { accountId: string }) {
  const me = useMe();
  const allowed = me.hasPermission("contracts:view");
  const { data, isLoading, isError, refetch } = useAccountBudgetQuery(accountId, { skip: !allowed });
  const catalogs = useCatalogs(accountId, { skip: !allowed });

  if (!allowed) {
    return (
      <Panel title="Budget" caption="Needs the contracts:view permission">
        <p className="text-xms-label text-[13px]">You can see this account but not its budget.</p>
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="account-budget">
      {isLoading && !data ? <Skeleton lines={6} /> : null}
      {isError ? (
        <EmptyBanner
          title="The budget could not be loaded"
          detail="Check that you are granted this account."
          action={{ label: "Retry", onClick: () => void refetch() }}
        />
      ) : null}
      {data ? (
        <>
          <p className="text-xms-label text-[12px]">
            As of <span className="xms-mono">{data.as_of}</span>, per active contract and its current period.
          </p>
          {data.contracts.length === 0 ? (
            <Panel title="Budget" caption="No contract yet">
              <p className="text-xms-label text-[13px]">
                No active contract on this account. Add one on the Contracts tab; time can still be logged meanwhile.
              </p>
            </Panel>
          ) : null}
          {data.contracts.map((card) => (
            <ContractBudgetCard key={card.contract.id} accountId={accountId} card={card} catalogs={catalogs} />
          ))}
        </>
      ) : null}
    </div>
  );
}
