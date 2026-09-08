"use client";

import { useState } from "react";
import { PortalCard, PortalNotice } from "@/components/portal/primitives";
import { SurveyQuestion } from "@/components/portal/survey-question";
import { Skeleton } from "@/components/xms/skeleton";
import {
  answerBody,
  describeSurveyError,
  expiryLabel,
  isAnswerable,
  isQuarterly,
  keyLabel,
  LINK_NOT_VALID,
  questionsOf,
  scoreLabel,
  statusLine,
  surveyError,
  surveyKind,
  surveySubject,
} from "@/lib/portal/csat";
import { useAnswerSurveyLinkMutation, useDescribeSurveyLinkQuery, type SurveyAnswer } from "@/redux/portalApi";

/**
 * The email link (`/portal/surveys/{id}#token=...`): the survey with no
 * session and no chrome, read and answered with the one-time token as the
 * only credential.
 *
 * The page reads `POST /v1/csat/{id}/describe` first, so what it asks is
 * what the server says this survey asks: one question named after the
 * ticket on a ticket-close survey, the five keyed questions on a quarterly
 * one. No question text is kept here, which is what the page had to do
 * while the link route had no read behind it and the kind arrived only in a
 * refusal.
 *
 * An unknown id and a token that does not match answer the same 404, so the
 * page says the same one thing back rather than telling a visitor which of
 * the two they hold. A survey that has been answered or has expired is
 * described just as readily, and reads as its status with no form under it,
 * rather than offering an answer the API would refuse.
 */
export function SurveyLinkAnswer({ surveyId, token }: { surveyId: string; token: string }) {
  const { data: survey, isLoading, isError } = useDescribeSurveyLinkQuery({ id: surveyId, token });
  const [answer, { isLoading: sending }] = useAnswerSurveyLinkMutation();
  const [done, setDone] = useState<SurveyAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (isLoading && !survey) {
    return (
      <Frame>
        <Skeleton lines={4} />
      </Frame>
    );
  }

  if (isError || !survey) {
    return (
      <Frame>
        <PortalCard>
          <PortalNotice tone="error">{LINK_NOT_VALID}</PortalNotice>
        </PortalCard>
      </Frame>
    );
  }

  const quarterly = isQuarterly(survey);
  const questions = questionsOf(survey);
  const subject = surveySubject(survey);
  const expiry = expiryLabel(survey.expires_at);

  return (
    <Frame kind={surveyKind(survey)}>
      <PortalCard>
        <p className="text-xms-label text-[13px]">{subject}</p>
        {done ? (
          <p role="status" className="text-xms-ink text-[15px]">
            {quarterly
              ? `Thank you. Your answers, ${Object.entries(done.answers ?? {})
                  .map(([key, value]) => `${keyLabel(key)} ${value}`)
                  .join(", ")}, have been recorded.`
              : `Thank you. Your answer, ${done.score} of 5 (${scoreLabel(done.score)}), has been recorded.`}
          </p>
        ) : isAnswerable(survey.status) ? (
          <SurveyQuestion
            id={`survey-${surveyId}`}
            questions={questions}
            label={quarterly ? subject : (questions[0]?.text ?? subject)}
            submitting={sending}
            onSubmit={async (scores, comment) => {
              setError(null);
              try {
                setDone(
                  await answer({
                    id: surveyId,
                    token,
                    body: answerBody(surveyKind(survey), scores, comment),
                  }).unwrap(),
                );
              } catch (caught) {
                setError(describeSurveyError(surveyError(caught)));
              }
            }}
          />
        ) : (
          <p role="status" className="text-xms-ink text-[15px]">
            {statusLine(survey.status)}
          </p>
        )}
        {error ? <PortalNotice tone="error">{error}</PortalNotice> : null}
      </PortalCard>
      <p className="text-xms-label text-[13px]">
        {`This link is for you only and takes one answer.${isAnswerable(survey.status) && expiry ? ` ${expiry}.` : ""}`}
      </p>
    </Frame>
  );
}

/** The bare page the link renders into: a heading, the card, and nothing of the portal chrome. */
function Frame({ children, kind }: { children: React.ReactNode; kind?: string }) {
  return (
    <div className="flex flex-col gap-4" data-testid="survey-link" data-kind={kind}>
      <h1 className="text-xms-ink text-[22px] font-semibold">How did we do?</h1>
      {children}
    </div>
  );
}
