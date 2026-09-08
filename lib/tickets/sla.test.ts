import { describe, expect, it } from "vitest";
import {
  clockDisplay,
  formatMinutes,
  localRemainingMinutes,
  meterCaption,
  meterDetail,
  meterPercent,
  pauseCaption,
  tighterClock,
  type ClockView,
} from "@/lib/tickets/sla";

const now = new Date("2026-09-07T10:00:00Z");
const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000).toISOString();

function clock(overrides: Partial<ClockView>): ClockView {
  return {
    kind: "resolution",
    dueAt: at(120),
    remainingMinutes: 120,
    paused: false,
    breached: false,
    met: false,
    targetMinutes: 480,
    pausedTotalMinutes: 0,
    ...overrides,
  };
}

describe("clockDisplay tones", () => {
  it("is ok with plenty of time left and warn under a quarter of the window", () => {
    expect(clockDisplay(clock({}), now)).toEqual({ label: "2h 00m", tone: "ok" });
    expect(clockDisplay(clock({ dueAt: at(60), remainingMinutes: 60 }), now).tone).toBe("warn");
  });

  it("is paused, breached and met in that precedence", () => {
    // Render 08's clock column reads "paused" on its own: a paused clock has
    // no remaining time to count, and a figure beside the word would be
    // elapsed time, which the column never shows.
    expect(clockDisplay(clock({ paused: true }), now)).toEqual({ label: "paused", tone: "paused" });
    // A latched breach whose due time is not in the past, which is what a
    // reopened ticket carries: the number cannot answer, so the word does.
    expect(clockDisplay(clock({ breached: true }), now)).toEqual({ label: "Breached", tone: "breach" });
    // An overdue clock says how far past due it is, which is what decides
    // which breach is picked up first.
    expect(clockDisplay(clock({ dueAt: at(-30), remainingMinutes: -30 }), now)).toEqual({
      label: "-0h 30m",
      tone: "breach",
    });
    expect(clockDisplay(clock({ met: true, breached: true }), now)).toEqual({ label: "Met", tone: "met" });
    expect(clockDisplay(undefined, now)).toEqual({ label: "No SLA", tone: "none" });
  });
});

describe("tighterClock", () => {
  it("picks the live clock with the least time left and defers a met response clock", () => {
    const response = clock({ kind: "response", remainingMinutes: 20 });
    const resolution = clock({ remainingMinutes: 120 });
    expect(tighterClock({ response, resolution })?.kind).toBe("response");
    expect(tighterClock({ response: { ...response, met: true }, resolution })?.kind).toBe("resolution");
    expect(tighterClock({ response: { ...response, met: true }, resolution: { ...resolution, met: true } })?.kind).toBe(
      "resolution",
    );
    expect(tighterClock(undefined)).toBeUndefined();
  });
});

describe("local countdown", () => {
  it("counts down since the fetch but never moves a paused or met clock", () => {
    const fetched = new Date(now.getTime() - 15 * 60_000);
    expect(localRemainingMinutes(clock({}), fetched, now)).toBe(105);
    expect(localRemainingMinutes(clock({ paused: true }), fetched, now)).toBe(120);
    expect(localRemainingMinutes(clock({ met: true }), fetched, now)).toBe(120);
  });

  it("reports the elapsed share for the meter and a caption in words", () => {
    expect(meterPercent(clock({}), now, now)).toBe(75);
    expect(meterPercent(clock({ remainingMinutes: -30 }), now, now)).toBe(100);
    expect(meterCaption(clock({}), now, now)).toBe("Resolution 2h 00m of 8h 00m left");
    expect(meterCaption(clock({ paused: true }), now, now)).toBe("Resolution 2h 00m of 8h 00m left (paused)");
    expect(meterCaption(clock({ remainingMinutes: -40, breached: true }), now, now)).toBe("Resolution breached by 40m");
    expect(meterCaption(clock({ kind: "response", met: true }), now, now)).toBe("Response met");
  });

  /**
   * Review finding 21: the meters showed only "met" and "breached by", not
   * the target, elapsed and remaining time the wireframe asks for, and the
   * grey pause segment carried no reason.
   */
  it("names the target, the elapsed and the remaining time on every meter", () => {
    expect(meterDetail(clock({}), now, now)).toBe("Target 8h 00m, elapsed 6h 00m, 2h 00m left");
    expect(meterDetail(clock({ met: true, remainingMinutes: 300 }), now, now)).toBe(
      "Target 8h 00m, met with 5h 00m to spare",
    );
    expect(meterDetail(clock({ remainingMinutes: -40, breached: true }), now, now)).toBe(
      "Target 8h 00m, breached by 40m",
    );
  });

  it("gives the grey segment its reason only while the clock is actually paused", () => {
    expect(pauseCaption(clock({}))).toBeNull();
    expect(pauseCaption(clock({ pausedTotalMinutes: 130, paused: true }), "Awaiting client")).toBe(
      "Grey segment is 2h 10m paused, awaiting client.",
    );
    expect(pauseCaption(clock({ pausedTotalMinutes: 130 }), "Awaiting client")).toBe("Grey segment is 2h 10m paused.");
    expect(pauseCaption(clock({ pausedTotalMinutes: 130, paused: true }))).toBe("Grey segment is 2h 10m paused.");
  });

  it("formats minutes as m, h m, or d h", () => {
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(125)).toBe("2h 05m");
    expect(formatMinutes(1500)).toBe("1d 1h");
  });
});
