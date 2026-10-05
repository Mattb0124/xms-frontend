import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SignInGrid } from "@/components/shell/sign-in-grid";
import { SIGN_IN_WORDS } from "@/lib/auth/sign-in-grid";

function stillMotion(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    media: query,
    matches,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe("SignInGrid", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("shows a 0 or a 1 in the cells around the pointer", () => {
    stillMotion(false);
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { container } = render(<SignInGrid />);
    const cell = container.querySelector("rect");
    expect(cell).not.toBeNull();
    if (!cell) return;
    fireEvent.mouseEnter(cell);
    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
  });

  it("throws a word out from a click", () => {
    stillMotion(false);
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const { container } = render(<SignInGrid />);
    const cell = container.querySelector("rect");
    expect(cell).not.toBeNull();
    if (!cell) return;
    fireEvent.click(cell);
    const word = SIGN_IN_WORDS[Math.floor(0.99 * SIGN_IN_WORDS.length)] ?? "AI";
    expect(screen.getAllByText(word).length).toBeGreaterThan(0);
  });

  it("stays still when motion is reduced", () => {
    stillMotion(true);
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { container } = render(<SignInGrid />);
    const cell = container.querySelector("rect");
    expect(cell).not.toBeNull();
    if (!cell) return;
    fireEvent.mouseEnter(cell);
    fireEvent.click(cell);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });
});
