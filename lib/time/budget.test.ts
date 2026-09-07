import { describe, expect, it } from "vitest";
import {
  budgetTone,
  consumedPercent,
  describeOverage,
  describeRollover,
  forecastBasis,
  forecastSentence,
  formatAmount,
  formatHours,
  formatMoney,
  overageBlockedMessage,
  thresholdLabel,
  thresholdMarkers,
  unratedNote,
} from "@/lib/time/budget";
import { aBudgetCard, aForecast, aPosition, aThresholdEvent, aThresholds } from "@/redux/timeApi.test";

describe("budget words", () => {
  it("shows hours with one decimal only where the minutes are not whole hours", () => {
    expect(formatHours(0)).toBe("0 h");
    expect(formatHours(60)).toBe("1 h");
    expect(formatHours(90)).toBe("1.5 h");
    expect(formatHours(100)).toBe("1.7 h");
    expect(formatHours(2400)).toBe("40 h");
  });

  it("formats amounts with the currency and two decimals", () => {
    expect(formatMoney("150.5")).toBe("150.50");
    expect(formatMoney("abc")).toBeNull();
    expect(formatMoney(null)).toBeNull();
    expect(formatAmount("225.00", "USD")).toBe("USD 225.00");
    expect(formatAmount(1225, "EUR")).toBe("EUR 1,225.00");
    expect(formatAmount(null, "USD")).toBe("n/a");
  });

  it("picks the bar tone: on track, amber after a fired threshold, red when over", () => {
    expect(budgetTone(aBudgetCard())).toBe("good");
    expect(budgetTone(aBudgetCard({ thresholds: aThresholds({ fired: [50], next_percent: 75 }) }))).toBe("warn");
    const { contract: _contract, ...over } = aPosition({ consumed_minutes: 2500, status: "over" });
    void _contract;
    expect(budgetTone(aBudgetCard({ position: over, thresholds: aThresholds({ fired: [50, 75, 90, 100] }) }))).toBe(
      "breach",
    );
    expect(budgetTone(aBudgetCard({ position: null, thresholds: null }))).toBe("good");
    expect(consumedPercent(over)).toBeCloseTo(104.17, 1);
    expect(consumedPercent(null)).toBe(0);
  });

  it("words the forecast with the server's figures", () => {
    expect(forecastSentence(aForecast(), 2400)).toBe(
      "At the current rate of 2 h per business day the period ends at 110% of the budget; the budget runs out in 15 business days.",
    );
    expect(
      forecastSentence(
        aForecast({ run_rate_minutes: 90, forecast_percent: 88.5, business_days_to_exhaustion: null }),
        2400,
      ),
    ).toBe(
      "At the current rate of 1.5 h per business day the period ends at 88.5% of the budget; the budget lasts the period.",
    );
    expect(forecastSentence(aForecast({ business_days_to_exhaustion: 0 }), 2400)).toContain(
      "the budget is already used up.",
    );
    expect(forecastSentence(aForecast({ business_days_to_exhaustion: 1 }), 2400)).toContain("in 1 business day.");
    expect(forecastSentence(aForecast({ forecast_minutes: 600, forecast_percent: 0 }), 0)).toBe(
      "At the current rate of 2 h per business day the period ends at 10 h; this period has no budget to measure against.",
    );
    expect(forecastBasis(aForecast())).toBe("Rate over the last 5 business days; 5 of 22 business days elapsed.");
  });

  it("orders the threshold markers, marks the fired ones and names the next", () => {
    const markers = thresholdMarkers(
      aThresholds({
        percents: [100, 50, 75, 50],
        fired: [50],
        next_percent: 75,
        next_at_minutes: 1800,
        events: [aThresholdEvent()],
      }),
      2400,
    );
    expect(markers.map((marker) => [marker.percent, marker.fired, marker.next, marker.atMinutes])).toEqual([
      [50, true, false, 1200],
      [75, false, true, 1800],
      [100, false, false, 2400],
    ]);
    expect(markers.map(thresholdLabel)).toEqual(["50% fired 2026-09-04", "75% next, at 30 h", "100%"]);
    expect(thresholdLabel({ percent: 90, fired: true, next: false, firedAt: null, atMinutes: 0 })).toBe("90% fired");
  });

  it("notes unrated minutes only when there are some", () => {
    expect(unratedNote(0)).toBeNull();
    expect(unratedNote(90)).toBe(
      "1.5 h in this period carry no rate; add a rate card for the roles involved before the period locks.",
    );
  });

  it("words the overage and rollover rules", () => {
    expect(describeOverage("block")).toBe("Overage blocked");
    expect(describeOverage("allow_flag")).toBe("Overage allowed with flag");
    expect(describeOverage("allow_rate", "1.250")).toBe("Overage at 1.25x");
    expect(describeOverage("allow_rate", null)).toBe("Overage at the overage rate");
    expect(describeRollover("none")).toBe("No rollover");
    expect(describeRollover("carry_month")).toBe("Carries a month");
    expect(describeRollover("carry_term")).toBe("Carries to term");
    expect(describeRollover("cap", "20.00")).toBe("Carries to term, capped at 20 h");
  });

  it("words the overage_blocked refusal from the typed body and ignores other errors", () => {
    expect(
      overageBlockedMessage({
        status: 409,
        data: { code: "overage_blocked", available_minutes: 600, consumed_minutes: 570, requested_minutes: 60 },
      }),
    ).toBe("This entry would take the period over its 10 h budget (9.5 h used); the contract blocks overage.");
    expect(overageBlockedMessage({ status: 409, data: { code: "billing_period_locked" } })).toBeNull();
    expect(overageBlockedMessage(new Error("x"))).toBeNull();
  });
});
