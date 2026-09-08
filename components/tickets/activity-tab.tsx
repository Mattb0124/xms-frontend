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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True where a value is an identifier and nothing a reader can read. */
export function isIdentifier(value: unknown): boolean {
  return typeof value === "string" && UUID.test(value);
}

function valueText(value: unknown): string {
  if (value === null || value === undefined) return "empty";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

/**
 * What a field change reads as when its values are identifiers.
 *
 * The row used to print them: "changed assignee id [empty]
 * e783a8ab-8d9b-4ad2-a7a6-dd4aadc5753c". A uuid says nothing a reader can
 * use, and the timeline carries no name to put in its place, so the row says
 * what happened and stops there. The field loses its "id" suffix with it,
 * since "assignee id" is the column's name and "assignee" is the thing.
 */
export function changeSentence(field: string, oldValue: unknown, newValue: unknown): string | null {
  if (!isIdentifier(oldValue) && !isIdentifier(newValue)) return null;
  const name = field.replace(/_id$/, "").replace(/_/g, " ");
  const had = oldValue !== null && oldValue !== undefined;
  const has = newValue !== null && newValue !== undefined;
  if (had && has) return `changed ${name}`;
  return has ? `set ${name}` : `cleared ${name}`;
}

/** Render 03's activity row: 12px above and below on a row hairline. */
const ROW = "border-xms-line-row flex flex-wrap items-baseline gap-3 border-b py-3 last:border-b-0";

/** One audit row as a diff sentence; state changes render on the ramp. */
export function AuditRow({ item }: { item: TimelineItem }) {
  const isState = item.event_type === "ticket.transition" && item.field === "state";
  const label = (item.event_type ?? "event").replace(/[._]/g, " ");
  const opaque = item.field ? changeSentence(item.field, item.old_value, item.new_value) : null;
  return (
    // Render 03's row: the mark, the sentence, and the instant in mono on the
    // right. The timestamp used to lead, in a 110px column that wrapped onto
    // two lines and started every sentence in the list at a different place.
    <li className={ROW} data-event={item.event_type}>
      <ActorChip name={item.actor_name ?? "System"} kind={item.actor_kind === "ai" ? "ai" : "user"} />
      <span className="text-xms-ink flex flex-1 flex-wrap items-center gap-2 text-[14px] leading-[1.5]">
        {isState ? (
          <>
            <span className="text-xms-label">moved</span>
            <StatePill state={String(item.old_value)} label={humanState(String(item.old_value))} />
            <span className="text-xms-muted">to</span>
            <StatePill state={String(item.new_value)} label={humanState(String(item.new_value))} />
          </>
        ) : opaque ? (
          <span className="text-xms-label">{opaque}</span>
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
      </span>
      <span className="xms-mono text-xms-muted shrink-0 text-[12px]">{formatStamp(item.created_at)}</span>
    </li>
  );
}

export function PauseRow({ item }: { item: TimelineItem }) {
  const reason = PAUSE_REASONS.find((entry) => entry.value === item.reason)?.label ?? item.reason ?? "Paused";
  const ongoing = !item.ended_at;
  return (
    <li className={ROW} data-event="pause">
      <ActorChip name={item.actor_name ?? "Unknown"} />
      <span className="text-xms-ink flex flex-1 flex-wrap items-center gap-2 text-[14px] leading-[1.5]">
        <span className="text-xms-label">paused clocks:</span>
        <span className="text-xms-sla-paused font-medium">{reason}</span>
        {item.note ? <span className="text-xms-label">({item.note})</span> : null}
        <span className="xms-mono text-xms-label text-[12px]">
          {ongoing ? "still paused" : `${formatMinutes(item.excluded_minutes ?? 0)} excluded`}
        </span>
      </span>
      <span className="xms-mono text-xms-muted shrink-0 text-[12px]">{formatStamp(item.created_at)}</span>
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
      <div role="group" aria-label="Filter by actor" className="flex flex-wrap items-center gap-[7px]">
        {ACTOR_FILTERS.map((filter) => (
          <button
            key={filter.key}
            type="button"
            aria-pressed={actor === filter.key}
            onClick={() => setActor(filter.key)}
            className={cn(
              // Render 03's pills: 8 by 13 at 12px, filled blue when chosen
              // and on the control edge when not.
              "rounded-[999px] px-[13px] py-2 text-[12px] font-medium",
              actor === filter.key
                ? "bg-xms-accent font-semibold text-white"
                : "border-xms-line-strong bg-xms-card text-xms-body hover:border-xms-accent hover:text-xms-accent border",
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>
      <ul aria-label="Activity">
        {rows.map((item) =>
          item.kind === "pause" ? <PauseRow key={item.id} item={item} /> : <AuditRow key={item.id} item={item} />,
        )}
        {rows.length === 0 ? (
          <li className="text-xms-label py-3 text-[13px]">
            {all.length === 0 ? "No activity yet." : "No activity from that actor."}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
