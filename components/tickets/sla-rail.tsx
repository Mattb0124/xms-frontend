"use client";

import { useEffect, useState } from "react";
import { SECONDARY_BUTTON } from "@/components/admin/primitives";
import { MeterBar } from "@/components/xms/meter-bar";
import { RailCard } from "@/components/xms/rail-card";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import {
  clockDisplay,
  meterCaption,
  meterPercent,
  pauseCaption,
  type ClockView,
  type TicketSla,
} from "@/lib/tickets/sla";
import { useWatchTicketMutation } from "@/redux/ticketsApi";

function Meter({
  clock,
  fetchedAt,
  now,
  pausedReason,
  metAt,
}: {
  clock: ClockView;
  fetchedAt: Date;
  now: Date;
  pausedReason?: string;
  metAt?: string | null;
}) {
  const percent = meterPercent(clock, fetchedAt, now);
  const pauseShare = clock.targetMinutes > 0 ? (clock.pausedTotalMinutes / clock.targetMinutes) * 100 : 0;
  const pause = pauseCaption(clock, pausedReason);
  // The caption's own words decide the treatment, not the latched flag.
  const breached = clockDisplay(clock, now).tone === "breach";
  return (
    <div className="flex flex-col gap-1" data-clock={clock.kind}>
      {/* A breached clock says so in the overdue colour and the weight; a
          running or met one stays quiet. The card carried every state in the
          same grey whatever had happened (2026-09-13 design pass).
          
          It stays at the body size on purpose. The record bar's breach pill
          is the one element on this screen set above the body, and it only
          reads as dominant while nothing else competes with it; a rail with
          two clocks in it would otherwise put two more of them on the page.
          Here the colour and the weight are enough. */}
      <span
        className={
          breached
            ? "text-body leading-[1.4] font-semibold text-[color:var(--state-overdue-text)]"
            : "text-xms-body text-body leading-[1.4]"
        }
      >
        {meterCaption(clock, fetchedAt, now, metAt)}
      </span>
      <MeterBar
        percent={clock.met ? 100 : percent}
        met={clock.met}
        breached={clock.breached}
        paused={clock.paused}
        pauses={pauseShare > 0 ? [{ startPct: Math.max(0, percent - pauseShare), endPct: percent }] : []}
      />
      {pause ? (
        <span className="text-xms-label text-body" data-pause-caption>
          {pause}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Service levels with live countdown (30 s tick). Each meter names its target, elapsed and remaining time, and the
 * grey pause segment carries its reason, which is the ticket's own paused
 * state (Wireframes section 3.2, review finding 21).
 */
export function ServiceLevels({
  sla,
  fetchedAt,
  pausedReason,
  metAt,
}: {
  sla: TicketSla;
  fetchedAt?: Date;
  pausedReason?: string;
  /** When each clock stopped: the ticket's first_response_at and resolved_at. */
  metAt?: { response?: string | null; resolution?: string | null };
}) {
  const [now, setNow] = useState(() => new Date());
  const base = fetchedAt ?? now;
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const clocks = [sla.response, sla.resolution].filter((clock): clock is ClockView => Boolean(clock));
  return (
    <RailCard caption="Service levels">
      {clocks.length === 0 ? (
        <p className="text-xms-muted">No SLA on this ticket.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {clocks.map((clock) => (
            <Meter
              key={clock.kind}
              clock={clock}
              fetchedAt={base}
              now={now}
              pausedReason={pausedReason}
              metAt={metAt?.[clock.kind]}
            />
          ))}
        </div>
      )}
    </RailCard>
  );
}

/**
 * The watch toggle as a record-bar action, where ServiceNow puts Follow. It
 * was a rail card; the record has no rail now.
 */
export function FollowButton({ ticketKey, watching = true }: { ticketKey: string; watching?: boolean }) {
  const [watch, { isLoading }] = useWatchTicketMutation();
  const [muted, setMuted] = useState(!watching);
  // The record is the truth for the initial state; re-sync when it changes.
  const [seen, setSeen] = useState(watching);
  if (seen !== watching) {
    setSeen(watching);
    setMuted(!watching);
  }
  const { push } = useToast();
  return (
    <button
      type="button"
      disabled={isLoading}
      aria-pressed={!muted}
      title={muted ? "Get replies, notes and state changes in your feed" : "Stop being notified about this ticket"}
      onClick={() =>
        watch({ key: ticketKey, muted: !muted })
          .unwrap()
          .then((result) => setMuted(result.muted))
          .catch((error) => push({ title: "Not saved", detail: describeError(apiError(error)), tone: "error" }))
      }
      className={SECONDARY_BUTTON}
    >
      {muted ? "Follow" : "Unfollow"}
    </button>
  );
}
