"use client";

import { MeterBar } from "@/components/xms/meter-bar";
import { RailCard } from "@/components/xms/rail-card";
import { Skeleton } from "@/components/xms/skeleton";
import { cn } from "@/lib/utils";
import { useContractPositionQuery, type ContractPosition, type PositionStatus } from "@/redux/timeApi";

export type PositionTone = "good" | "warn" | "breach";

/** The status tone the server's position carries (Time & Budget 5.5): on track green, watch amber, over red. */
export function positionTone(status: PositionStatus): PositionTone {
  switch (status) {
    case "over":
      return "breach";
    case "watch":
      return "warn";
    default:
      return "good";
  }
}

/** The bare number the prototype's headline carries: "87.5", not "87.5h". */
export function bareHours(minutes: number): string {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

export function hoursText(minutes: number): string {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

const TONE_CLASS: Record<PositionTone, string> = {
  good: "text-[color:var(--state-complete-text)]",
  warn: "text-[color:var(--state-needs-input-text)]",
  breach: "text-[color:var(--state-overdue-text)]",
};

const STATUS_LABEL: Record<PositionStatus, string> = {
  on_track: "On track",
  watch: "Watch",
  over: "Over",
};

export function ContractCardView({ position }: { position: ContractPosition }) {
  const tone = positionTone(position.status);
  const percent = position.available_minutes > 0 ? (position.consumed_minutes / position.available_minutes) * 100 : 0;
  return (
    /*
     * The prototype leads this card with the burn as one large mono number and
     * "of 100 h" small beside it, then the meter, then one caption line. The
     * built card led with the contract's key and name and put the numbers in
     * the meter's own label, so the card's headline was an identifier.
     */
    <div className="flex flex-col" data-status={position.status}>
      <p className="xms-mono text-xms-ink text-[22px] leading-[1.2] font-medium" data-burn>
        {bareHours(position.consumed_minutes)}{" "}
        <span className="text-xms-label font-sans text-[14px] leading-none font-normal">
          of {bareHours(position.available_minutes)} h
        </span>
      </p>
      <MeterBar percent={percent} breached={position.status === "over"} className="mt-[11px] mb-2" />
      <p className="text-xms-muted text-[14px] leading-[1.5]">
        <span className={cn("font-medium", TONE_CLASS[tone])} data-tone={tone}>
          {STATUS_LABEL[position.status]}
        </span>
        {". "}
        {hoursText(position.remaining_minutes)} remaining, projected {hoursText(position.projected_minutes)} at the
        current rate. {position.contract.key} {position.contract.name}, day {position.period.days_elapsed} of{" "}
        {position.period.days_total}.
      </p>
    </div>
  );
}

/** The contract card on the rail: burn against the available hours from the server's position. */
export function ContractCard({ accountId, contractId }: { accountId: string; contractId: string }) {
  const { data, isLoading, isError } = useContractPositionQuery({ accountId, contractId });
  return (
    <RailCard caption="Contract">
      {isLoading ? <Skeleton lines={3} /> : null}
      {isError ? <p className="text-xms-muted text-[14px]">No contract period covers today.</p> : null}
      {data ? <ContractCardView position={data} /> : null}
    </RailCard>
  );
}
