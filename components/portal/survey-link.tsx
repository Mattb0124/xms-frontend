"use client";

import { useState } from "react";
import { PortalCard, PortalNotice } from "@/components/portal/primitives";
import { SurveyQuestion } from "@/components/portal/survey-question";
import { describeSurveyError, scoreLabel, surveyError, surveyQuestion } from "@/lib/portal/csat";
import { useAnswerSurveyLinkMutation, type SurveyAnswer } from "@/redux/portalApi";

/**
 * The email link (`/portal/surveys/{id}?token=...`): the one question with
 * no session and no chrome, posted to /v1/csat/:id/answer with the
 * one-time token as the credential. The ticket is not named because the
 * link route has nothing to read; the email that carried the link does.
 */
export function SurveyLinkAnswer({ surveyId, token }: { surveyId: string; token: string }) {
  const [answer, { isLoading }] = useAnswerSurveyLinkMutation();
  const [done, setDone] = useState<SurveyAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4" data-testid="survey-link">
      <h1 className="text-xms-ink text-[22px] font-semibold">How did we do?</h1>
      <PortalCard>
        {done ? (
          <p role="status" className="text-xms-ink text-[15px]">
            Thank you. Your answer, {done.score} of 5 ({scoreLabel(done.score)}), has been recorded.
          </p>
        ) : (
          <SurveyQuestion
            id={`survey-${surveyId}`}
            question={surveyQuestion(null)}
            submitting={isLoading}
            onSubmit={async (score, comment) => {
              setError(null);
              try {
                setDone(await answer({ id: surveyId, token, body: comment ? { score, comment } : { score } }).unwrap());
              } catch (caught) {
                setError(describeSurveyError(surveyError(caught)));
              }
            }}
          />
        )}
        {error ? <PortalNotice tone="error">{error}</PortalNotice> : null}
      </PortalCard>
      <p className="text-xms-label text-[13px]">This link is for you only and takes one answer.</p>
    </div>
  );
}
