import { apiError, describeError, type ApiError } from "@/lib/admin/api-error";
import type { SurveyStatus } from "@/redux/portalApi";

/**
 * The CSAT vocabulary (Client Portal functional 5.7): one five-point
 * question, its labels, the email link that answers without a session,
 * and the refusals in words. Shared by the portal page and the operator's
 * Satisfaction view, so both name a score the same way.
 */
export const SCORES = [1, 2, 3, 4, 5] as const;

export const SCORE_LABELS: Record<number, string> = {
  1: "Very dissatisfied",
  2: "Dissatisfied",
  3: "Neutral",
  4: "Satisfied",
  5: "Very satisfied",
};

export function scoreLabel(score: number): string {
  return SCORE_LABELS[score] ?? String(score);
}

/** The one question, with the ticket key when it is known. */
export function surveyQuestion(ticketKey: string | null): string {
  return ticketKey
    ? `How satisfied are you with the handling of ${ticketKey}?`
    : "How satisfied are you with the handling of your request?";
}

/** `/portal/surveys/{id}`: the address an email link points at, token or not. */
export function isSurveyPath(pathname: string): boolean {
  return /^\/portal\/surveys\/[^/]+\/?$/.test(pathname);
}

/**
 * The email link is `/portal/surveys/{id}` carrying a one-time token: with a
 * token the page answers through the link route and renders without the
 * portal chrome, since the visitor may have no session.
 *
 * The token now arrives in the fragment and is taken out of the address on
 * read (security review finding 9), so the caller passes what `useSurveyLink`
 * captured. `search` still counts, for a link already sent with `?token=`.
 */
export function isSurveyLink(pathname: string, search: URLSearchParams | null, linkToken?: string | null): boolean {
  return isSurveyPath(pathname) && Boolean(linkToken || search?.get("token"));
}

/** "Open until 2026-09-15", or nothing when the server set no expiry. */
export function expiryLabel(expiresAt: string | null): string | null {
  return expiresAt ? `Open until ${expiresAt.slice(0, 10)}` : null;
}

export interface SurveyError extends ApiError {
  /** survey_closed carries the survey's status. */
  surveyStatus?: SurveyStatus | "suppressed";
}

export function surveyError(error: unknown): SurveyError {
  const parsed = apiError(error) as SurveyError;
  const data = (error as { data?: Record<string, unknown> })?.data;
  if (data && typeof data === "object" && typeof data.status === "string") {
    parsed.surveyStatus = data.status as SurveyError["surveyStatus"];
  }
  return parsed;
}

export function describeSurveyError(error: SurveyError): string {
  switch (error.code) {
    case "already_answered":
      return "You have already answered this survey. Thank you.";
    case "survey_closed":
      return error.surveyStatus === "expired"
        ? "This survey has expired and can no longer be answered."
        : "This survey is closed and can no longer be answered.";
    case "not_found":
      return "This survey link is not valid. It may have been used already, or the survey may have been removed.";
    case "token_required":
      return "This survey link is missing its token. Open the link from your email again.";
    default:
      return describeError(error);
  }
}
