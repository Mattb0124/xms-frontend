import { xmsApi } from "@/redux/api";

/**
 * One action over many cases (TM-16, `POST /v1/tickets/bulk`).
 *
 * Each case is named with the version the reader read, and each comes back
 * with its own outcome, because a batch is not a transaction: some rows move
 * and some are refused, and the screen has to say which. The server runs every
 * one through the single-case path, so the audit, the SLA clocks and the
 * change-window rules apply exactly as they would one at a time.
 */
export type BulkAction = "assign" | "set_group" | "set_priority" | "transition" | "close" | "comment" | "work_note";

export type BulkOutcomeKind = "ok" | "version_conflict" | "refused" | "not_found";

export interface BulkOutcome {
  key: string;
  outcome: BulkOutcomeKind;
  /** The typed refusal the single-case route would have given. */
  code?: string;
  detail?: Record<string, unknown>;
  version?: number;
}

export interface BulkResult {
  action: BulkAction;
  requested: number;
  succeeded: number;
  failed: number;
  results: BulkOutcome[];
}

export interface BulkBody {
  action: BulkAction;
  tickets: Array<{ key: string; version: number }>;
  assignee_id?: string | null;
  group_id?: string | null;
  priority?: string;
  to?: string;
  pause_reason?: string;
  note?: string;
  change_window_reason?: string;
  resolution?: Record<string, unknown>;
  body?: string;
}

/** What a reader is told about one refused case, in the words of the refusal. */
export function outcomeLine(outcome: BulkOutcome): string {
  if (outcome.outcome === "ok") return "done";
  if (outcome.outcome === "not_found") return "no longer there";
  if (outcome.outcome === "version_conflict") return "changed while you were looking; reload and try again";
  switch (outcome.code) {
    case "outside_change_window":
      return "outside its change window";
    case "transition_not_allowed":
      return "that state is not allowed from here";
    case "forbidden":
      return "you may not do that on this case";
    case "ticket_closed":
      return "already closed";
    default:
      return outcome.code ? outcome.code.replace(/_/g, " ") : "refused";
  }
}

export const bulkApi = xmsApi.injectEndpoints({
  endpoints: (build) => ({
    applyBulk: build.mutation<BulkResult, BulkBody>({
      query: (body) => ({ url: "/v1/tickets/bulk", method: "POST", body }),
      invalidatesTags: ["Tickets"],
    }),
  }),
});

export const { useApplyBulkMutation } = bulkApi;
