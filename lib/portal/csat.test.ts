import { describe, expect, it } from "vitest";
import {
  describeSurveyError,
  expiryLabel,
  isSurveyLink,
  scoreLabel,
  surveyError,
  surveyQuestion,
} from "@/lib/portal/csat";

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
