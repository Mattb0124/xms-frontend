import { describe, expect, it } from "vitest";
import { ageLabel } from "@/app/(internal)/cases/dispatch/page";

const NOW = new Date("2026-09-08T12:00:00Z");

/**
 * The age chip on a Dispatch row (render 09): "26m", "3h", "yesterday". It is
 * how long the request has waited, which is what the row is triaged on.
 */
describe("the age on a Dispatch row", () => {
  it("counts up in the render's own words", () => {
    expect(ageLabel("2026-09-08T11:59:40Z", NOW)).toBe("just now");
    expect(ageLabel("2026-09-08T11:34:00Z", NOW)).toBe("26m");
    expect(ageLabel("2026-09-08T09:00:00Z", NOW)).toBe("3h");
    expect(ageLabel("2026-09-07T09:00:00Z", NOW)).toBe("yesterday");
    expect(ageLabel("2026-09-03T12:00:00Z", NOW)).toBe("5d");
  });

  it("stays an age however old the request is", () => {
    // A date would stop answering the question the chip asks.
    expect(ageLabel("2026-07-20T12:00:00Z", NOW)).toBe("50d");
    expect(ageLabel("2024-09-08T12:00:00Z", NOW)).toBe("2y");
  });

  it("never counts backwards from a clock that is ahead of the row", () => {
    expect(ageLabel("2026-09-08T12:30:00Z", NOW)).toBe("just now");
  });
});
