"use client";

import { formatStamp } from "@/components/tickets/conversation-tab";
import { ActorChip } from "@/components/xms/actor-chip";
import { Skeleton } from "@/components/xms/skeleton";
import { StatePill } from "@/components/xms/state-pill";
import { formatMinutes } from "@/lib/tickets/sla";
import { humanState } from "@/lib/tickets/transition-errors";
import { PAUSE_REASONS } from "@/lib/tickets/vocab";
import { useGetTimelineQuery, type TimelineItem } from "@/redux/ticketsApi";

function valueText(value: unknown): string {
  if (value === null || value === undefined) return "empty";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

/** One audit row as a diff sentence; state changes render on the ramp. */
export function AuditRow({ item }: { item: TimelineItem }) {
  const isState = item.event_type === "ticket.transition" && item.field === "state";
  const label = (item.event_type ?? "event").replace(/[._]/g, " ");
  return (
    <li className="flex flex-wrap items-center gap-2 py-2 text-[13px]" data-event={item.event_type}>
      <span className="xms-mono text-xms-label w-[110px] shrink-0 text-[12px]">{formatStamp(item.created_at)}</span>
      <ActorChip name={item.actor_name ?? "System"} kind={item.actor_kind === "ai" ? "ai" : "user"} />
      {isState ? (
        <>
          <span className="text-xms-label">moved</span>
          <StatePill state={String(item.old_value)} label={humanState(String(item.old_value))} />
          <span className="text-xms-muted">to</span>
          <StatePill state={String(item.new_value)} label={humanState(String(item.new_value))} />
        </>
      ) : item.field ? (
        <>
          <span className="text-xms-label">changed</span>
          <span className="text-xms-ink font-medium">{item.field.replace(/_/g, " ")}</span>
          <span className="xms-mono text-xms-label line-through">{valueText(item.old_value)}</span>
          <span className="xms-mono text-xms-ink">{valueText(item.new_value)}</span>
        </>
      ) : (
        <span className="text-xms-label">{label}</span>
      )}
    </li>
  );
}

export function PauseRow({ item }: { item: TimelineItem }) {
  const reason = PAUSE_REASONS.find((entry) => entry.value === item.reason)?.label ?? item.reason ?? "Paused";
  const ongoing = !item.ended_at;
  return (
    <li className="flex flex-wrap items-center gap-2 py-2 text-[13px]" data-event="pause">
      <span className="xms-mono text-xms-label w-[110px] shrink-0 text-[12px]">{formatStamp(item.created_at)}</span>
      <ActorChip name={item.actor_name ?? "Unknown"} />
      <span className="text-xms-label">paused clocks:</span>
      <span className="text-xms-sla-paused font-medium">{reason}</span>
      {item.note ? <span className="text-xms-label">({item.note})</span> : null}
      <span className="xms-mono text-xms-label ml-auto text-[12px]">
        {ongoing ? "still paused" : `${formatMinutes(item.excluded_minutes ?? 0)} excluded`}
      </span>
    </li>
  );
}

/** Every audit event and pause interval, oldest first, filterable by actor kind. */
export function ActivityTab({ ticketKey }: { ticketKey: string }) {
  const { data, isLoading } = useGetTimelineQuery(ticketKey);
  const rows = (data ?? []).filter((item) => item.kind === "audit" || item.kind === "pause");
  if (isLoading) return <Skeleton lines={5} />;
  return (
    <ul className="divide-xms-line divide-y" aria-label="Activity">
      {rows.map((item) =>
        item.kind === "pause" ? <PauseRow key={item.id} item={item} /> : <AuditRow key={item.id} item={item} />,
      )}
      {rows.length === 0 ? <li className="text-xms-label py-2 text-[13px]">No activity yet.</li> : null}
    </ul>
  );
}
