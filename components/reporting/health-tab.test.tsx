import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AccountHealthTab, whyLine } from "@/components/reporting/health-tab";
import { renderDesk, stubFetch, json } from "@/test-kit/desk";
import type { HealthFactor } from "@/redux/reportingApi";

function factor(overrides: Partial<HealthFactor> = {}): HealthFactor {
  return {
    key: "sla_resolution",
    label: "Resolution targets met",
    weight: 30,
    score: 100,
    contribution: 30,
    detail: { attainment_percent: 100, met: 5, due: 5 },
    ...overrides,
  };
}

const HEALTH = {
  account_id: "a1",
  window: { start: "2026-06-12T00:00:00Z", end: "2026-09-10T00:00:00Z", days: 90 },
  score: 72,
  band: "amber" as const,
  measured_weight: 90,
  factors: [
    factor(),
    factor({
      key: "csat",
      label: "Client satisfaction",
      weight: 25,
      score: 50,
      contribution: 13.9,
      detail: { mean_score: 3, responses: 4 },
    }),
    factor({
      key: "budget",
      label: "Budget position",
      weight: 20,
      score: null,
      contribution: 0,
      detail: { available_minutes: null, consumed_minutes: null, percent_consumed: null, percent_elapsed: null },
    }),
  ],
};

describe("whyLine", () => {
  it("words the counts behind each factor rather than the field names", () => {
    expect(whyLine(factor())).toBe("5 of 5 resolution targets met.");
    expect(whyLine(factor({ key: "csat", detail: { mean_score: 4.5, responses: 2 } }))).toBe(
      "4.5 out of 5 across 2 responses.",
    );
    expect(whyLine(factor({ key: "csat", detail: { mean_score: 5, responses: 1 } }))).toBe(
      "5 out of 5 across 1 response.",
    );
    expect(whyLine(factor({ key: "reopen_rate", detail: { reopened: 2, resolved: 8 } }))).toBe(
      "2 of 8 resolved cases came back.",
    );
  });

  it("says a factor was not judged rather than reading zero into it", () => {
    expect(whyLine(factor({ key: "csat", detail: { mean_score: null, responses: 0 } }))).toBe(
      "Nobody has answered a survey in the window.",
    );
    expect(whyLine(factor({ key: "budget", detail: { percent_consumed: null, percent_elapsed: null } }))).toBe(
      "No contract period is open.",
    );
    expect(
      whyLine(
        factor({
          key: "engagement",
          detail: { portal_enabled: false, portal_signins: 0, surveys_sent: 0, surveys_answered: 0 },
        }),
      ),
    ).toBe("The portal is off and no survey has been sent, so this is not judged.");
  });

  it("names how far a budget is ahead of its own calendar", () => {
    expect(whyLine(factor({ key: "budget", detail: { percent_consumed: 70, percent_elapsed: 40 } }))).toBe(
      "70% of the hours used 30 points ahead of the calendar.",
    );
    expect(whyLine(factor({ key: "budget", detail: { percent_consumed: 20, percent_elapsed: 40 } }))).toBe(
      "20% of the hours used against 40% of the period.",
    );
  });
});

describe("AccountHealthTab", () => {
  it("shows the score with its band, how much signal it stands on, and every factor", async () => {
    stubFetch({ "GET /v1/accounts/a1/health": () => json(HEALTH) });
    renderDesk(<AccountHealthTab id="a1" />);

    expect(await screen.findByText("72")).toBeInTheDocument();
    expect(screen.getByText("Watch")).toBeInTheDocument();
    expect(screen.getByText(/90 of 100 points of signal/)).toBeInTheDocument();

    const table = within(screen.getByRole("table", { name: "What the score stands on" }));
    expect(table.getByText("Resolution targets met")).toBeInTheDocument();
    expect(table.getByText("5 of 5 resolution targets met.")).toBeInTheDocument();
    expect(table.getByText("3 out of 5 across 4 responses.")).toBeInTheDocument();
  });

  it("says a factor was not measured rather than drawing it at zero", async () => {
    stubFetch({ "GET /v1/accounts/a1/health": () => json(HEALTH) });
    renderDesk(<AccountHealthTab id="a1" />);

    const table = within(await screen.findByRole("table", { name: "What the score stands on" }));
    expect(table.getByText("Not measured")).toBeInTheDocument();
    expect(table.getByText("none")).toBeInTheDocument();
  });
});
