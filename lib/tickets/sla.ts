import { formatSla, type SlaDisplay, type SlaSnapshot } from "@/components/xms/sla-value";

/** One SLA clock as the API computes it (Ticket Management technical 5). */
export interface ClockView {
  kind: "response" | "resolution";
  dueAt: string;
  /** Negative once overdue; frozen while paused. */
  remainingMinutes: number;
  paused: boolean;
  breached: boolean;
  met: boolean;
  targetMinutes: number;
  pausedTotalMinutes: number;
}

export interface TicketSla {
  response?: ClockView;
  resolution?: ClockView;
}

/** The snapshot the SlaValue and MeterBar read: the server's clock, nothing derived locally except the countdown. */
export function clockSnapshot(clock: ClockView | undefined): SlaSnapshot {
  if (!clock) return { dueAt: null };
  return {
    dueAt: clock.dueAt,
    paused: clock.paused,
    breached: clock.breached,
    met: clock.met,
    targetMinutes: clock.targetMinutes,
  };
}

export function clockDisplay(clock: ClockView | undefined, now: Date = new Date()): SlaDisplay {
  return formatSla(clockSnapshot(clock), now);
}

/**
 * The clock a list row shows: the live one with the least time left; a met
 * response clock defers to the resolution clock; both met means Met.
 */
export function tighterClock(sla: TicketSla | undefined): ClockView | undefined {
  if (!sla) return undefined;
  const live = [sla.response, sla.resolution].filter((clock): clock is ClockView => Boolean(clock) && !clock!.met);
  if (live.length === 0) return sla.resolution ?? sla.response;
  return live.sort((a, b) => a.remainingMinutes - b.remainingMinutes)[0];
}

/**
 * Remaining minutes counted down locally since the response was fetched.
 * A paused clock does not move; the server value is re-read on the next poll.
 */
export function localRemainingMinutes(clock: ClockView, fetchedAt: Date, now: Date = new Date()): number {
  if (clock.paused || clock.met) return clock.remainingMinutes;
  const elapsed = Math.floor((now.getTime() - fetchedAt.getTime()) / 60_000);
  return clock.remainingMinutes - Math.max(0, elapsed);
}

/** Elapsed share of the window for the meter, 0 to 100 (over 100 reads as breached). */
export function meterPercent(clock: ClockView, fetchedAt: Date, now: Date = new Date()): number {
  if (clock.targetMinutes <= 0) return 0;
  const remaining = localRemainingMinutes(clock, fetchedAt, now);
  const elapsed = clock.targetMinutes - remaining;
  return Math.max(0, Math.min(100, (elapsed / clock.targetMinutes) * 100));
}

/** "3h 12m of 24h left" for the rail; "met 15:36" once met; "breached by 40m" once latched. */
export function meterCaption(clock: ClockView, fetchedAt: Date, now: Date = new Date()): string {
  const label = clock.kind === "response" ? "Response" : "Resolution";
  if (clock.met) return `${label} met`;
  const remaining = localRemainingMinutes(clock, fetchedAt, now);
  if (clock.breached || remaining < 0) return `${label} breached by ${formatMinutes(Math.abs(remaining))}`;
  const suffix = clock.paused ? " (paused)" : "";
  return `${label} ${formatMinutes(remaining)} of ${formatMinutes(clock.targetMinutes)} left${suffix}`;
}

/**
 * The meter's second line: target, elapsed and remaining, which the
 * wireframe (section 3.2, callout TM-05) asks every service level meter to
 * show and the built rail did not (frontend review finding 21).
 */
export function meterDetail(clock: ClockView, fetchedAt: Date, now: Date = new Date()): string {
  const target = `Target ${formatMinutes(clock.targetMinutes)}`;
  const remaining = localRemainingMinutes(clock, fetchedAt, now);
  if (clock.breached || remaining < 0) return `${target}, breached by ${formatMinutes(Math.abs(remaining))}`;
  if (clock.met) return `${target}, met with ${formatMinutes(remaining)} to spare`;
  const elapsed = Math.max(0, clock.targetMinutes - remaining);
  return `${target}, elapsed ${formatMinutes(elapsed)}, ${formatMinutes(remaining)} left`;
}

/**
 * The grey segment's caption with its reason: "Grey segment is 2h 10m
 * paused, awaiting client." The reason is the ticket's own state, since a
 * clock is paused precisely because the ticket sits in a pausing state; a
 * clock that ran again keeps the total without claiming a current reason.
 */
export function pauseCaption(clock: ClockView, reason?: string): string | null {
  if (clock.pausedTotalMinutes <= 0) return null;
  const paused = formatMinutes(clock.pausedTotalMinutes);
  const because = clock.paused && reason ? `, ${reason.toLowerCase()}` : "";
  return `Grey segment is ${paused} paused${because}.`;
}

export function formatMinutes(total: number): string {
  const abs = Math.max(0, Math.round(total));
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes < 10 ? `0${minutes}` : minutes}m`;
}
