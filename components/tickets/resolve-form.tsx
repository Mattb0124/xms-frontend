"use client";

import { useMemo, useState } from "react";
import { INPUT } from "@/components/admin/primitives";
import { CloseDisciplineChecklist, type DisciplineItem } from "@/components/xms/close-discipline-checklist";
import { isNoSolutionCode, RESOLUTION_CODES } from "@/lib/tickets/vocab";
import type { ResolutionBody } from "@/redux/ticketsApi";

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
export function disciplineItems(draft: ResolveDraft, requires: string[], loggedMinutes = 0): DisciplineItem[] {
  const items: DisciplineItem[] = [];
  if (requires.includes("resolution")) {
    items.push({ key: "resolution_code", label: "Resolution code", done: draft.code !== "" });
    items.push({ key: "notes", label: "Resolution notes", done: draft.notes.trim() !== "" });
  }
  if (requires.includes("solution_link")) {
    const waived = isNoSolutionCode(draft.code);
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
  onSubmit: (draft: ResolveDraft) => void | Promise<void>;
  onCancel: () => void;
  pending?: boolean;
  /** Items the server reported missing on the last attempt, shown under the checklist. */
  serverMissing?: string[];
  targetLabel: string;
}

/** The Resolve sheet: code, notes, candidate, exemption, and the checklist that gates Submit. */
export function ResolveForm({
  requires,
  loggedMinutes = 0,
  onSubmit,
  onCancel,
  pending,
  serverMissing,
  targetLabel,
}: ResolveFormProps) {
  const [draft, setDraft] = useState<ResolveDraft>(EMPTY_RESOLVE);
  const items = useMemo(() => disciplineItems(draft, requires, loggedMinutes), [draft, requires, loggedMinutes]);
  const ready = items.every((item) => item.done);
  return (
    <form
      className="flex flex-col gap-3"
      aria-label={`Move to ${targetLabel}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) void onSubmit(draft);
      }}
    >
      <label className="flex flex-col gap-1 text-[12px]">
        <span className="text-xms-label">Resolution code</span>
        <select
          aria-label="Resolution code"
          value={draft.code}
          onChange={(event) => setDraft({ ...draft, code: event.target.value })}
          className={INPUT}
        >
          <option value="">Choose a code</option>
          {RESOLUTION_CODES.map((code) => (
            <option key={code.key} value={code.key}>
              {code.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[12px]">
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
        <div className="flex flex-col gap-2 text-[12px]">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              aria-label="Propose a new article from this ticket"
              checked={draft.solutionCandidate}
              onChange={(event) => setDraft({ ...draft, solutionCandidate: event.target.checked })}
            />
            <span className="text-xms-ink">Propose a new article from this ticket</span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xms-label">Or the solution article id</span>
            <input
              aria-label="Solution article id"
              value={draft.solutionArticleId}
              onChange={(event) => setDraft({ ...draft, solutionArticleId: event.target.value })}
              className={`${INPUT} xms-mono`}
              placeholder="uuid of the article (rail lands with the knowledge base)"
            />
          </label>
        </div>
      ) : null}
      {requires.includes("time_logged") && loggedMinutes === 0 ? (
        <label className="flex flex-col gap-1 text-[12px]">
          <span className="text-xms-label">Time exemption reason (no time logged yet)</span>
          <input
            aria-label="Time exemption reason"
            value={draft.timeExemptionReason}
            onChange={(event) => setDraft({ ...draft, timeExemptionReason: event.target.value })}
            className={INPUT}
          />
        </label>
      ) : null}
      <CloseDisciplineChecklist items={items} />
      {serverMissing && serverMissing.length > 0 ? (
        <p role="alert" className="text-[12px] text-[color:var(--state-overdue-text)]">
          The server still needs: {serverMissing.join(", ")}.
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="border-xms-line text-xms-body h-[32px] rounded-[4px] border px-3 text-[13px]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!ready || pending}
          className="bg-xms-accent hover:bg-xms-accent-hover h-[32px] rounded-[4px] px-3 text-[13px] font-medium text-white disabled:opacity-50"
        >
          Move to {targetLabel}
        </button>
      </div>
    </form>
  );
}
