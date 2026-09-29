import { describe, expect, it } from "vitest";
import { derivePriority } from "@/lib/tickets/priority";

describe("priority preview matrix", () => {
  it("mirrors the backend seed cell for cell", () => {
    expect(derivePriority("high", "high")).toBe("p1");
    expect(derivePriority("high", "medium")).toBe("p2");
    expect(derivePriority("high", "low")).toBe("p3");
    expect(derivePriority("medium", "high")).toBe("p2");
    expect(derivePriority("medium", "medium")).toBe("p3");
    expect(derivePriority("medium", "low")).toBe("p4");
    expect(derivePriority("low", "high")).toBe("p3");
    expect(derivePriority("low", "medium")).toBe("p4");
    expect(derivePriority("low", "low")).toBe("p4");
  });

  it("falls back to P3 until both inputs are set", () => {
    expect(derivePriority("", "high")).toBe("p3");
    expect(derivePriority("high", undefined)).toBe("p3");
    expect(derivePriority(null, null)).toBe("p3");
  });
});
