"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type SlaTone = "ok" | "warn" | "breach" | "paused" | "met" | "none";

export interface SlaSnapshot {
  dueAt: string | null;
  paused?: boolean;
  breached?: boolean;
  met?: boolean;
  /** Target window in minutes, used to decide "at risk" (under 25 percent left). */
  targetMinutes?: number;
}

export interface SlaDisplay {
  label: string;
  tone: SlaTone;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Pure formatting of a server-provided clock. The browser only counts down.
 *
 * The value is always the time remaining, never the time elapsed, and an
 * overdue clock says how far past due it is rather than the word "Breached"
 * (render 08's column reads "-38m", "3h 12m", "paused"). A word says the
 * clock has gone; the number says by how much, which is what decides which
 * breach is picked up first.
 *
 * The word is kept for the case the number cannot answer: a latched breach
 * whose due time is not in the past, which is what a reopened ticket carries
 * (TM-05, TM-07), and a breach with no due time at all.
 */
export function formatSla(snapshot: SlaSnapshot, now: Date = new Date()): SlaDisplay {
  if (!snapshot.dueAt)
    return { label: snapshot.breached ? "Breached" : "No SLA", tone: snapshot.breached ? "breach" : "none" };
  if (snapshot.met) return { label: "Met", tone: "met" };
  const remainingMs = new Date(snapshot.dueAt).getTime() - now.getTime();
  const abs = Math.abs(remainingMs);
  const hours = Math.floor(abs / 3_600_000);
  const minutes = Math.floor((abs % 3_600_000) / 60_000);
  const body = hours >= 24 ? `${Math.floor(hours / 24)}d ${pad(hours % 24)}h` : `${hours}h ${pad(minutes)}m`;
  if (snapshot.paused) return { label: "paused", tone: "paused" };
  if (remainingMs < 0) return { label: `-${body}`, tone: "breach" };
  if (snapshot.breached) return { label: "Breached", tone: "breach" };
  const atRisk = snapshot.targetMinutes
    ? remainingMs < snapshot.targetMinutes * 60_000 * 0.25
    : remainingMs < 3_600_000;
  return { label: body, tone: atRisk ? "warn" : "ok" };
}

const TONE_CLASS: Record<SlaTone, string> = {
  ok: "text-xms-ink",
  warn: "text-[color:var(--xms-sla-warn)]",
  breach: "text-[color:var(--state-overdue-text)]",
  paused: "text-xms-sla-paused",
  met: "text-[color:var(--state-complete-text)]",
  none: "text-xms-muted",
};

const TONE_DOT: Record<SlaTone, string> = {
  ok: "bg-[color:var(--xms-account-none)]",
  warn: "bg-[color:var(--xms-sla-warn)]",
  breach: "bg-[color:var(--xms-sla-breach)]",
  paused: "bg-[color:var(--xms-sla-paused)]",
  met: "bg-[color:var(--state-complete-text)]",
  none: "bg-[color:var(--xms-sla-paused)]",
};

export interface SlaValueProps {
  snapshot: SlaSnapshot;
  /** Re-render interval in ms; 0 disables ticking (tests, exports). */
  tickMs?: number;
  now?: Date;
  /**
   * Draw the signal as an 8px dot before the value and keep the value in ink,
   * which is how render 08 shows the clock on My work's Needs attention list.
   * In a table cell the value carries the colour itself.
   */
  dot?: boolean;
  /**
   * Say what the number is counting. Render 02 reads "Resolution 3h 12m
   * left" in the record bar, where there is room for the word and only one
   * clock to read; a list column stays bare, because the header names it and
   * the word would repeat down every row.
   */
  verbose?: boolean;
  /**
   * The clock's own name, spoken before the number: the prototype's record bar
   * reads "Resolution 3h 12m left" as one mono run inside the chip, with the
   * signal on the dot alone. A list column passes nothing, because its header
   * already names the clock.
   */
  kind?: string;
  className?: string;
}

/** Mono SLA value that counts down between polls; tone follows the signal trios. */
export function SlaValue({ snapshot, tickMs = 30_000, now, dot, verbose, kind, className }: SlaValueProps) {
  const [clock, setClock] = useState<Date>(() => now ?? new Date());
  useEffect(() => {
    if (!tickMs || now) return;
    const id = window.setInterval(() => setClock(new Date()), tickMs);
    return () => window.clearInterval(id);
  }, [tickMs, now]);
  const display = formatSla(snapshot, now ?? clock);
  const word = !verbose ? "" : display.tone === "ok" || display.tone === "warn" ? " left" : "";
  // Spoken, a breach is breached by an amount. The bare "-49d 09h" is the
  // list column's treatment, where the minus sign is read against a column of
  // numbers; in a sentence it reads as a negative amount of time left.
  const spoken =
    verbose && display.tone === "breach" && display.label.startsWith("-")
      ? `breached by ${display.label.slice(1)}`
      : `${display.label}${word}`;
  return (
    <span
      className={cn(
        "xms-mono text-[13px] tabular-nums",
        dot ? "text-xms-ink inline-flex items-center gap-[7px] text-[12px]" : TONE_CLASS[display.tone],
        className,
      )}
      data-tone={display.tone}
    >
      {dot ? <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-[999px]", TONE_DOT[display.tone])} /> : null}
      {kind ? `${kind} ${spoken}` : spoken}
    </span>
  );
}
