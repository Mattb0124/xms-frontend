import { describe, expect, it } from "vitest";
import { elapsedWindowCopy, reopenSentence } from "@/lib/tickets/reopen-window";

describe("reopenSentence", () => {
  it("names the deadline when the window is open, elapsed, never, or missing a start", () => {
    expect(
      reopenSentence({
        days: 5,
        source: "account",
        started_on: "2026-09-14",
        deadline: "2026-09-21",
        allowed: true,
      }),
    ).toBe("Reopened inside the 5 working-day window (deadline 2026-09-21).");
    expect(
      reopenSentence(
        {
          days: 5,
          source: "account",
          started_on: "2026-09-14",
          deadline: "2026-09-21",
          allowed: true,
        },
        "reply",
      ),
    ).toBe("reply inside reopen window (5 working days, deadline 2026-09-21).");
    expect(
      elapsedWindowCopy({ days: 5, deadline: "2026-09-21" }),
    ).toBe("The 5 working-day reopen window ended on 2026-09-21.");
    expect(elapsedWindowCopy({ days: 0, deadline: null })).toBe("The reopen window is set to never.");
  });
});
