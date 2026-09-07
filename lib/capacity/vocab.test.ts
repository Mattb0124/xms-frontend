import { describe, expect, it } from "vitest";
import { capacityError, describeCapacityError } from "@/lib/capacity/errors";
import {
  currentMonth,
  formatSignedHours,
  formatVariancePercent,
  fractionLabel,
  hoursTextToMinutes,
  isMonth,
  minutesToHoursText,
  monthEnd,
  monthLabel,
  monthStart,
  remainingLabel,
} from "@/lib/capacity/vocab";
import { aCapacityCheck } from "@/redux/capacityApi.test";

describe("capacity vocab", () => {
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
      remainingLabel(aCapacityCheck({ status: "over", remaining_minutes: 0, allocated_minutes: 8400, available_minutes: 7603 })),
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
