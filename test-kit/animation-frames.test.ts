import { describe, expect, it, vi } from "vitest";
import { holdAnimationFrames } from "@/test-kit/animation-frames";

/** A window whose frames run only when the test says so. */
function frameQueue() {
  const queued = new Map<number, FrameRequestCallback>();
  let last = 0;
  return {
    queued,
    requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
      last += 1;
      queued.set(last, callback);
      return last;
    }),
    cancelAnimationFrame: vi.fn((id: number) => {
      queued.delete(id);
    }),
  };
}

describe("holdAnimationFrames", () => {
  it("hands frames to the window while the file runs", () => {
    const win = frameQueue();
    const frames = holdAnimationFrames(win);
    const callback = vi.fn();
    const id = frames.requestFrame(callback);
    win.queued.get(id)?.(16);
    expect(callback).toHaveBeenCalledWith(16);
  });

  it("runs the frames still waiting on release and leaves none queued on the window", () => {
    const win = frameQueue();
    const frames = holdAnimationFrames(win);
    const waiting = vi.fn();
    const cancelled = vi.fn();
    frames.requestFrame(waiting);
    frames.cancelFrame(frames.requestFrame(cancelled));
    frames.release();
    expect(waiting).toHaveBeenCalledTimes(1);
    expect(cancelled).not.toHaveBeenCalled();
    expect(win.queued.size).toBe(0);
  });

  it("runs a frame asked for after release on a microtask, and keeps its error from the run", async () => {
    const win = frameQueue();
    const frames = holdAnimationFrames(win);
    frames.release();
    const callback = vi.fn(() => {
      throw new ReferenceError("cancelAnimationFrame is not defined");
    });
    frames.requestFrame(callback);
    expect(win.requestAnimationFrame).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
