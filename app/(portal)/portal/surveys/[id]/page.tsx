"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { SurveyLinkAnswer } from "@/components/portal/survey-link";
import { SurveysPage } from "@/components/portal/surveys";
import { Skeleton } from "@/components/xms/skeleton";

function SurveyRoute({ surveyId }: { surveyId: string }) {
  const search = useSearchParams();
  const token = search?.get("token");
  return token ? <SurveyLinkAnswer surveyId={surveyId} token={token} /> : <SurveysPage focusId={surveyId} />;
}

/**
 * One survey: with `?token=` (the email link) the question alone, answered
 * through the link route without a session; with a session and no token
 * the Surveys page with this survey first.
 */
export default function PortalSurveyPage() {
  const params = useParams<{ id: string }>();
  return (
    <Suspense fallback={<Skeleton lines={4} />}>
      <SurveyRoute surveyId={String(params.id)} />
    </Suspense>
  );
}
