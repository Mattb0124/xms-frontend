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
 * The quarterly question texts, used only where the API sent keys without
 * them: the email-link route has no survey to read, so its `scores_required`
 * refusal names the five keys alone. Everywhere else the row's own
 * `questions` are rendered and this table is never consulted.
 */
export const QUARTERLY_FALLBACK_TEXT: Record<string, string> = {
  responsiveness: "How responsive were we this quarter?",
  quality: "How would you rate the quality of the work delivered?",
  communication: "How clear and timely was our communication?",
  value: "How well does the service represent value for money?",
  recommend: "How likely are you to recommend us to a colleague?",
};

/** Keys the server named, as questions to render; the text falls back to the key in words. */
export function questionsFromKeys(keys: readonly string[]): SurveyQuestionSpec[] {
  return keys.map((key) => ({ key, text: QUARTERLY_FALLBACK_TEXT[key] ?? keyLabel(key) }));
}

/**
 * The questions to ask for a survey row.
 *
 * A quarterly survey is asked exactly as the server sent it, keys and text
 * together, so the portal never holds that vocabulary. The ticket-close
 * survey is one question, and the portal names the ticket in it where the
 * server's own text says only "this request"; the key still comes from the
 * row where there is one.
 */
export function questionsOf(survey: Pick<Survey, "kind" | "questions" | "ticket_key">): SurveyQuestionSpec[] {
  if (isQuarterly(survey)) {
    const sent = survey.questions ?? [];
    return sent.length > 0 ? sent : questionsFromKeys(Object.keys(QUARTERLY_FALLBACK_TEXT));
  }
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

export interface SurveyError extends ApiError {
  /** survey_closed carries the survey's status. */
  surveyStatus?: SurveyStatus | "suppressed";
  /** scores_required carries the keys the quarterly survey expects. */
  questionKeys?: string[];
}

export function surveyError(error: unknown): SurveyError {
  const parsed = apiError(error) as SurveyError;
  const data = (error as { data?: Record<string, unknown> })?.data;
  if (data && typeof data === "object" && typeof data.status === "string") {
    parsed.surveyStatus = data.status as SurveyError["surveyStatus"];
  }
  if (data && Array.isArray(data.questions)) {
    parsed.questionKeys = data.questions.filter((key): key is string => typeof key === "string");
  }
  return parsed;
}

export function describeSurveyError(error: SurveyError): string {
  switch (error.code) {
    case "scores_required":
      return "This is the quarterly relationship survey. It asks five short questions, which are below.";
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
