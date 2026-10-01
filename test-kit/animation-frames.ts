export interface HeldFrames {
  requestFrame: (callback: FrameRequestCallback) => number;
  cancelFrame: (id: number) => void;
  /** Runs the frames still waiting; every frame asked for after this runs on a microtask. */
  release: () => void;
}

/**
 * Keeps a test file's animation frames inside the life of its window. Redux
 * Toolkit batches store notifications into a frame, with a 100 ms timer
 * behind it that calls the global cancelAnimationFrame. A frame still waiting
 * when Vitest closes the window, or asked for after it, fires once the jsdom
 * globals are gone, and its error is reported as unhandled: that failed
 * `pnpm check` on runs where every test had passed.
 */
export function holdAnimationFrames(
  target: Pick<Window, "requestAnimationFrame" | "cancelAnimationFrame">,
): HeldFrames {
  const request = target.requestAnimationFrame.bind(target);
  const cancel = target.cancelAnimationFrame.bind(target);
  const waiting = new Map<number, FrameRequestCallback>();
  let released = false;

  const requestFrame = (callback: FrameRequestCallback): number => {
    if (released) {
      queueMicrotask(() => {
        try {
          callback(performance.now());
        } catch {
          // The window this frame was asked for is closed, and nothing is left to report to.
        }
      });
      return 0;
    }
    const id = request((time) => {
      waiting.delete(id);
      callback(time);
    });
    waiting.set(id, callback);
    return id;
  };

  const cancelFrame = (id: number) => {
    waiting.delete(id);
    cancel(id);
  };

  const release = () => {
    released = true;
    for (const [id, callback] of [...waiting]) {
      cancelFrame(id);
      callback(performance.now());
    }
  };

  return { requestFrame, cancelFrame, release };
}
