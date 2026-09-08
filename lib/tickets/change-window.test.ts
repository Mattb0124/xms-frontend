import { describe, expect, it } from "vitest";
import {
  ACKNOWLEDGE_CODES,
  changeWindowDetail,
  changeWindowRefusal,
  changeWindowTitle,
  daysUntil,
  isChangeWindowCode,
  monthLabel,
  monthRange,
  nextWindow,
  OVERRIDE_CODES,
  OVERRIDE_PERMISSION,
  shiftMonth,
} from "@/lib/tickets/change-window";

const refuse = (data: Record<string, unknown>) => ({ status: 409, data });

/**
 * The four window refusals (TM-10, TM-18). Two are warnings a reason
 * acknowledges; two are overrides that additionally need the permission the
 * API names in the body.
 */
describe("changeWindowRefusal", () => {
  it("knows the four codes and nothing else", () => {
    expect([...ACKNOWLEDGE_CODES]).toEqual(["change_freeze", "change_conflict"]);
    expect([...OVERRIDE_CODES]).toEqual(["outside_change_window", "change_window_required"]);
    expect(isChangeWindowCode("change_freeze")).toBe(true);
    expect(isChangeWindowCode("stale_version")).toBe(false);
    expect(changeWindowRefusal(refuse({ code: "stale_version" }))).toBeNull();
    expect(changeWindowRefusal(undefined)).toBeNull();
  });

  it("reads a freeze refusal as an acknowledgement with the freeze that caused it", () => {
    const refusal = changeWindowRefusal(
      refuse({
        code: "change_freeze",
        window: "October release window",
        freeze: { starts_at: "2026-10-03T20:00:00Z", ends_at: "2026-10-03T21:00:00Z", reason: "Month-end close" },
      }),
    );
    expect(refusal?.kind).toBe("acknowledge");
    expect(refusal?.freeze?.reason).toBe("Month-end close");
    expect(changeWindowTitle(refusal!)).toContain("October release window");
    expect(changeWindowDetail(refusal!)).toContain("Month-end close");
  });

  it("reads a clash as an acknowledgement naming the tickets in the way", () => {
    const refusal = changeWindowRefusal(
      refuse({
        code: "change_conflict",
        window: "October release window",
        conflicts: [{ key: "CS1000420", group_name: "October release window" }, { group_name: "nameless" }],
      }),
    );
    expect(refusal?.kind).toBe("acknowledge");
    // A conflict row with no key names nothing and is dropped rather than
    // drawn as a blank line.
    expect(refusal?.conflicts).toEqual([{ key: "CS1000420", group_name: "October release window" }]);
    expect(changeWindowDetail(refusal!)).toContain("CS1000420");
  });

  it("reads being outside the window as an override, with the span and the permission", () => {
    const refusal = changeWindowRefusal(
      refuse({
        code: "outside_change_window",
        window: "October release window",
        starts_at: "2026-10-03T18:00:00Z",
        ends_at: "2026-10-04T02:00:00Z",
        freeze: null,
        at: "2026-10-05T09:00:00Z",
        permission: OVERRIDE_PERMISSION,
      }),
    );
    expect(refusal?.kind).toBe("override");
    expect(refusal?.permission).toBe("tickets:override-change-window");
    expect(refusal?.starts_at).toBe("2026-10-03T18:00:00Z");
    expect(changeWindowTitle(refusal!)).toContain("outside October release window");
    expect(changeWindowDetail(refusal!)).toContain("not open right now");
  });

  it("words a ticket that belongs to no window at all", () => {
    const refusal = changeWindowRefusal(refuse({ code: "change_window_required", window: null }));
    expect(refusal?.kind).toBe("override");
    expect(refusal?.window).toBeNull();
    expect(changeWindowTitle(refusal!)).toBe("This ticket belongs to no change window");
    expect(changeWindowDetail(refusal!)).toContain("record why it goes out without one");
  });

  it("says the window is frozen rather than closed when a freeze covers the instant", () => {
    const refusal = changeWindowRefusal(
      refuse({
        code: "outside_change_window",
        window: "October release window",
        freeze: { starts_at: "2026-10-03T20:00:00Z", ends_at: "2026-10-03T21:00:00Z" },
      }),
    );
    expect(changeWindowDetail(refusal!)).toContain("frozen right now");
  });
});

describe("the calendar's month", () => {
  it("covers the whole month as the instants the range route takes", () => {
    const range = monthRange(new Date("2026-10-14T12:00:00Z"));
    expect(range.from).toBe("2026-10-01T00:00:00.000Z");
    expect(range.to).toBe("2026-11-01T00:00:00.000Z");
    expect(monthLabel(new Date("2026-10-14T12:00:00Z"))).toBe("October 2026");
  });

  it("steps across a year boundary in both directions", () => {
    expect(monthLabel(shiftMonth(new Date("2026-12-14T12:00:00Z"), 1))).toBe("January 2027");
    expect(monthLabel(shiftMonth(new Date("2026-01-14T12:00:00Z"), -1))).toBe("December 2025");
  });

  it("names the next window to open, and counts the whole days to it", () => {
    const now = new Date("2026-10-01T00:00:00Z");
    const windows = [{ starts_at: "2026-10-20T18:00:00Z" }, { starts_at: "2026-10-03T18:00:00Z" }];
    expect(nextWindow(windows, now)?.starts_at).toBe("2026-10-03T18:00:00Z");
    expect(daysUntil("2026-10-03T18:00:00Z", now)).toBe(2);
    // A window already running is not the next one; the "right now" line says so.
    expect(nextWindow([{ starts_at: "2026-09-30T18:00:00Z" }], now)).toBeUndefined();
  });
});
