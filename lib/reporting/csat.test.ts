import { describe, expect, it } from "vitest";
import {
  defaultCsatRange,
  distributionRows,
  formatAverage,
  hasQuarterly,
  isDay,
  latestPeriodLabel,
  quarterlyQuestionRows,
  quarterlyTrendRows,
  respondentLabel,
  scoreTone,
} from "@/lib/reporting/csat";
import { aCsatQuarterly } from "@/test-kit/reporting";

describe("csat view helpers", () => {
  it("defaults to the last ninety days like the API", () => {
    expect(defaultCsatRange(new Date("2026-09-07T12:00:00Z"))).toEqual({ from: "2026-06-09", to: "2026-09-07" });
    expect(isDay("2026-09-07")).toBe(true);
    expect(isDay("2026-9-7")).toBe(false);
  });

  it("words the average and the respondent", () => {
    expect(formatAverage(3.5)).toBe("3.5 of 5");
    expect(formatAverage(4)).toBe("4.0 of 5");
    expect(formatAverage(null)).toBe("No responses yet");
    expect(respondentLabel({ contact_name: "Pat Client", contact_email: "pat@client.test" })).toBe(
      "Pat Client (pat@client.test)",
    );
    expect(respondentLabel({ contact_name: "Pat Client", contact_email: null })).toBe("Pat Client");
    expect(respondentLabel({ contact_name: null, contact_email: null })).toBe("Anonymous");
  });

  it("builds five rows from very satisfied down, sized against the largest count", () => {
    const rows = distributionRows({ distribution: { "1": 0, "2": 1, "3": 0, "4": 2, "5": 4 } });
    expect(rows.map((row) => [row.score, row.label, row.count, row.percent])).toEqual([
      [5, "Very satisfied", 4, 100],
      [4, "Satisfied", 2, 50],
      [3, "Neutral", 0, 0],
      [2, "Dissatisfied", 1, 25],
      [1, "Very dissatisfied", 0, 0],
    ]);
    expect(
      distributionRows({ distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 } }).every((row) => row.percent === 0),
    ).toBe(true);
    expect([1, 2, 3, 4, 5].map(scoreTone)).toEqual(["overdue", "overdue", "needs-input", "complete", "complete"]);
  });
});

describe("the quarterly relationship block", () => {
  it("is read only when the API answered with one that has something in it", () => {
    expect(hasQuarterly(undefined)).toBe(false);
    expect(hasQuarterly({ latest_period: null, responses: 0, averages: {}, average: null, trend: [] })).toBe(false);
    expect(hasQuarterly(aCsatQuarterly())).toBe(true);
    // A period with no answer yet is still a block worth drawing.
    expect(
      hasQuarterly({
        latest_period: null,
        responses: 0,
        averages: {},
        average: null,
        trend: [{ period: "2026-Q1", responses: 1, average: 4 }],
      }),
    ).toBe(true);
  });

  it("rows the questions in the order the survey asks them, with the server's averages", () => {
    const rows = quarterlyQuestionRows(aCsatQuarterly());
    expect(rows.map((row) => [row.key, row.label, row.average])).toEqual([
      ["responsiveness", "Responsiveness", 4.33],
      ["quality", "Quality", 4.67],
      ["communication", "Communication", 3.67],
      ["value", "Value", 3],
      ["recommend", "Recommend", 4.33],
    ]);
    // With no questions named, the averages themselves are the order, and a
    // question nobody answered reads as null rather than as a zero.
    const bare = quarterlyQuestionRows(aCsatQuarterly({ questions: undefined, averages: { quality: 5, value: null } }));
    expect(bare.map((row) => [row.key, row.average])).toEqual([
      ["quality", 5],
      ["value", null],
    ]);
  });

  it("reads the trend oldest first with each mean against the five-point scale", () => {
    const rows = quarterlyTrendRows(aCsatQuarterly());
    expect(rows.map((row) => [row.label, row.responses, row.average, row.percent])).toEqual([
      ["2025 Q3", 2, 3.4, 68],
      ["2025 Q4", 2, 3.8, 76],
      ["2026 Q1", 4, 3.9, 78],
      ["2026 Q2", 3, 4, 80],
    ]);
    expect(quarterlyTrendRows(aCsatQuarterly({ trend: [{ period: "2026-Q2", responses: 0, average: null }] }))).toEqual(
      [{ period: "2026-Q2", label: "2026 Q2", responses: 0, average: null, percent: 0 }],
    );
    expect(latestPeriodLabel(aCsatQuarterly())).toBe("2026 Q2");
    expect(latestPeriodLabel(aCsatQuarterly({ latest_period: null }))).toBe("No period answered yet");
  });
});
