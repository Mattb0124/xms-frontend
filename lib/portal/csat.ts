import { apiError, describeError, type ApiError } from "@/lib/admin/api-error";
import type { AnswerSurveyBody, Survey, SurveyKind, SurveyQuestionSpec, SurveyStatus } from "@/redux/portalApi";

/**
 * The CSAT vocabulary (Client Portal functional 5.7): the five-point scale
 * and its labels, the two survey kinds and how each is asked, the email
 * link that answers without a session, and the refusals in words. Shared by
 * the portal page and the operator's Satisfaction view, so both name a
 * score the same way.
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

// The two kinds ---------------------------------------------------------------

/** A row from an API older than the quarterly survey reads as a ticket-close one. */
export function surveyKind(survey: Pick<Survey, "kind">): SurveyKind {
  return survey.kind === "quarterly" ? "quarterly" : "ticket_close";
}

export function isQuarterly(survey: Pick<Survey, "kind">): boolean {
  return surveyKind(survey) === "quarterly";
}

/** `2026-Q2` reads as "2026 Q2"; anything else is shown as the server wrote it. */
export function periodLabel(period: string | null | undefined): string | null {
  if (!period) return null;
  const match = /^(\d{4})-Q([1-4])$/.exec(period);
  return match ? `${match[1]} Q${match[2]}` : period;
}

/**
 * A question key as a short label ("responsiveness" reads "Responsiveness").
 * The server owns the keys; this only makes one readable where there is no
 * question text beside it, as on an answered row.
 */
export function keyLabel(key: string): string {
  const words = key.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The questions to ask for a survey, from the survey itself.
 *
 * Both paths read the row the server sent: the Surveys page reads the list,
 * and the email link reads `POST /v1/csat/:id/describe` behind its one-time
 * token. So the portal holds no question vocabulary of its own, quarterly
 * or otherwise: a survey whose questions the server changes is asked the
 * new way without a release here. The ticket-close survey is one question,
 * and the portal names the ticket in it where the server's own text says
 * only "this request"; the key still comes from the row where there is one.
 */
export function questionsOf(survey: Pick<Survey, "kind" | "questions" | "ticket_key">): SurveyQuestionSpec[] {
  if (isQuarterly(survey)) return survey.questions ?? [];
  return [{ key: survey.questions?.[0]?.key ?? "score", text: surveyQuestion(survey.ticket_key) }];
}

/** What the card and the completed row call a survey: the ticket, or the quarter. */
export function surveySubject(survey: Pick<Survey, "kind" | "period" | "ticket_key">): string {
  if (isQuarterly(survey)) {
    const period = periodLabel(survey.period);
    return period ? `${period} relationship survey` : "Relationship survey";
  }
  return survey.ticket_key ?? "Your request";
}

/**
 * The body for the survey's kind: one `score` on ticket close, the five
 * keyed `scores` on a quarterly survey. The kind decides the shape, so a
 * client never sends the one the server will refuse.
 */
export function answerBody(kind: SurveyKind, scores: Record<string, number>, comment?: string): AnswerSurveyBody {
  const trimmed = comment?.trim();
  const body: AnswerSurveyBody = kind === "quarterly" ? { scores } : { score: scores.score };
  return trimmed ? { ...body, comment: trimmed } : body;
}

/** An answered survey in one line: the score in words, or each question and its answer. */
export function answerLine(survey: Pick<Survey, "kind" | "score" | "answers">): string {
  if (!isQuarterly(survey)) {
    return survey.score !== null ? `${survey.score} of 5, ${scoreLabel(survey.score)}` : "Answered";
  }
  const answers = survey.answers;
  if (!answers || Object.keys(answers).length === 0) return "Answered";
  return Object.entries(answers)
    .map(([key, value]) => `${keyLabel(key)} ${value}`)
    .join(", ");
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

/**
 * Whether the survey can still be answered. `describe` answers an already
 * answered and an expired survey just as readily as a pending one, each
 * with its own status, so the link page reads the status rather than
 * offering a form the answer route would refuse.
 */
export function isAnswerable(status: SurveyStatus | "suppressed"): boolean {
  return status === "sent" || status === "reminded";
}

/** Where a survey stands, for a visitor who is not being asked to answer it. */
export function statusLine(status: SurveyStatus | "suppressed"): string {
  switch (status) {
    case "answered":
      return "This survey has already been answered. Thank you.";
    case "expired":
      return "This survey has expired and can no longer be answered.";
    default:
      return "This survey is closed and can no longer be answered.";
  }
}

/**
 * The one word for a link that does not resolve. `POST /v1/csat/:id/describe`
 * answers the same 404 for an unknown id and a token that does not match, so
 * that the route confirms no id; the page says the same one thing back,
 * rather than guessing which of the two it was.
 */
export const LINK_NOT_VALID =
  "This link is not valid. Open the most recent email we sent you, or ask us for a new link.";

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
      return LINK_NOT_VALID;
    case "token_required":
      return "This survey link is missing its token. Open the link from your email again.";
    default:
      return describeError(error);
  }
}
