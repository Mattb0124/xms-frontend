import { describe, expect, it } from "vitest";
import { formatDay, formatMoment, formatTime } from "@/lib/format/date";

const UTC = "UTC";

describe("formatMoment", () => {
  it("writes the one format the product uses", () => {
    expect(formatMoment("2026-09-09T17:30:29Z", UTC)).toBe("09/09/2026 05:30:29 PM");
    expect(formatMoment("2026-08-07T10:33:26Z", UTC)).toBe("08/07/2026 10:33:26 AM");
  });

  it("pads a single-digit month, day and hour, so a column of them lines up", () => {
    expect(formatMoment("2026-01-02T03:04:05Z", UTC)).toBe("01/02/2026 03:04:05 AM");
  });

  it("writes midnight and noon the way a clock does", () => {
    expect(formatMoment("2026-09-09T00:00:00Z", UTC)).toBe("09/09/2026 12:00:00 AM");
    expect(formatMoment("2026-09-09T12:00:00Z", UTC)).toBe("09/09/2026 12:00:00 PM");
  });

  it("reads a moment in the zone it is asked for", () => {
    // The same instant is the previous evening in New York.
    expect(formatMoment("2026-09-09T02:30:00Z", "America/New_York")).toBe("09/08/2026 10:30:00 PM");
  });

  it("invents no time for a value that names only a day", () => {
    expect(formatMoment("2026-09-09", UTC)).toBe("09/09/2026");
  });

  it("gives back what it was given rather than printing Invalid Date", () => {
    expect(formatMoment("not a date", UTC)).toBe("not a date");
    expect(formatMoment(null)).toBe("");
    expect(formatMoment(undefined)).toBe("");
    expect(formatMoment("")).toBe("");
  });
});

describe("formatDay", () => {
  it("reads a bare day as a day, not as midnight somewhere else", () => {
    // Without this rule the ninth becomes the eighth for every reader west
    // of Greenwich, which is most of Hackett.
    expect(formatDay("2026-09-09", "America/Los_Angeles")).toBe("09/09/2026");
    expect(formatDay("2026-01-01", "America/Los_Angeles")).toBe("01/01/2026");
  });

  it("takes the day out of an instant, in the reader's zone", () => {
    expect(formatDay("2026-09-09T02:30:00Z", "America/New_York")).toBe("09/08/2026");
    expect(formatDay("2026-09-09T02:30:00Z", UTC)).toBe("09/09/2026");
  });

  it("gives back what it was given rather than printing Invalid Date", () => {
    expect(formatDay("whenever", UTC)).toBe("whenever");
    expect(formatDay(null)).toBe("");
  });
});

describe("formatTime", () => {
  it("is the clock alone, for a row that already names the day", () => {
    expect(formatTime("2026-09-09T17:30:29Z", UTC)).toBe("05:30:29 PM");
  });

  it("gives back what it was given rather than printing Invalid Date", () => {
    expect(formatTime("half past", UTC)).toBe("half past");
    expect(formatTime(null)).toBe("");
  });
});
