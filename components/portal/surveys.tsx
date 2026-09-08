"use client";

import Link from "next/link";
import { useState } from "react";
import { PortalCard, PortalNotice } from "@/components/portal/primitives";
import { SurveyQuestion } from "@/components/portal/survey-question";
import { Skeleton } from "@/components/xms/skeleton";
import { describeSurveyError, expiryLabel, scoreLabel, surveyError, surveyQuestion } from "@/lib/portal/csat";
import { useTrack } from "@/lib/telemetry/provider";
import { useAnswerPortalSurveyMutation, usePortalSurveysQuery, type Survey } from "@/redux/portalApi";

/**
 * Surveys (Client Portal functional 5.7, CP-07): the pending ticket-close
 * surveys as cards with the one question, and the completed ones with the
 * score given. A refusal (already answered, closed) is worded and the list
 * read again, so the page never shows a survey the server will not take.
 * `focusId` puts the survey a link named first, or explains where it went.
 */
export function SurveysPage({ focusId }: { focusId?: string }) {
  const { data, isLoading, isError } = usePortalSurveysQuery();
  const [answer, { isLoading: sending }] = useAnswerPortalSurveyMutation();
  const track = useTrack("portal.survey.answer");
  const [notice, setNotice] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  const pending = [...(data?.pending ?? [])].sort((a, b) => (a.id === focusId ? -1 : b.id === focusId ? 1 : 0));
  const answered = data?.answered ?? [];
  const focused = focusId ? pending.find((survey) => survey.id === focusId) : undefined;
  const focusedAnswered = focusId && !focused ? answered.find((survey) => survey.id === focusId) : undefined;

  const send = async (survey: Survey, score: number, comment: string | undefined) => {
    setNotice(null);
    try {
      await answer({ id: survey.id, body: comment ? { score, comment } : { score } }).unwrap();
      track({ survey_id: survey.id, score, has_comment: Boolean(comment) });
      setNotice({
        tone: "info",
        text: `Thank you. Your answer for ${survey.ticket_key ?? "the request"} has been recorded.`,
      });
    } catch (caught) {
      setNotice({ tone: "error", text: describeSurveyError(surveyError(caught)) });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-xms-ink text-[22px] font-semibold">Surveys</h1>
      </header>
      {notice ? <PortalNotice tone={notice.tone}>{notice.text}</PortalNotice> : null}
      {data && focusId && !focused ? (
        <PortalNotice>
          {focusedAnswered
            ? `You have already answered the survey for ${focusedAnswered.ticket_key ?? "that request"}. Thank you.`
            : "That survey is no longer open. It may have expired, or it may not be yours."}
        </PortalNotice>
      ) : null}
      {isError ? (
        <PortalNotice tone="error">Your surveys could not be loaded. Try again in a moment.</PortalNotice>
      ) : null}
      <section aria-label="Pending surveys" className="flex flex-col gap-3">
        <h2 className="text-xms-ink text-[16px] font-semibold">Pending</h2>
        {isLoading && !data ? <Skeleton lines={4} /> : null}
        {data && pending.length === 0 ? (
          <p role="status" className="text-xms-label py-4 text-[14px]">
            No surveys pending.
          </p>
        ) : null}
        {pending.map((survey) => (
          <PortalCard key={survey.id} title={survey.ticket_key ?? "Your request"} className="gap-4">
            <div className="flex flex-col gap-1" data-survey={survey.id}>
              {survey.short_description ? (
                <p className="text-xms-body text-[14px]">{survey.short_description}</p>
              ) : null}
              {expiryLabel(survey.expires_at) ? (
                <p className="text-xms-label text-[12px]">{expiryLabel(survey.expires_at)}</p>
              ) : null}
            </div>
            <SurveyQuestion
              id={`survey-${survey.id}`}
              question={surveyQuestion(survey.ticket_key)}
              submitting={sending}
              onSubmit={(score, comment) => send(survey, score, comment)}
            />
          </PortalCard>
        ))}
      </section>
      <section aria-label="Completed surveys" className="flex flex-col gap-3">
        <h2 className="text-xms-ink text-[16px] font-semibold">Completed</h2>
        <PortalCard>
          {data && answered.length === 0 ? (
            <p className="text-xms-label py-2 text-[14px]">No completed surveys yet.</p>
          ) : null}
          {answered.length > 0 ? (
            <ul className="divide-xms-line divide-y" aria-label="Completed surveys">
              {answered.map((survey) => (
                <li
                  key={survey.id}
                  className="flex flex-wrap items-center gap-3 py-2 text-[14px]"
                  data-survey={survey.id}
                >
                  {survey.ticket_key ? (
                    <Link
                      href={`/portal/requests/${survey.ticket_key}`}
                      className="xms-mono text-xms-accent text-[13px] hover:underline"
                    >
                      {survey.ticket_key}
                    </Link>
                  ) : (
                    <span className="text-xms-label text-[13px]">Request</span>
                  )}
                  <span className="text-xms-body">{survey.short_description}</span>
                  <span className="text-xms-ink ml-auto" data-score={survey.score ?? undefined}>
                    {survey.score !== null ? `${survey.score} of 5, ${scoreLabel(survey.score)}` : "Answered"}
                  </span>
                  {survey.answered_at ? (
                    <span className="xms-mono text-xms-label text-[12px]">{survey.answered_at.slice(0, 10)}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {isLoading && !data ? <Skeleton lines={2} /> : null}
        </PortalCard>
      </section>
    </div>
  );
}
