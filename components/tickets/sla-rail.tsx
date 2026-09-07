"use client";

import { useEffect, useState } from "react";
import { MeterBar } from "@/components/xms/meter-bar";
import { RailCard } from "@/components/xms/rail-card";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import { meterCaption, meterPercent, type ClockView, type TicketSla } from "@/lib/tickets/sla";
import { useWatchTicketMutation, type TicketView } from "@/redux/ticketsApi";

function Meter({ clock, fetchedAt, now }: { clock: ClockView; fetchedAt: Date; now: Date }) {
  const percent = meterPercent(clock, fetchedAt, now);
  const pauseShare = clock.targetMinutes > 0 ? (clock.pausedTotalMinutes / clock.targetMinutes) * 100 : 0;
  return (
    <div className="flex flex-col gap-1" data-clock={clock.kind}>
      <span className="text-xms-ink text-[13px]">{meterCaption(clock, fetchedAt, now)}</span>
      <MeterBar
        percent={clock.met ? 100 : percent}
        breached={clock.breached}
        paused={clock.paused}
        pauses={pauseShare > 0 ? [{ startPct: Math.max(0, percent - pauseShare), endPct: percent }] : []}
      />
      {clock.pausedTotalMinutes > 0 ? (
        <span className="text-xms-label text-[12px]">Grey segment is {clock.pausedTotalMinutes}m paused.</span>
      ) : null}
    </div>
  );
}

/** Service levels with live countdown (30 s tick), requester card, watch toggle. */
export function ServiceLevels({ sla, fetchedAt }: { sla: TicketSla; fetchedAt?: Date }) {
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
            <Meter key={clock.kind} clock={clock} fetchedAt={base} now={now} />
          ))}
        </div>
      )}
    </RailCard>
  );
}

export function RequesterCard({ ticket }: { ticket: TicketView }) {
  return (
    <RailCard caption="Requester">
      {ticket.requester ? (
        <div className="flex flex-col">
          <span className="text-xms-ink font-medium">{ticket.requester.display_name}</span>
          <span className="xms-mono text-xms-label text-[12px]">{ticket.requester.email}</span>
        </div>
      ) : (
        <p className="text-xms-muted">No requester recorded.</p>
      )}
      <p className="text-xms-label mt-2 text-[12px]">
        Source {ticket.source}, created by {ticket.created_by_name || "unknown"}.
      </p>
    </RailCard>
  );
}

export function WatchCard({ ticketKey, watching = true }: { ticketKey: string; watching?: boolean }) {
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
    <RailCard
      caption="Watching"
      action={
        <button
          type="button"
          disabled={isLoading}
          onClick={() =>
            watch({ key: ticketKey, muted: !muted })
              .unwrap()
              .then((result) => setMuted(result.muted))
              .catch((error) => push({ title: "Not saved", detail: describeError(apiError(error)), tone: "error" }))
          }
          className="text-xms-accent hover:underline"
        >
          {muted ? "Watch" : "Unwatch"}
        </button>
      }
    >
      <p className="text-xms-label text-[12px]">
        {muted
          ? "You will not be notified about this ticket."
          : "You get replies, notes and state changes in your feed."}
      </p>
    </RailCard>
  );
}
