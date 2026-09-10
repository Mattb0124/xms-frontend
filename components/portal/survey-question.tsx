"use client";

import { useState } from "react";
import { PORTAL_PRIMARY, PORTAL_TEXTAREA } from "@/components/portal/primitives";
import { SCORES, scoreLabel } from "@/lib/portal/csat";
import { cn } from "@/lib/utils";
import type { SurveyQuestionSpec } from "@/redux/portalApi";

/**
 * The five-point questions of a survey (Client Portal functional 5.7): one
 * fieldset per question, named by the question itself, with five buttons
 * from very dissatisfied to very satisfied labelled in words; then an
 * optional comment and one submit that stays disabled until every question
 * has an answer. The questions come from the survey row, so a ticket-close
 * survey renders one and a quarterly one renders five without this
 * component holding either vocabulary. The caller sends the answers; this
 * only collects them, keyed as the server keys them.
 */
export function SurveyQuestion({
  id,
  questions,
  label,
  onSubmit,
  submitting,
}: {
  id: string;
  questions: SurveyQuestionSpec[];
  /** The form's accessible name: the one question on ticket close, the survey's subject otherwise. */
  label: string;
  onSubmit: (scores: Record<string, number>, comment: string | undefined) => void | Promise<void>;
  submitting?: boolean;
}) {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const answered = questions.every((question) => scores[question.key] !== undefined);

  return (
    <form
      className="flex flex-col gap-4"
      aria-label={label}
      onSubmit={(event) => {
        event.preventDefault();
        if (!answered) return;
        void onSubmit(scores, comment.trim() || undefined);
      }}
    >
      {questions.map((question) => (
        <fieldset key={question.key} className="flex flex-col gap-2" data-question={question.key}>
          <legend className="text-xms-ink text-[15px] font-medium">{question.text}</legend>
          <div className="grid grid-cols-5 gap-2">
            {SCORES.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={scores[question.key] === value}
                aria-label={`${value}, ${scoreLabel(value)}`}
                onClick={() => setScores((current) => ({ ...current, [question.key]: value }))}
                data-score={value}
                className={cn(
                  "border-xms-line text-xms-body hover:bg-xms-control-hover flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-[6px] border px-1 py-2 outline-none",
                  scores[question.key] === value && "border-xms-accent bg-xms-tint text-xms-ink",
                )}
              >
                <span className="xms-mono text-[18px] font-semibold">{value}</span>
                <span className="text-[14px] leading-tight">{scoreLabel(value)}</span>
              </button>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-comment`} className="text-xms-body text-[14px]">
          Comment (optional)
        </label>
        <textarea
          id={`${id}-comment`}
          rows={3}
          maxLength={2000}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          className={PORTAL_TEXTAREA}
        />
      </div>
      <div>
        <button type="submit" className={PORTAL_PRIMARY} disabled={!answered || submitting}>
          {submitting ? "Sending" : "Send my answer"}
        </button>
      </div>
    </form>
  );
}
