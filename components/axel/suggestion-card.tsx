"use client";

import { useEffect, useState, type ReactNode } from "react";
import { INPUT, InlineError } from "@/components/admin/primitives";
import { apiError } from "@/lib/admin/api-error";
import {
  CAPABILITY_LABEL,
  describeDecisionError,
  formatConfidence,
  REJECT_REASON_LABEL,
  withheldLine,
} from "@/lib/axel/copy";
import { useTrack } from "@/lib/telemetry/provider";
import { LEVELS, TICKET_TYPES } from "@/lib/tickets/vocab";
import { cn } from "@/lib/utils";
import {
  REJECT_REASONS,
  useDecideMutation,
  useFeedbackMutation,
  type ClassifyPayload,
  type DraftReplyPayload,
  type DuplicatePayload,
  type PrioritisePayload,
  type RejectReason,
  type SuggestionView,
  type SummarisePayload,
  type UserDecision,
} from "@/redux/aiApi";

export interface AxelSuggestionCardProps {
  suggestion: SuggestionView;
  /** The ticket key, so a decision refetches the record and its timeline. */
  ticketKey?: string;
  /** Whether the reader holds the permission the capability's decision needs. */
  canDecide: boolean;
  /** Where the card is rendered; a telemetry fact, never copy. */
  source: "strip" | "panel";
  /** Called after a draft reply is accepted so the composer can take the text. */
  onDraftAccepted?: (text: string) => void;
  /** Called with the suggestion carrying its decision once the API confirmed it. */
  onDecided?: (suggestion: SuggestionView) => void;
  className?: string;
}

const SMALL_BUTTON = "h-[28px] rounded-[4px] px-3 text-[12px] font-medium disabled:opacity-50";
const PRIMARY = `${SMALL_BUTTON} bg-xms-accent hover:bg-xms-accent-hover text-white`;
const QUIET = `${SMALL_BUTTON} border-xms-ai-border text-xms-body border`;

function levelLabel(level: string): string {
  return LEVELS.find((entry) => entry.value === level)?.label ?? level;
}

function typeLabel(type: string | undefined): string | null {
  if (!type) return null;
  return TICKET_TYPES.find((entry) => entry.value === type)?.label ?? type;
}

/** The read-only body per capability (functional spec 5.4 and 5.5). */
function SuggestionBody({ suggestion }: { suggestion: SuggestionView }) {
  switch (suggestion.capability) {
    case "classify": {
      const payload = suggestion.payload as unknown as ClassifyPayload;
      const type = typeLabel(payload.ticket_type);
      const reasons = Object.entries(payload.reasons ?? {});
      return (
        <div className="flex flex-col gap-1">
          <p className="text-xms-ink font-medium">
            Category → {payload.category}
            {type ? <span className="text-xms-body font-normal"> · {type}</span> : null}
          </p>
          {payload.ci_ids?.length ? (
            <p className="xms-mono text-xms-label text-[11px]">CI {payload.ci_ids.join(", ")}</p>
          ) : null}
          {reasons.length ? (
            <ul className="text-xms-body flex flex-col gap-[2px]">
              {reasons.map(([field, reason]) => (
                <li key={field}>
                  <span className="text-xms-label">{field.replace(/_/g, " ")}:</span> {reason}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      );
    }
    case "prioritise": {
      const payload = suggestion.payload as unknown as PrioritisePayload;
      return (
        <div className="flex flex-col gap-1">
          <p className="text-xms-ink font-medium">
            Impact {levelLabel(payload.impact)} · Urgency {levelLabel(payload.urgency)}
            {payload.priority ? (
              <span className="text-xms-body font-normal"> · {payload.priority.toUpperCase()}</span>
            ) : null}
          </p>
          {payload.reason ? <p className="text-xms-body">{payload.reason}</p> : null}
        </div>
      );
    }
    case "duplicate": {
      const payload = suggestion.payload as unknown as DuplicatePayload;
      return (
        <div className="flex flex-col gap-1">
          <p className="text-xms-ink font-medium">
            {payload.merge_into ? "Possible duplicate; merge into the marked ticket" : "Possible duplicates"}
          </p>
          <ul className="flex flex-col gap-1">
            {payload.candidates.map((candidate) => (
              <li key={candidate.ticket_id} className="flex flex-wrap items-baseline gap-2">
                <span className="xms-mono text-xms-accent text-[12px]">{candidate.ticket_id}</span>
                <span className="xms-mono text-xms-label text-[11px]">{formatConfidence(candidate.similarity)}</span>
                {candidate.ticket_id === payload.merge_into ? (
                  <span className="aix-state-pill" data-state="ready">
                    Merge target
                  </span>
                ) : null}
                <span className="text-xms-body basis-full">{candidate.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case "summarise": {
      const payload = suggestion.payload as unknown as SummarisePayload;
      const sections: Array<[string, string]> = [
        ["Situation", payload.situation],
        ["Done so far", payload.done],
        ["Waiting on", payload.waiting_on],
        ["Next step", payload.next_step],
      ];
      if (payload.risks) sections.push(["Risks", payload.risks]);
      const sources = payload.sources;
      return (
        <div className="flex flex-col gap-2">
          {sections.map(([title, text]) => (
            <div key={title}>
              <p className="xms-caption">{title}</p>
              <p className="text-xms-ink whitespace-pre-wrap">{text}</p>
            </div>
          ))}
          {sources ? (
            <p className="xms-mono text-xms-label text-[11px]">
              from {sources.comments} comments, {sources.work_notes} work notes, {sources.events} events
            </p>
          ) : null}
        </div>
      );
    }
    case "draft_reply": {
      const payload = suggestion.payload as unknown as DraftReplyPayload;
      return (
        <div className="flex flex-col gap-1">
          <p className="text-xms-ink whitespace-pre-wrap">{payload.text}</p>
          <p className="xms-mono text-xms-label text-[11px]">
            {payload.tone} tone
            {payload.citations?.length ? ` · cites ${payload.citations.length} article version(s)` : ""}
          </p>
        </div>
      );
    }
    default:
      return <p className="text-xms-body">This suggestion kind is not rendered yet.</p>;
  }
}

/** The editable fields per capability; the rest of the payload travels unchanged. */
function EditForm({
  suggestion,
  draft,
  onChange,
}: {
  suggestion: SuggestionView;
  draft: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const set = (key: string, value: unknown) => onChange({ ...draft, [key]: value });
  switch (suggestion.capability) {
    case "classify":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-xms-label">Category</span>
            <input
              aria-label="Category"
              className={INPUT}
              value={String(draft.category ?? "")}
              onChange={(event) => set("category", event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-xms-label">Type</span>
            <select
              aria-label="Type"
              className={INPUT}
              value={String(draft.ticket_type ?? "")}
              onChange={(event) => {
                const next = { ...draft };
                if (event.target.value) next.ticket_type = event.target.value;
                else delete next.ticket_type;
                onChange(next);
              }}
            >
              <option value="">Unchanged</option>
              {TICKET_TYPES.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      );
    case "prioritise":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          {(["impact", "urgency"] as const).map((field) => (
            <label key={field} className="flex flex-col gap-1 text-[12px]">
              <span className="text-xms-label">{field === "impact" ? "Impact" : "Urgency"}</span>
              <select
                aria-label={field === "impact" ? "Impact" : "Urgency"}
                className={INPUT}
                value={String(draft[field] ?? "")}
                onChange={(event) => set(field, event.target.value)}
              >
                {LEVELS.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      );
    case "duplicate": {
      const candidates = (draft.candidates as DuplicatePayload["candidates"]) ?? [];
      return (
        <fieldset className="flex flex-col gap-1 text-[12px]">
          <legend className="text-xms-label mb-1">Merge into</legend>
          {candidates.map((candidate) => (
            <label key={candidate.ticket_id} className="flex items-center gap-2">
              <input
                type="radio"
                name={`merge-${suggestion.id}`}
                checked={draft.merge_into === candidate.ticket_id}
                onChange={() => set("merge_into", candidate.ticket_id)}
              />
              <span className="xms-mono">{candidate.ticket_id}</span>
            </label>
          ))}
        </fieldset>
      );
    }
    case "draft_reply":
      return (
        <label className="flex flex-col gap-1 text-[12px]">
          <span className="text-xms-label">Reply text</span>
          <textarea
            aria-label="Reply text"
            rows={6}
            className={cn(INPUT, "h-auto resize-y py-2")}
            value={String(draft.text ?? "")}
            onChange={(event) => set("text", event.target.value)}
          />
        </label>
      );
    default:
      return null;
  }
}

function canEdit(capability: SuggestionView["capability"]): boolean {
  return (
    capability === "classify" ||
    capability === "prioritise" ||
    capability === "duplicate" ||
    capability === "draft_reply"
  );
}

function decisionLabel(decision: string | undefined): string {
  switch (decision) {
    case "accepted":
      return "Accepted";
    case "edited_accepted":
      return "Accepted with changes";
    case "rejected":
      return "Rejected";
    case "expired":
      return "Expired";
    case "auto_applied":
      return "Applied by policy";
    default:
      return "";
  }
}

/** Five buttons; the rating is a number only, the comment is optional and never required. */
function FeedbackRow({ suggestionId }: { suggestionId: string }) {
  const [feedback, { isLoading, isSuccess }] = useFeedbackMutation();
  const [rated, setRated] = useState<number | null>(null);
  if (isSuccess || rated !== null) {
    return <p className="text-xms-label text-[11px]">Thanks, rated {rated} of 5.</p>;
  }
  return (
    <div className="flex items-center gap-1 text-[11px]" role="group" aria-label="Rate this suggestion">
      <span className="text-xms-label mr-1">Rate</span>
      {[1, 2, 3, 4, 5].map((rating) => (
        <button
          key={rating}
          type="button"
          aria-label={`Rate ${rating}`}
          disabled={isLoading}
          onClick={async () => {
            try {
              await feedback({ id: suggestionId, body: { rating } }).unwrap();
              setRated(rating);
            } catch {
              // feedback is best effort; the decision is what matters
            }
          }}
          className="border-xms-ai-border text-xms-body hover:bg-xms-card h-[22px] w-[22px] rounded-[4px] border"
        >
          {rating}
        </button>
      ))}
    </div>
  );
}

/**
 * One Axel suggestion on the violet family (Wireframes v3: the Axel panel
 * and the intake strip). Nothing applies without a click: Accept, Edit and
 * accept (only the editable fields), Reject with a reason. A refused
 * decision shows its typed copy inline, never as a toast.
 */
export function AxelSuggestionCard({
  suggestion,
  ticketKey,
  canDecide,
  source,
  onDraftAccepted,
  onDecided,
  className,
}: AxelSuggestionCardProps) {
  const [decide, { isLoading }] = useDecideMutation();
  const trackShown = useTrack("axel.suggestion.shown");
  const trackDecided = useTrack("axel.suggestion.decided");
  const [mode, setMode] = useState<"view" | "edit" | "reject">("view");
  const [draft, setDraft] = useState<Record<string, unknown>>(suggestion.payload);
  const [reason, setReason] = useState<RejectReason>("wrong");
  const [error, setError] = useState<string | null>(null);
  const [decided, setDecided] = useState<SuggestionView | null>(null);

  useEffect(() => {
    if (suggestion.status === "offered" && !suggestion.decision) {
      trackShown(
        { suggestion_id: suggestion.id, capability: suggestion.capability, confidence: suggestion.confidence, source },
        "axel.suggestion.shown",
      );
    }
    // once per suggestion id on this surface
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestion.id]);

  const current = decided ?? suggestion;
  const settled = current.decision ?? null;
  const withheld = current.status === "withheld";

  const submit = async (decision: UserDecision) => {
    setError(null);
    const body =
      decision === "rejected"
        ? { decision, reject_reason: reason }
        : decision === "edited_accepted"
          ? { decision, applied_payload: draft }
          : { decision };
    try {
      const result = await decide({ id: suggestion.id, targetId: suggestion.target_id, ticketKey, body }).unwrap();
      const next = { ...result.suggestion, decision: result.decision };
      setDecided(next);
      setMode("view");
      trackDecided(
        {
          suggestion_id: suggestion.id,
          capability: suggestion.capability,
          decision,
          reject_reason: decision === "rejected" ? reason : null,
          source,
        },
        "axel.suggestion.decided",
      );
      if (suggestion.capability === "draft_reply" && decision !== "rejected") {
        const text = decision === "edited_accepted" ? String(draft.text ?? "") : String(suggestion.payload.text ?? "");
        onDraftAccepted?.(text);
      }
      onDecided?.(next);
    } catch (caught) {
      const parsed = apiError(caught);
      setError(describeDecisionError(parsed.code, parsed.permission));
    }
  };

  let footer: ReactNode = null;
  if (withheld) {
    footer = <p className="text-xms-label text-[12px]">{withheldLine(current.withheld_reason)}</p>;
  } else if (settled) {
    footer = (
      <div className="flex flex-wrap items-center gap-3">
        <span className="aix-state-pill" data-state={settled.decision === "rejected" ? "blocked" : "complete"}>
          {decisionLabel(settled.decision)}
        </span>
        <FeedbackRow suggestionId={suggestion.id} />
      </div>
    );
  } else if (!canDecide) {
    footer = <p className="text-xms-label text-[12px]">You can view this suggestion but not decide it.</p>;
  } else if (mode === "reject") {
    footer = (
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Reject reason"
          className={cn(INPUT, "h-[28px] w-auto")}
          value={reason}
          onChange={(event) => setReason(event.target.value as RejectReason)}
        >
          {REJECT_REASONS.map((value) => (
            <option key={value} value={value}>
              {REJECT_REASON_LABEL[value]}
            </option>
          ))}
        </select>
        <button type="button" className={PRIMARY} disabled={isLoading} onClick={() => void submit("rejected")}>
          Confirm reject
        </button>
        <button type="button" className={QUIET} disabled={isLoading} onClick={() => setMode("view")}>
          Back
        </button>
      </div>
    );
  } else if (mode === "edit") {
    footer = (
      <div className="flex flex-col gap-2">
        <EditForm suggestion={suggestion} draft={draft} onChange={setDraft} />
        <div className="flex items-center gap-2">
          <button type="button" className={PRIMARY} disabled={isLoading} onClick={() => void submit("edited_accepted")}>
            Accept with changes
          </button>
          <button
            type="button"
            className={QUIET}
            disabled={isLoading}
            onClick={() => {
              setDraft(suggestion.payload);
              setMode("view");
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  } else {
    footer = (
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={PRIMARY} disabled={isLoading} onClick={() => void submit("accepted")}>
          {suggestion.capability === "draft_reply" ? "Use in reply" : "Accept"}
        </button>
        {canEdit(suggestion.capability) ? (
          <button type="button" className={QUIET} disabled={isLoading} onClick={() => setMode("edit")}>
            Edit and accept
          </button>
        ) : null}
        <button type="button" className={QUIET} disabled={isLoading} onClick={() => setMode("reject")}>
          Reject
        </button>
        <span className="ml-auto">
          <FeedbackRow suggestionId={suggestion.id} />
        </span>
      </div>
    );
  }

  return (
    <article
      className={cn("xms-ai flex flex-col gap-2 p-3 text-[13px]", className)}
      data-capability={suggestion.capability}
      data-suggestion={suggestion.id}
      aria-label={`${CAPABILITY_LABEL[suggestion.capability]} suggestion`}
    >
      <header className="flex flex-wrap items-center gap-2">
        <span className="xms-caption text-xms-ai-accent">{CAPABILITY_LABEL[suggestion.capability]}</span>
        <span className="text-xms-label text-[11px]">Axel</span>
        <span className="xms-mono text-xms-label ml-auto text-[11px]" title={`Prompt ${suggestion.prompt_version}`}>
          {suggestion.agent_id}
          {typeof suggestion.confidence === "number" ? ` · ${formatConfidence(suggestion.confidence)}` : ""}
        </span>
      </header>
      {withheld ? null : <SuggestionBody suggestion={current} />}
      {suggestion.explanation ? <p className="text-xms-body text-[12px]">{suggestion.explanation}</p> : null}
      <InlineError message={error} />
      {footer}
    </article>
  );
}
