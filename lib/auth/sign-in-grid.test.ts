import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GRID_BURST,
  GRID_COLUMNS,
  GRID_RIPPLE,
  GRID_ROWS,
  SIGN_IN_TONES,
  SIGN_IN_WORDS,
  binaryRipple,
  clickChips,
  squareDistance,
} from "@/lib/auth/sign-in-grid";

describe("sign-in grid", () => {
  afterEach(() => vi.restoreAllMocks());

  it("paints 0 and 1 only inside the hover ring", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const values = binaryRipple(0, GRID_COLUMNS, GRID_ROWS, GRID_RIPPLE);
    expect(values.get(0)).toBe("0");
    expect(values.get(GRID_RIPPLE)).toBe("0");
    expect(values.has(GRID_RIPPLE + 1)).toBe(false);
    for (const index of values.keys()) {
      expect(squareDistance(index, 0, GRID_COLUMNS)).toBeLessThanOrEqual(GRID_RIPPLE);
      expect(values.get(index)).toMatch(/^[01]$/);
    }
  });

  it("scatters a word only inside the click burst", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const chips = clickChips(0, GRID_COLUMNS, GRID_ROWS, GRID_BURST);
    const word = SIGN_IN_WORDS[Math.floor(0.99 * SIGN_IN_WORDS.length)];
    expect(chips.get(0)).toEqual({ word, tone: Math.floor(0.99 * SIGN_IN_TONES) });
    expect(chips.has(GRID_BURST + 1)).toBe(false);
    for (const index of chips.keys()) {
      expect(squareDistance(index, 0, GRID_COLUMNS)).toBeLessThanOrEqual(GRID_BURST);
    }
  });
});
