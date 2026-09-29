/**
 * Change windows on the desk (TM-10, TM-18): the calendar's month grammar
 * and the four refusals a transition can earn from the window rules.
 *
 * The server is the only judge of whether a change may go out. Everything
 * here reads what it said and puts it in words; nothing recomputes whether
 * an instant is inside a window, because `GET /v1/change-calendar/at`
 * answers that from the same rules the transition gate uses.
 */
import type { FreezeWindow } from "@/redux/ticketsApi";

/**
 * The refusals the window rules answer with.
 *
 * `change_freeze` and `change_conflict` come from scheduling: functional
 * 5.13 calls them warnings that must be acknowledged with a reason, so any
 * worker may carry them with one. `outside_change_window` and
 * `change_window_required` come from entering the state the machine marks
 * `deploy`, and only `tickets:override-change-window` plus a reason gets
 * through those.
 */
export const ACKNOWLEDGE_CODES = ["change_freeze", "change_conflict"] as const;
export const OVERRIDE_CODES = ["outside_change_window", "change_window_required"] as const;
export const CHANGE_WINDOW_CODES = [...ACKNOWLEDGE_CODES, ...OVERRIDE_CODES] as const;

export type ChangeWindowCode = (typeof CHANGE_WINDOW_CODES)[number];

/** The permission that carries a change out of its window, as the API names it. */
export const OVERRIDE_PERMISSION = "tickets:override-change-window";

export interface ChangeWindowConflict {
  key: string;
  group_name: string;
}

/** A refusal, as the 409 body carries it. Absent detail is null, never undefined. */
export interface ChangeWindowRefusal {
  code: ChangeWindowCode;
  /** Whether a reason alone carries it, or the permission is needed too. */
  kind: "acknowledge" | "override";
  window: string | null;
  starts_at: string | null;
  ends_at: string | null;
  freeze: FreezeWindow | null;
  at: string | null;
  permission: string | null;
  conflicts: ChangeWindowConflict[];
}

export function isChangeWindowCode(code: string): code is ChangeWindowCode {
  return (CHANGE_WINDOW_CODES as readonly string[]).includes(code);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function freezeOf(value: unknown): FreezeWindow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const starts = text(row.starts_at);
  const ends = text(row.ends_at);
  if (!starts || !ends) return null;
  return { starts_at: starts, ends_at: ends, reason: text(row.reason) ?? undefined };
}

/**
 * The refusal out of an RTK Query error, or null when this is not one of the
 * four. The caller branches on the shape, never on the words.
 */
export function changeWindowRefusal(error: unknown): ChangeWindowRefusal | null {
  const data = (error as { data?: unknown })?.data;
  if (!data || typeof data !== "object") return null;
  const body = data as Record<string, unknown>;
  const code = typeof body.code === "string" ? body.code : "";
  if (!isChangeWindowCode(code)) return null;
  const conflicts = Array.isArray(body.conflicts)
    ? body.conflicts.flatMap((row) => {
        const entry = row as Record<string, unknown>;
        const key = text(entry.key);
        return key ? [{ key, group_name: text(entry.group_name) ?? "" }] : [];
      })
    : [];
  return {
    code,
    kind: (ACKNOWLEDGE_CODES as readonly string[]).includes(code) ? "acknowledge" : "override",
    window: text(body.window),
    starts_at: text(body.starts_at),
    ends_at: text(body.ends_at),
    freeze: freezeOf(body.freeze),
    at: text(body.at),
    permission: text(body.permission),
    conflicts,
  };
}

export const CHANGE_REASON_REQUIRED = "A reason is required, because a crossing nobody recorded is not a decision.";

/**
 * The sentence the sheet leads with. It names what is in the way, which is
 * the only thing a worker can act on: a freeze, another change holding the
 * same configuration item, or the fact that it is not the window right now.
 */
export function changeWindowTitle(refusal: ChangeWindowRefusal): string {
  switch (refusal.code) {
    case "change_freeze":
      return refusal.window ? `${refusal.window} is frozen over this change` : "This change falls inside a freeze";
    case "change_conflict":
      return "Another change already holds this configuration item";
    case "change_window_required":
      return "This ticket belongs to no change window";
    case "outside_change_window":
      return refusal.window ? `It is outside ${refusal.window}` : "It is outside the change window";
  }
}

/**
 * What the worker has to know to decide, in words: the reason on the freeze,
 * the tickets in the way, or what may be crossed and by whom.
 */
export function changeWindowDetail(refusal: ChangeWindowRefusal): string {
  switch (refusal.code) {
    case "change_freeze":
      return refusal.freeze?.reason
        ? `The freeze is there for: ${refusal.freeze.reason}. Scheduling into it has to be acknowledged with a reason.`
        : "Scheduling into a freeze has to be acknowledged with a reason.";
    case "change_conflict": {
      const keys = refusal.conflicts.map((row) => row.key).join(", ");
      return keys === ""
        ? "Another change holds it in an overlapping window. Acknowledging this takes a reason."
        : `${keys} holds it in an overlapping window. Acknowledging this takes a reason.`;
    }
    case "change_window_required":
      return "Put it in a change window, or record why it goes out without one.";
    case "outside_change_window":
      return refusal.freeze
        ? "The window is frozen right now, so nothing may be implemented under it."
        : "The window is not open right now, so nothing may be implemented under it.";
  }
}

/** The month a calendar page covers, as the instants the range route takes. */
export function monthRange(anchor: Date): { from: string; to: string } {
  const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
  const end = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1));
  return { from: start.toISOString(), to: end.toISOString() };
}

export function shiftMonth(anchor: Date, months: number): Date {
  return new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + months, 1));
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function monthLabel(anchor: Date): string {
  return `${MONTHS[anchor.getUTCMonth()]} ${anchor.getUTCFullYear()}`;
}

/**
 * The next window to open after an instant, among the ones the calendar
 * answered with. A window already running is not the next one: the "right
 * now" line above says whether the desk is inside one.
 */
export function nextWindow<T extends { starts_at: string }>(windows: readonly T[], now: Date): T | undefined {
  return [...windows]
    .filter((window) => Date.parse(window.starts_at) > now.getTime())
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))[0];
}

/** Whole days from an instant, rounded down; negative once the instant has passed. */
export function daysUntil(instant: string, now: Date): number {
  return Math.floor((Date.parse(instant) - now.getTime()) / 86_400_000);
}
