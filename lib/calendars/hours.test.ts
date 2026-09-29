import { describe, expect, it } from "vitest";
import { formatMoment } from "@/lib/format/date";
import {
  formatDuration,
  formatHHMM,
  formatInZone,
  gridToHours,
  hoursToGrid,
  parseHHMM,
  standardGrid,
  weeklyMinutes,
} from "@/lib/calendars/hours";

describe("calendar hours grammar", () => {
  it("parses and formats HH:MM as minutes from midnight", () => {
    expect(parseHHMM("09:00")).toBe(540);
    expect(parseHHMM("9:05")).toBe(545);
    expect(parseHHMM("24:00")).toBe(1440);
    expect(parseHHMM("24:30")).toBeNull();
    expect(parseHHMM("09:60")).toBeNull();
    expect(parseHHMM("nine")).toBeNull();
    expect(formatHHMM(570)).toBe("09:30");
    expect(formatHHMM(1440)).toBe("24:00");
  });

  it("converts the week grid to API hours with 0 = Sunday, sorted, and sums the week", () => {
    const grid = standardGrid("08:00", "18:00");
    grid[0] = [{ start: "10:00", end: "12:00" }];
    grid[3] = [
      { start: "13:00", end: "17:00" },
      { start: "08:00", end: "12:00" },
    ];
    const { hours, problems } = gridToHours(grid);
    expect(problems).toEqual([]);
    expect(hours).toEqual([
      { weekday: 1, start_minute: 480, end_minute: 1080 },
      { weekday: 2, start_minute: 480, end_minute: 1080 },
      { weekday: 3, start_minute: 480, end_minute: 720 },
      { weekday: 3, start_minute: 780, end_minute: 1020 },
      { weekday: 4, start_minute: 480, end_minute: 1080 },
      { weekday: 5, start_minute: 480, end_minute: 1080 },
      { weekday: 0, start_minute: 600, end_minute: 720 },
    ]);
    expect(weeklyMinutes(hours)).toBe(4 * 600 + 480 + 120);
    expect(formatDuration(weeklyMinutes(hours))).toBe("50 h");
    expect(formatDuration(90)).toBe("1 h 30 min");
    expect(formatDuration(45)).toBe("45 min");
  });

  it("names the problems in the server's words", () => {
    const grid = standardGrid();
    grid[1] = [
      { start: "09:00", end: "08:00" },
      { start: "08:30", end: "12:00" },
      { start: "11:00", end: "abc" },
    ];
    expect(gridToHours(grid).problems).toEqual([
      "Monday interval 1: end must be after start",
      "Monday interval 3: end must be HH:MM",
      "Monday: intervals overlap",
    ]);
    const empty = standardGrid();
    for (const weekday of [1, 2, 3, 4, 5]) empty[weekday] = [];
    expect(gridToHours(empty).problems).toEqual(["at least one working interval is required"]);
  });

  it("round-trips API hours into the grid", () => {
    const grid = hoursToGrid([
      { weekday: 3, start_minute: 780, end_minute: 1020 },
      { weekday: 3, start_minute: 480, end_minute: 720 },
      { weekday: 0, start_minute: 600, end_minute: 720 },
    ]);
    expect(grid[3]).toEqual([
      { start: "08:00", end: "12:00" },
      { start: "13:00", end: "17:00" },
    ]);
    expect(grid[0]).toEqual([{ start: "10:00", end: "12:00" }]);
    expect(grid[1]).toEqual([]);
  });

  it("formats an instant in a named zone and survives an unknown zone", () => {
    expect(formatInZone("2026-09-14T11:00:00.000Z", "Europe/London")).toBe("Mon, 14 Sept 2026, 12:00");
    expect(formatInZone("2026-09-14T11:00:00.000Z", "Australia/Sydney")).toBe("Mon, 14 Sept 2026, 21:00");
    expect(formatInZone("2026-09-14T11:00:00.000Z", "Mars/Olympus")).toBe(formatMoment("2026-09-14T11:00:00.000Z"));
    expect(formatInZone("nonsense", "UTC")).toBe("nonsense");
  });
});
