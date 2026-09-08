import { describe, expect, it } from "vitest";
import { capacityError, describeCapacityError } from "@/lib/capacity/errors";
import {
  addMonths,
  COVERAGE_STATUS,
  coverageChipLabel,
  currentMonth,
  DEMAND_SOURCE,
  DEMAND_TEMPLATE_EXAMPLE,
  demandSubject,
  formatProbability,
  formatSignedHours,
  formatVariancePercent,
  fractionLabel,
  groupSkillsByKind,
  hoursTextToMinutes,
  isMonth,
  levelCellClass,
  minutesToHoursText,
  monthEnd,
  monthLabel,
  monthStart,
  remainingLabel,
  weightedMinutes,
} from "@/lib/capacity/vocab";
import { aCapacityCheck, aDemandRow, aProjectDemandRow, aSkillsMatrixPeople } from "@/redux/capacityApi.test";

describe("capacity vocab", () => {
  it("weights demand like the server, words the sources and subjects, and moves months", () => {
    expect(weightedMinutes(aDemandRow())).toBe(6000);
    expect(weightedMinutes(aDemandRow({ hours: 10, probability: 0.33 }))).toBe(198);
    // Project demand counts in full whatever probability the row carries.
    expect(weightedMinutes(aProjectDemandRow({ probability: 0.1 }))).toBe(2400);
    expect(weightedMinutes(aDemandRow({ source: "import", hours: 100, probability: 0.25 }))).toBe(1500);
    expect(formatProbability(0.5)).toBe("50%");
    expect(formatProbability(1)).toBe("100%");
    expect(DEMAND_SOURCE.pipeline.label).toBe("Pipeline");
    expect(DEMAND_SOURCE.project.tone).toBe("complete");
    expect(demandSubject(aDemandRow())).toBe("Acme Corp");
    expect(demandSubject(aProjectDemandRow())).toBe("BRK");
    expect(
      demandSubject({ account_key: null, prospect_name: null, account_id: "55555555-5555-4555-8555-555555555555" }),
    ).toBe("55555555");
    expect(addMonths("2026-09", 3)).toBe("2026-12");
    expect(addMonths("2026-11", 3)).toBe("2027-02");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(DEMAND_TEMPLATE_EXAMPLE.split("\n")[0]).toBe("source,account,prospect,month,hours,probability,role");
  });

  it("words the coverage statuses and the account record chips, and ramps the heat map by level", () => {
    expect(COVERAGE_STATUS.ok).toEqual({ label: "Covered", tone: "complete" });
    expect(COVERAGE_STATUS.spof).toEqual({ label: "Single point of failure", tone: "needs-input" });
    expect(COVERAGE_STATUS.gap).toEqual({ label: "Gap", tone: "overdue" });
    expect(coverageChipLabel("spof", "OneStream")).toBe("Single point of failure: OneStream");
    expect(coverageChipLabel("gap", "SAP")).toBe("Gap: SAP");
    expect(levelCellClass(undefined)).toBe("");
    expect(levelCellClass(1)).toContain("bg-xms-tint");
    expect(levelCellClass(4)).toContain("bg-xms-accent ");
    expect(new Set([1, 2, 3, 4].map(levelCellClass)).size).toBe(4);
  });

  it("groups the heat map columns by kind in the fixed order, names ascending inside a kind", () => {
    const groups = groupSkillsByKind([
      ...aSkillsMatrixPeople().skills,
      { id: "s-brk", code: "acct_brk", name: "Brookfield", kind: "account" },
    ]);
    expect(groups.map((group) => [group.label, group.skills.map((skill) => skill.code)])).toEqual([
      ["Technology", ["anaplan", "onestream"]],
      ["Account familiarity", ["acct_brk"]],
      ["Process", ["close"]],
    ]);
  });

  it("words the PTO fraction", () => {
    expect(fractionLabel("1.00")).toBe("Full days");
    expect(fractionLabel("0.50")).toBe("Half days");
    expect(fractionLabel(0.25)).toBe("0.25 of a day");
  });

  it("formats signed hours and the variance percent with one decimal only where needed", () => {
    expect(formatSignedHours(1320)).toBe("+22 h");
    expect(formatSignedHours(-90)).toBe("-1.5 h");
    expect(formatSignedHours(0)).toBe("0 h");
    expect(formatVariancePercent(0.55)).toBe("+55%");
    expect(formatVariancePercent(-0.104)).toBe("-10%");
    expect(formatVariancePercent(0)).toBe("0%");
    expect(formatVariancePercent(null)).toBe("n/a");
  });

  it("words the picker hint from the check: room left, over by, no calendar", () => {
    expect(remainingLabel(aCapacityCheck())).toBe("76.8 h left");
    expect(
      remainingLabel(
        aCapacityCheck({ status: "over", remaining_minutes: 0, allocated_minutes: 8400, available_minutes: 7603 }),
      ),
    ).toBe("Over by 13.3 h");
    expect(remainingLabel(aCapacityCheck({ status: "no_calendar", available_minutes: 0, remaining_minutes: 0 }))).toBe(
      "No calendar",
    );
  });

  it("handles months: validity, bounds, label and the local current month", () => {
    expect(isMonth("2026-09")).toBe(true);
    expect(isMonth("2026-13")).toBe(false);
    expect(isMonth("2026-9")).toBe(false);
    expect(monthStart("2026-09")).toBe("2026-09-01");
    expect(monthStart("2026-09-01")).toBe("2026-09-01");
    expect(monthEnd("2026-09")).toBe("2026-09-30");
    expect(monthEnd("2028-02")).toBe("2028-02-29");
    expect(monthLabel("2026-09")).toBe("September 2026");
    expect(monthLabel("2026-12-01")).toBe("December 2026");
    expect(currentMonth(new Date(2026, 8, 7))).toBe("2026-09");
  });

  it("converts grid cell text to minutes and back", () => {
    expect(minutesToHoursText(3600)).toBe("60");
    expect(minutesToHoursText(90)).toBe("1.5");
    expect(minutesToHoursText(undefined)).toBe("");
    expect(hoursTextToMinutes("")).toBe(0);
    expect(hoursTextToMinutes("0")).toBe(0);
    expect(hoursTextToMinutes("1.5")).toBe(90);
    expect(hoursTextToMinutes("70")).toBe(4200);
    expect(hoursTextToMinutes("-1")).toBeNull();
    expect(hoursTextToMinutes("lots")).toBeNull();
  });
});

describe("capacity errors", () => {
  it("parses the typed bodies into fixed copy", () => {
    expect(describeCapacityError(capacityError({ status: 400, data: { code: "invalid_range" } }))).toBe(
      "The time off must end on or after it starts.",
    );
    expect(describeCapacityError(capacityError({ status: 400, data: { code: "bad_month", month: "2026-9" } }))).toBe(
      "The month must be written as YYYY-MM.",
    );
    const stale = capacityError({ status: 409, data: { code: "stale_version", entity: "allocation", current: 3 } });
    expect(stale.current).toBe(3);
    expect(describeCapacityError(stale)).toBe("Someone else changed the allocations. They have been reloaded.");
    expect(describeCapacityError(capacityError({ status: 403, data: { code: "forbidden", account_id: "a-1" } }))).toBe(
      "You are not granted that account, so its cells cannot be written.",
    );
    expect(
      describeCapacityError(capacityError({ status: 403, data: { code: "forbidden", permission: "capacity:manage" } })),
    ).toBe("Only the person themselves or a capacity manager may change this.");
    expect(describeCapacityError(capacityError({ status: 404, data: { code: "not_found", entity: "pto" } }))).toBe(
      "That time off has already been removed.",
    );
  });
});

describe("demand errors", () => {
  it("words subject_required, the import problems and the unknown account keys", () => {
    expect(describeCapacityError(capacityError({ status: 400, data: { code: "subject_required" } }))).toBe(
      "Name an account or a prospect.",
    );
    const invalid = capacityError({
      status: 400,
      data: {
        code: "invalid_import",
        problems: [
          { line: 2, problem: "month must be YYYY-MM" },
          { line: 3, problem: "x" },
        ],
      },
    });
    expect(invalid.problems).toEqual([
      { line: 2, problem: "month must be YYYY-MM" },
      { line: 3, problem: "x" },
    ]);
    expect(describeCapacityError(invalid)).toBe("The file has 2 problems; nothing was imported.");
    const unknown = capacityError({ status: 400, data: { code: "unknown_account", keys: ["ZZZ", "YYY"] } });
    expect(unknown.keys).toEqual(["ZZZ", "YYY"]);
    expect(describeCapacityError(unknown)).toBe("Unknown or not granted account keys: ZZZ, YYY. Nothing was imported.");
    expect(describeCapacityError(capacityError({ status: 404, data: { code: "not_found", entity: "demand" } }))).toBe(
      "That demand line has already been removed.",
    );
  });
});
