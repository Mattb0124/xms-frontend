"use client";

import { useMemo, useState } from "react";
import { INPUT } from "@/components/admin/primitives";
import { SolutionPicker, type PickedSolution } from "@/components/tickets/solution-picker";
import { CloseDisciplineChecklist, type DisciplineItem } from "@/components/xms/close-discipline-checklist";
import { isNoSolutionCode, RESOLUTION_CODES, type ResolutionCode } from "@/lib/tickets/vocab";
import type { SearchHit } from "@/redux/knowledgeApi";
import type { ExemptionReason, ResolutionBody } from "@/redux/ticketsApi";

/**
 * The gate's own fallback (TB-02), mirroring the server's: a browser that
 * could not read the account's catalog offers the five the spec names rather
 * than a free-text box, because free text is exactly what this replaced.
 */
export const DEFAULT_EXEMPTION_REASONS: ExemptionReason[] = [
  { key: "duplicate", label: "Duplicate of another ticket" },
  { key: "cancelled_by_client", label: "Cancelled by the client" },
  { key: "resolved_by_client", label: "Resolved by the client" },
  { key: "administrative_close", label: "Administrative close" },
  { key: "merged", label: "Merged into another ticket" },
];

export const DEFAULT_MIN_NOTES_CHARS = 40;

export interface ResolveDraft {
  code: string;
  notes: string;
  solutionCandidate: boolean;
  solutionArticleId: string;
  timeExemptionReason: string;
}

export const EMPTY_RESOLVE: ResolveDraft = {
  code: "",
  notes: "",
  solutionCandidate: false,
  solutionArticleId: "",
  timeExemptionReason: "",
};

/**
 * The client-side mirror of the close discipline (Domain Model invariant 6):
 * which items the transition still needs, given what the machine requires.
 * The server re-checks and answers `missing_requirements`; this only stops
 * an obviously incomplete submit.
 */
export function disciplineItems(
  draft: ResolveDraft,
  requires: string[],
  loggedMinutes = 0,
  codes: ResolutionCode[] = RESOLUTION_CODES,
  minNotesChars = DEFAULT_MIN_NOTES_CHARS,
): DisciplineItem[] {
  const items: DisciplineItem[] = [];
  if (requires.includes("resolution")) {
    items.push({ key: "resolution_code", label: "Resolution code", done: draft.code !== "" });
    const notes = draft.notes.trim();
    // The bar is shown while it is unmet, so the reader learns it from the
    // checklist rather than from a refusal (TB-02).
    items.push({
      key: "notes",
      label: "Resolution notes",
      done: notes.length >= minNotesChars,
      detail: notes.length >= minNotesChars ? undefined : `${notes.length} of ${minNotesChars} characters`,
    });
  }
  if (requires.includes("solution_link")) {
    const waived = isNoSolutionCode(draft.code, codes);
    items.push({
      key: "solution",
      label: "Solution link or new-article candidate",
      done: waived || draft.solutionCandidate || draft.solutionArticleId.trim() !== "",
      detail: waived ? "waived by the resolution code" : undefined,
    });
  }
  if (requires.includes("time_logged")) {
    items.push({
      key: "time",
      label: "Time logged or exemption reason",
      done: loggedMinutes > 0 || draft.timeExemptionReason.trim() !== "",
      detail: loggedMinutes > 0 ? `${loggedMinutes} min logged` : undefined,
    });
  }
  return items;
}

export function toResolutionBody(draft: ResolveDraft): ResolutionBody {
  return {
    code: draft.code || undefined,
    notes: draft.notes.trim() || undefined,
    solution_article_id: draft.solutionArticleId.trim() || undefined,
    solution_candidate: draft.solutionCandidate || undefined,
    time_exemption_reason: draft.timeExemptionReason.trim() || undefined,
  };
}

export interface ResolveFormProps {
  requires: string[];
  loggedMinutes?: number;
  /** The exemption reasons this account accepts (TB-02); the built-in five are the fallback. */
  exemptionReasons?: ExemptionReason[];
  /** The account's resolution-notes completeness bar (TB-02). */
  minNotesChars?: number;
  onSubmit: (draft: ResolveDraft) => void | Promise<void>;
  onCancel: () => void;
  pending?: boolean;
  /** Items the server reported missing on the last attempt, shown under the checklist. */
  serverMissing?: string[];
  targetLabel: string;
  /** Resolution codes from the account catalog; the seed vocabulary is the fallback. */
  codes?: ResolutionCode[];
  /** Articles the Solutions rail already suggested, offered before any search. */
  suggested?: SearchHit[];
  /** A solution pre-selected from the rail. */
  preselected?: PickedSolution | null;
}

/** The Resolve sheet: code, notes, solution picker or candidate, exemption, and the checklist that gates Submit. */
export function ResolveForm({
  requires,
  loggedMinutes = 0,
  exemptionReasons = DEFAULT_EXEMPTION_REASONS,
  minNotesChars = DEFAULT_MIN_NOTES_CHARS,
  onSubmit,
  onCancel,
  pending,
  serverMissing,
  targetLabel,
  codes = RESOLUTION_CODES,
  suggested = [],
  preselected = null,
}: ResolveFormProps) {
  const [draft, setDraft] = useState<ResolveDraft>({ ...EMPTY_RESOLVE, solutionArticleId: preselected?.id ?? "" });
  const [picked, setPicked] = useState<PickedSolution | null>(preselected);
  const items = useMemo(
    () => disciplineItems(draft, requires, loggedMinutes, codes, minNotesChars),
    [draft, requires, loggedMinutes, codes, minNotesChars],
  );
  const ready = items.every((item) => item.done);
  const waived = isNoSolutionCode(draft.code, codes);
  return (
    <form
      className="flex flex-col gap-3"
      aria-label={`Move to ${targetLabel}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) void onSubmit(draft);
      }}
    >
      <label className="flex flex-col gap-1 text-[14px]">
        <span className="text-xms-label">Resolution code</span>
        <select
          aria-label="Resolution code"
          value={draft.code}
          onChange={(event) => setDraft({ ...draft, code: event.target.value })}
          className={INPUT}
        >
          <option value="">Choose a code</option>
          {codes.map((code) => (
            <option key={code.key} value={code.key}>
              {code.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[14px]">
        <span className="text-xms-label">Resolution notes</span>
        <textarea
          aria-label="Resolution notes"
          rows={3}
          value={draft.notes}
          onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
          className={`${INPUT} h-auto py-2`}
        />
      </label>
      {requires.includes("solution_link") ? (
        <div className="flex flex-col gap-2 text-[14px]" data-testid="solution-section">
          {waived ? (
            <p className="text-xms-label">This code needs no solution link.</p>
          ) : (
            <>
              <span className="text-xms-label">Solution article</span>
              <SolutionPicker
                value={picked}
                suggested={suggested}
                disabled={draft.solutionCandidate}
                onChange={(value) => {
                  setPicked(value);
                  setDraft({ ...draft, solutionArticleId: value?.id ?? "" });
                }}
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  aria-label="Propose a new article from this ticket"
                  checked={draft.solutionCandidate}
                  onChange={(event) => setDraft({ ...draft, solutionCandidate: event.target.checked })}
                />
                <span className="text-xms-ink">Or propose a new article from this ticket</span>
              </label>
            </>
          )}
        </div>
      ) : null}
      {requires.includes("time_logged") && loggedMinutes === 0 ? (
        <label className="flex flex-col gap-1 text-[14px]">
          <span className="text-xms-label">Time exemption reason (no time logged yet)</span>
          <select
            aria-label="Time exemption reason"
            value={draft.timeExemptionReason}
            onChange={(event) => setDraft({ ...draft, timeExemptionReason: event.target.value })}
            className={INPUT}
          >
            <option value="">Choose a reason</option>
            {exemptionReasons.map((reason) => (
              <option key={reason.key} value={reason.key}>
                {reason.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <CloseDisciplineChecklist items={items} />
      {serverMissing && serverMissing.length > 0 ? (
        <p role="alert" className="text-[14px] text-[color:var(--state-overdue-text)]">
          The server still needs: {serverMissing.join(", ")}.
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="border-xms-line text-xms-body h-[32px] rounded-control border px-3 text-[14px]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!ready || pending}
          className="bg-xms-accent hover:bg-xms-accent-hover h-[32px] rounded-control px-3 text-[14px] font-medium text-white disabled:opacity-50"
        >
          Move to {targetLabel}
        </button>
      </div>
    </form>
  );
}
