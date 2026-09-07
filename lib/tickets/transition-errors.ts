import type { ToastTone } from "@/components/xms/toast";
import { apiError, describeError, type ApiError } from "@/lib/admin/api-error";

/** The typed 409 bodies of POST /tickets/:key/transitions (Ticket Management technical 3.3). */
export interface TransitionError extends ApiError {
  items?: string[];
  from?: string;
  to?: string;
  allowed?: string[];
  version?: number;
}

export const MISSING_ITEM_COPY: Record<string, string> = {
  resolution_code: "a resolution code",
  resolution_notes: "resolution notes",
  solution_link: "a solution link or a new-article candidate",
  time_logged: "logged time or a time exemption reason",
  pause_reason: "a pause reason",
  unknown_resolution_code: "a resolution code from the catalog",
};

export interface ToastCopy {
  title: string;
  detail: string;
  tone: ToastTone;
  /** The record must be re-read from the server (state changed elsewhere, stale version). */
  reload: boolean;
}

export function transitionError(error: unknown): TransitionError {
  const parsed = apiError(error) as TransitionError;
  const data = (error as { data?: Record<string, unknown> })?.data;
  if (data && typeof data === "object") {
    if (Array.isArray(data.items)) parsed.items = data.items.map(String);
    if (typeof data.from === "string") parsed.from = data.from;
    if (typeof data.to === "string") parsed.to = data.to;
    if (Array.isArray(data.allowed)) parsed.allowed = data.allowed.map(String);
    if (typeof data.version === "number") parsed.version = data.version;
  }
  return parsed;
}

/** The toast for a failed transition, in words a consultant acts on. */
export function describeTransitionError(error: TransitionError): ToastCopy {
  switch (error.code) {
    case "missing_requirements": {
      const items = (error.items ?? []).map((item) => MISSING_ITEM_COPY[item] ?? item);
      return {
        title: "Not moved",
        detail: items.length > 0 ? `Still needed: ${items.join(", ")}.` : "Something required is missing.",
        tone: "error",
        reload: false,
      };
    }
    case "invalid_transition":
      return {
        title: "Status changed elsewhere",
        detail: error.from
          ? `The ticket is now ${humanState(error.from)}; the list of allowed moves has been reloaded.`
          : "That move is no longer allowed; the record has been reloaded.",
        tone: "error",
        reload: true,
      };
    case "stale_version":
      return {
        title: "Reloaded",
        detail: "Someone else changed this ticket. It has been reloaded; try again.",
        tone: "error",
        reload: true,
      };
    case "ticket_closed":
      return {
        title: "Read only",
        detail: "Closed and cancelled tickets cannot be edited.",
        tone: "error",
        reload: true,
      };
    default:
      return { title: "Not saved", detail: describeError(error), tone: "error", reload: false };
  }
}

export function humanState(state: string): string {
  const words = state.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
