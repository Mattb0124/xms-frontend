import "vitest";

/** vitest-axe matchers registered with expect.extend in the portal tests. */
declare module "vitest" {
  interface Assertion<T = unknown> {
    toHaveNoViolations(): T;
  }
}
