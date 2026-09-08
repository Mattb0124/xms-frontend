"use client";

import { useParams } from "next/navigation";
import { Suspense } from "react";
import { SurveyLinkAnswer } from "@/components/portal/survey-link";
import { SurveysPage } from "@/components/portal/surveys";
import { Skeleton } from "@/components/xms/skeleton";
import { useSurveyLink } from "@/lib/portal/survey-token";

function SurveyRoute({ surveyId }: { surveyId: string }) {
  // The token is read from the fragment first and then taken out of the
  // address bar, so it is gone from the URL by the time this renders
  // (security review finding 9). Neither form can be known until the client
  // runs, so the first frame is a placeholder rather than a guess.
  const link = useSurveyLink();
  if (link.pending) return <Skeleton lines={4} />;
  return link.token ? <SurveyLinkAnswer surveyId={surveyId} token={link.token} /> : <SurveysPage focusId={surveyId} />;
}

/**
 * One survey: with a link token (`#token=`, or `?token=` from a link already
 * sent) the question alone, answered through the link route without a
 * session; with a session and no token the Surveys page with this survey
 * first.
 */
export default function PortalSurveyPage() {
  const params = useParams<{ id: string }>();
  return (
    <Suspense fallback={<Skeleton lines={4} />}>
      <SurveyRoute surveyId={String(params.id)} />
    </Suspense>
  );
}
