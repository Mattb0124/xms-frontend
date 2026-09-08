import { describe, expect, it } from "vitest";
import {
  answerBody,
  answerLine,
  describeSurveyError,
  expiryLabel,
  isQuarterly,
  isSurveyLink,
  keyLabel,
  periodLabel,
  questionsFromKeys,
  questionsOf,
  scoreLabel,
  surveyError,
  surveyQuestion,
  surveySubject,
} from "@/lib/portal/csat";
import { anAnsweredSurvey, aQuarterlySurvey, aSurvey, QUARTERLY_QUESTIONS } from "@/test-kit/portal";

describe("csat vocabulary", () => {
  it("labels the five scores from very dissatisfied to very satisfied", () => {
    expect([1, 2, 3, 4, 5].map(scoreLabel)).toEqual([
      "Very dissatisfied",
      "Dissatisfied",
      "Neutral",
      "Satisfied",
      "Very satisfied",
    ]);
  });

  it("asks the one question with the ticket key when known", () => {
    expect(surveyQuestion("CS0001001")).toBe("How satisfied are you with the handling of CS0001001?");
    expect(surveyQuestion(null)).toBe("How satisfied are you with the handling of your request?");
    expect(expiryLabel("2026-09-15T10:00:00Z")).toBe("Open until 2026-09-15");
    expect(expiryLabel(null)).toBeNull();
  });

  it("recognises the email link only on the survey page with a token", () => {
    expect(isSurveyLink("/portal/surveys/abc", new URLSearchParams("token=x"))).toBe(true);
    expect(isSurveyLink("/portal/surveys/abc/", new URLSearchParams("token=x"))).toBe(true);
    expect(isSurveyLink("/portal/surveys/abc", new URLSearchParams(""))).toBe(false);
    expect(isSurveyLink("/portal/surveys/abc", null)).toBe(false);
    expect(isSurveyLink("/portal/surveys", new URLSearchParams("token=x"))).toBe(false);
    expect(isSurveyLink("/portal/requests/CS1", new URLSearchParams("token=x"))).toBe(false);
  });

  it("words the refusals, carrying the status on survey_closed", () => {
    expect(describeSurveyError(surveyError({ status: 409, data: { code: "already_answered" } }))).toBe(
      "You have already answered this survey. Thank you.",
    );
    expect(describeSurveyError(surveyError({ status: 409, data: { code: "survey_closed", status: "expired" } }))).toBe(
      "This survey has expired and can no longer be answered.",
    );
    expect(
      describeSurveyError(surveyError({ status: 409, data: { code: "survey_closed", status: "suppressed" } })),
    ).toBe("This survey is closed and can no longer be answered.");
    expect(describeSurveyError(surveyError({ status: 404, data: { code: "not_found", entity: "survey" } }))).toMatch(
      /link is not valid/,
    );
    expect(describeSurveyError(surveyError({ status: "FETCH_ERROR" }))).toBe("The API could not be reached.");
  });
});

/**
 * The two kinds (functional 5.7): the row's own `questions` decide what is
 * asked and its `kind` decides the body, so neither vocabulary is invented
 * in the browser.
 */
describe("the two survey kinds", () => {
  it("reads a row with no kind as a ticket-close survey and asks its one question", () => {
    const legacy = aSurvey({ kind: undefined, questions: undefined });
    expect(isQuarterly(legacy)).toBe(false);
    expect(questionsOf(legacy)).toEqual([
      { key: "score", text: "How satisfied are you with the handling of CS0001001?" },
    ]);
    expect(surveySubject(legacy)).toBe("CS0001001");
  });

  it("asks the five questions the quarterly row carries, and names the quarter", () => {
    const quarterly = aQuarterlySurvey();
    expect(isQuarterly(quarterly)).toBe(true);
    expect(questionsOf(quarterly)).toEqual(QUARTERLY_QUESTIONS);
    expect(questionsOf(quarterly).map((question) => question.key)).toEqual([
      "responsiveness",
      "quality",
      "communication",
      "value",
      "recommend",
    ]);
    expect(surveySubject(quarterly)).toBe("2026 Q2 relationship survey");
    expect(periodLabel("2026-Q2")).toBe("2026 Q2");
    expect(periodLabel(null)).toBeNull();
    // A period the server writes some other way is shown as it wrote it.
    expect(periodLabel("FY27H1")).toBe("FY27H1");
  });

  it("falls back to the five keys the API named when a row carries no question text", () => {
    expect(questionsFromKeys(["responsiveness", "recommend"])).toEqual([
      { key: "responsiveness", text: "How responsive were we this quarter?" },
      { key: "recommend", text: "How likely are you to recommend us to a colleague?" },
    ]);
    // A key this build has never heard of still reads as words, never as a blank.
    expect(questionsFromKeys(["onboarding_speed"])).toEqual([{ key: "onboarding_speed", text: "Onboarding speed" }]);
    expect(keyLabel("value")).toBe("Value");
  });

  it("sends score for a ticket-close survey and scores for a quarterly one, trimming the comment", () => {
    expect(answerBody("ticket_close", { score: 4 })).toEqual({ score: 4 });
    expect(answerBody("ticket_close", { score: 4 }, "  Quick and clear  ")).toEqual({
      score: 4,
      comment: "Quick and clear",
    });
    // An all-whitespace comment is no comment; the field is left off entirely.
    expect(answerBody("ticket_close", { score: 2 }, "   ")).toEqual({ score: 2 });
    const scores = { responsiveness: 4, quality: 5, communication: 4, value: 3, recommend: 5 };
    expect(answerBody("quarterly", scores)).toEqual({ scores });
    expect(answerBody("quarterly", scores, "More of the same")).toEqual({ scores, comment: "More of the same" });
  });

  it("words an answered survey by its kind", () => {
    expect(answerLine(anAnsweredSurvey())).toBe("4 of 5, Satisfied");
    expect(
      answerLine(
        aQuarterlySurvey({
          status: "answered",
          answers: { responsiveness: 4, quality: 5, communication: 4, value: 3, recommend: 5 },
        }),
      ),
    ).toBe("Responsiveness 4, Quality 5, Communication 4, Value 3, Recommend 5");
    expect(answerLine(aQuarterlySurvey({ status: "answered", answers: null }))).toBe("Answered");
  });

  it("words the quarterly refusal and keeps the keys it named", () => {
    const refusal = surveyError({
      status: 400,
      data: { code: "scores_required", questions: ["responsiveness", "quality"] },
    });
    expect(refusal.questionKeys).toEqual(["responsiveness", "quality"]);
    expect(describeSurveyError(refusal)).toBe(
      "This is the quarterly relationship survey. It asks five short questions, which are below.",
    );
  });
});
