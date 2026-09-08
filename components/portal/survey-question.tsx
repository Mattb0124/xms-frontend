"use client";

import { useState } from "react";
import { PORTAL_PRIMARY, PORTAL_TEXTAREA } from "@/components/portal/primitives";
import { SCORES, scoreLabel } from "@/lib/portal/csat";
import { cn } from "@/lib/utils";

/**
 * The one five-point question (Client Portal functional 5.7): five buttons
 * from very dissatisfied to very satisfied, each labelled in words, an
 * optional comment, and one submit that stays disabled until a score is
 * chosen. The caller sends the answer; this only collects it.
 */
export function SurveyQuestion({
  id,
  question,
  onSubmit,
  submitting,
}: {
  id: string;
  question: string;
  onSubmit: (score: number, comment: string | undefined) => void | Promise<void>;
  submitting?: boolean;
}) {
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");

  return (
    <form
      className="flex flex-col gap-4"
      aria-label={question}
      onSubmit={(event) => {
        event.preventDefault();
        if (score === null) return;
        void onSubmit(score, comment.trim() || undefined);
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="text-xms-ink text-[15px] font-medium">{question}</legend>
        <div role="group" aria-label="Score" className="grid grid-cols-5 gap-2">
          {SCORES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={score === value}
              aria-label={`${value}, ${scoreLabel(value)}`}
              onClick={() => setScore(value)}
              data-score={value}
              className={cn(
                "border-xms-line text-xms-body hover:bg-xms-tint focus-visible:ring-xms-accent flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-[6px] border px-1 py-2 outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                score === value && "border-xms-accent bg-xms-tint text-xms-ink",
              )}
            >
              <span className="xms-mono text-[18px] font-semibold">{value}</span>
              <span className="text-[11px] leading-tight">{scoreLabel(value)}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-comment`} className="text-xms-body text-[13px]">
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
        <button type="submit" className={PORTAL_PRIMARY} disabled={score === null || submitting}>
          {submitting ? "Sending" : "Send my answer"}
        </button>
      </div>
    </form>
  );
}
