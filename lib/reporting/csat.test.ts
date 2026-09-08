import { describe, expect, it } from "vitest";
import {
  defaultCsatRange,
  distributionRows,
  formatAverage,
  isDay,
  respondentLabel,
  scoreTone,
} from "@/lib/reporting/csat";

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
    expect(distributionRows({ distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 } }).every((row) => row.percent === 0)).toBe(
      true,
    );
    expect([1, 2, 3, 4, 5].map(scoreTone)).toEqual(["overdue", "overdue", "needs-input", "complete", "complete"]);
  });
});
