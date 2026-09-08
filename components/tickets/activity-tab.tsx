"use client";

import { useState } from "react";
import { formatStamp } from "@/components/tickets/conversation-tab";
import { ActorChip } from "@/components/xms/actor-chip";
import { Skeleton } from "@/components/xms/skeleton";
import { StatePill } from "@/components/xms/state-pill";
import { formatMinutes } from "@/lib/tickets/sla";
import { humanState } from "@/lib/tickets/transition-errors";
import { PAUSE_REASONS } from "@/lib/tickets/vocab";
import { cn } from "@/lib/utils";
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

/**
 * The actor filter the v3 render (03) draws above the list: All, User,
 * Portal, System, Sync, AI as rounded pills with the chosen one filled blue.
 * The built tab said it was "filterable by actor kind" and offered nothing to
 * filter with.
 */
const ACTOR_FILTERS: Array<{ key: string; label: string }> = [
  { key: "all", label: "All" },
  { key: "user", label: "User" },
  { key: "portal_user", label: "Portal" },
  { key: "system", label: "System" },
  { key: "sync", label: "Sync" },
  { key: "ai", label: "AI" },
];

/** Every audit event and pause interval, oldest first, filterable by actor kind. */
export function ActivityTab({ ticketKey }: { ticketKey: string }) {
  const { data, isLoading } = useGetTimelineQuery(ticketKey);
  const [actor, setActor] = useState("all");
  const all = (data ?? []).filter((item) => item.kind === "audit" || item.kind === "pause");
  const rows = actor === "all" ? all : all.filter((item) => (item.actor_kind ?? "user") === actor);
  if (isLoading) return <Skeleton lines={5} />;
  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Filter by actor" className="flex flex-wrap items-center gap-2">
        {ACTOR_FILTERS.map((filter) => (
          <button
            key={filter.key}
            type="button"
            aria-pressed={actor === filter.key}
            onClick={() => setActor(filter.key)}
            className={cn(
              "h-[30px] rounded-[999px] px-[14px] text-[13px] font-medium",
              actor === filter.key
                ? "bg-xms-accent text-white"
                : "border-xms-line bg-xms-card text-xms-body hover:border-xms-accent hover:text-xms-accent border",
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>
      <ul className="divide-xms-line divide-y" aria-label="Activity">
        {rows.map((item) =>
          item.kind === "pause" ? <PauseRow key={item.id} item={item} /> : <AuditRow key={item.id} item={item} />,
        )}
        {rows.length === 0 ? (
          <li className="text-xms-label py-2 text-[13px]">
            {all.length === 0 ? "No activity yet." : "No activity from that actor."}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
