import "@testing-library/jest-dom/vitest";
import { afterAll } from "vitest";
import { holdAnimationFrames } from "@/test-kit/animation-frames";

if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
  const frames = holdAnimationFrames(window);
  const replacements = { requestAnimationFrame: frames.requestFrame, cancelAnimationFrame: frames.cancelFrame };
  Object.assign(window, replacements);
  Object.assign(globalThis, replacements);
  afterAll(frames.release);
}
