"use client";

import { useState } from "react";
import { PortalCard, PortalNotice } from "@/components/portal/primitives";
import { SurveyQuestion } from "@/components/portal/survey-question";
import {
  answerBody,
  describeSurveyError,
  keyLabel,
  questionsFromKeys,
  scoreLabel,
  surveyError,
  surveyQuestion,
} from "@/lib/portal/csat";
import { useAnswerSurveyLinkMutation, type SurveyAnswer, type SurveyQuestionSpec } from "@/redux/portalApi";

const TICKET_CLOSE: SurveyQuestionSpec[] = [{ key: "score", text: surveyQuestion(null) }];

/**
 * The email link (`/portal/surveys/{id}#token=...`): the questions with no
 * session and no chrome, posted to /v1/csat/:id/answer with the one-time
 * token as the credential. The ticket is not named because the link route
 * has nothing to read; the email that carried the link does.
 *
 * For the same reason the kind is not known before the first answer: there
 * is no GET behind the token. So the page opens on the one ticket-close
 * question, and a quarterly survey answers `scores_required` naming its
 * five keys, at which point the page asks those five instead and says why.
 * The kind still comes from the server, never from a guess made here.
 */
export function SurveyLinkAnswer({ surveyId, token }: { surveyId: string; token: string }) {
  const [answer, { isLoading }] = useAnswerSurveyLinkMutation();
  const [done, setDone] = useState<SurveyAnswer | null>(null);
  const [questions, setQuestions] = useState<SurveyQuestionSpec[]>(TICKET_CLOSE);
  const [error, setError] = useState<string | null>(null);
  const quarterly = questions !== TICKET_CLOSE;

  return (
    <div className="flex flex-col gap-4" data-testid="survey-link">
      <h1 className="text-xms-ink text-[22px] font-semibold">How did we do?</h1>
      <PortalCard>
        {done ? (
          <p role="status" className="text-xms-ink text-[15px]">
            {quarterly
              ? `Thank you. Your answers, ${Object.entries(done.answers ?? {})
                  .map(([key, value]) => `${keyLabel(key)} ${value}`)
                  .join(", ")}, have been recorded.`
              : `Thank you. Your answer, ${done.score} of 5 (${scoreLabel(done.score)}), has been recorded.`}
          </p>
        ) : (
          <SurveyQuestion
            // A new question set is a new form, so an answer given against
            // the single question does not survive into the five.
            key={quarterly ? "quarterly" : "ticket_close"}
            id={`survey-${surveyId}`}
            questions={questions}
            label={quarterly ? "Relationship survey" : surveyQuestion(null)}
            submitting={isLoading}
            onSubmit={async (scores, comment) => {
              setError(null);
              try {
                setDone(
                  await answer({
                    id: surveyId,
                    token,
                    body: answerBody(quarterly ? "quarterly" : "ticket_close", scores, comment),
                  }).unwrap(),
                );
              } catch (caught) {
                const refusal = surveyError(caught);
                if (refusal.code === "scores_required" && refusal.questionKeys?.length) {
                  setQuestions(questionsFromKeys(refusal.questionKeys));
                }
                setError(describeSurveyError(refusal));
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
