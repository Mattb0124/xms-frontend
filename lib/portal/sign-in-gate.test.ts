import { describe, expect, it } from "vitest";
import { returnToPortalSignIn } from "@/lib/portal/sign-in-gate";

describe("returnToPortalSignIn", () => {
  it("sends an anonymous 401 back to sign-in", () => {
    expect(returnToPortalSignIn(401, false)).toBe(true);
  });

  it("keeps a Clerk session that the API refused on the page", () => {
    expect(returnToPortalSignIn(401, true)).toBe(false);
  });

  it("does not redirect any other status", () => {
    expect(returnToPortalSignIn(403, false)).toBe(false);
    expect(returnToPortalSignIn(undefined, false)).toBe(false);
  });
});
