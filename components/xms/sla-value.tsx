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

/** Pure formatting of a server-provided clock. The browser only counts down. */
export function formatSla(snapshot: SlaSnapshot, now: Date = new Date()): SlaDisplay {
  if (!snapshot.dueAt) return { label: "No SLA", tone: "none" };
  if (snapshot.met) return { label: "Met", tone: "met" };
  if (snapshot.breached) return { label: "Breached", tone: "breach" };
  const remainingMs = new Date(snapshot.dueAt).getTime() - now.getTime();
  const abs = Math.abs(remainingMs);
  const hours = Math.floor(abs / 3_600_000);
  const minutes = Math.floor((abs % 3_600_000) / 60_000);
  const body = hours >= 24 ? `${Math.floor(hours / 24)}d ${pad(hours % 24)}h` : `${hours}h ${pad(minutes)}m`;
  if (snapshot.paused) return { label: `${body} paused`, tone: "paused" };
  if (remainingMs < 0) return { label: `-${body}`, tone: "breach" };
  const atRisk = snapshot.targetMinutes
    ? remainingMs < snapshot.targetMinutes * 60_000 * 0.25
    : remainingMs < 3_600_000;
  return { label: body, tone: atRisk ? "warn" : "ok" };
}

const TONE_CLASS: Record<SlaTone, string> = {
  ok: "text-xms-ink",
  warn: "text-[color:var(--state-needs-input-text)]",
  breach: "text-[color:var(--state-overdue-text)]",
  paused: "text-xms-sla-paused",
  met: "text-[color:var(--state-complete-text)]",
  none: "text-xms-muted",
};

export interface SlaValueProps {
  snapshot: SlaSnapshot;
  /** Re-render interval in ms; 0 disables ticking (tests, exports). */
  tickMs?: number;
  now?: Date;
  className?: string;
}

/** Mono SLA value that counts down between polls; tone follows the signal trios. */
export function SlaValue({ snapshot, tickMs = 30_000, now, className }: SlaValueProps) {
  const [clock, setClock] = useState<Date>(() => now ?? new Date());
  useEffect(() => {
    if (!tickMs || now) return;
    const id = window.setInterval(() => setClock(new Date()), tickMs);
    return () => window.clearInterval(id);
  }, [tickMs, now]);
  const display = formatSla(snapshot, now ?? clock);
  return (
    <span
      className={cn("xms-mono text-[13px] tabular-nums", TONE_CLASS[display.tone], className)}
      data-tone={display.tone}
    >
      {display.label}
    </span>
  );
}
