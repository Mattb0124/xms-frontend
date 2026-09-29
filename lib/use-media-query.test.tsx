import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NARROW_QUERY, useMediaQuery } from "@/lib/use-media-query";

/**
 * The desk did not adapt at all at 390px: the 238px sidebar stayed put and
 * left about 150px of content (frontend review finding 8). The shell reads the
 * viewport through this hook to choose its layout.
 */
function stubMatchMedia(matches: boolean) {
  const listeners = new Set<() => void>();
  let current = matches;
  const matchMedia = vi.fn((query: string) => ({
    media: query,
    get matches() {
      return current;
    },
    addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
  }));
  vi.stubGlobal("matchMedia", matchMedia);
  return {
    matchMedia,
    set(next: boolean) {
      current = next;
      for (const listener of listeners) listener();
    },
    listenerCount: () => listeners.size,
  };
}

function Probe() {
  return <span data-testid="narrow">{String(useMediaQuery(NARROW_QUERY))}</span>;
}

describe("useMediaQuery", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reports whether the query matches, and follows a change", () => {
    const media = stubMatchMedia(true);
    render(<Probe />);
    expect(screen.getByTestId("narrow")).toHaveTextContent("true");
    expect(media.matchMedia).toHaveBeenCalledWith(NARROW_QUERY);
    act(() => media.set(false));
    expect(screen.getByTestId("narrow")).toHaveTextContent("false");
  });

  it("stops listening when the component goes away", () => {
    const media = stubMatchMedia(false);
    const view = render(<Probe />);
    expect(media.listenerCount()).toBe(1);
    view.unmount();
    expect(media.listenerCount()).toBe(0);
  });

  it("answers false where matchMedia is unavailable, so a render never throws", () => {
    vi.stubGlobal("matchMedia", undefined);
    render(<Probe />);
    expect(screen.getByTestId("narrow")).toHaveTextContent("false");
  });

  it("names the breakpoint the desk collapses at", () => {
    expect(NARROW_QUERY).toBe("(max-width: 767px)");
  });
});
