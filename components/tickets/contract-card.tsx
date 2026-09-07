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
    <div className="flex flex-col gap-2" data-status={position.status}>
      <div className="flex items-center gap-2">
        <span className="xms-mono text-xms-accent text-[12px]">{position.contract.key}</span>
        <span className="text-xms-ink truncate text-[13px]">{position.contract.name}</span>
        <span className={cn("ml-auto text-[12px] font-medium", TONE_CLASS[tone])} data-tone={tone}>
          {STATUS_LABEL[position.status]}
        </span>
      </div>
      <MeterBar
        percent={percent}
        breached={position.status === "over"}
        label={`${hoursText(position.consumed_minutes)} of ${hoursText(position.available_minutes)} this period`}
      />
      <p className="text-xms-body text-[12px]">
        <span className="xms-mono text-xms-ink">{hoursText(position.remaining_minutes)}</span> remaining, projected{" "}
        <span className="xms-mono">{hoursText(position.projected_minutes)}</span> at the current rate.
      </p>
      <p className="xms-mono text-xms-label text-[11px]">
        {position.period.starts_on} to {position.period.ends_on}, day {position.period.days_elapsed} of{" "}
        {position.period.days_total}
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
      {isError ? <p className="text-xms-muted text-[12px]">No contract period covers today.</p> : null}
      {data ? <ContractCardView position={data} /> : null}
    </RailCard>
  );
}
