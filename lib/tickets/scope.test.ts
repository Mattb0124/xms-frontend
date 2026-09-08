import { describe, expect, it } from "vitest";
import {
  actorLabel,
  allowanceLabel,
  decisionBlockedReason,
  decisionBody,
  describeScopeError,
  flagBody,
  scopeError,
  scopeLabel,
  scopeTone,
  validateDecision,
  validateFlag,
  withdrawBody,
} from "@/lib/tickets/scope";
import { aFlaggedScope, anApprovedScope, aScope, FLAGGER_ID } from "@/test-kit/tickets";

describe("the out-of-scope vocabulary", () => {
  it("words the four states and tones them by what they wait on", () => {
    expect(["none", "flagged", "approved", "declined"].map(scopeLabel)).toEqual([
      "In scope",
      "Flagged out of scope",
      "Approved out of scope",
      "Declined as out of scope",
    ]);
    expect(["none", "flagged", "approved", "declined"].map(scopeTone)).toEqual([
      "ready",
      "needs-input",
      "complete",
      "overdue",
    ]);
    // A state a newer API adds is shown as it came, never as a blank.
    expect(scopeLabel("withdrawn")).toBe("withdrawn");
  });

  it("reads an allowance in the hours a contract period is read in", () => {
    expect(allowanceLabel(480)).toBe("8 h of extra budget (480 minutes)");
    expect(allowanceLabel(90)).toBe("1.5 h of extra budget (90 minutes)");
    expect(allowanceLabel(null)).toBe("No extra budget");
    expect(allowanceLabel(0)).toBe("No extra budget");
  });

  it("names a person as the server named them, never as an id", () => {
    expect(actorLabel("Cara Lee", FLAGGER_ID)).toBe("Cara Lee");
    expect(actorLabel(null, FLAGGER_ID)).toBe("Someone on the team");
    expect(actorLabel(null, null)).toBeNull();
  });
});

describe("who may decide a flag", () => {
  it("refuses the flagger in the words the API refuses them with", () => {
    expect(decisionBlockedReason(aFlaggedScope(), FLAGGER_ID)).toMatch(/You raised this flag/);
    expect(decisionBlockedReason(aFlaggedScope(), "u-dana")).toBeNull();
  });

  it("refuses a decision where there is no flag pending", () => {
    expect(decisionBlockedReason(aScope(), "u-dana")).toBe("There is no flag waiting for a decision.");
    expect(decisionBlockedReason(anApprovedScope(), "u-dana")).toBe("There is no flag waiting for a decision.");
  });

  it("offers the decision while the viewer is not yet known, since the API decides it anyway", () => {
    expect(decisionBlockedReason(aFlaggedScope(), undefined)).toBeNull();
  });
});

describe("the two bodies", () => {
  it("sends the trimmed reason on a flag and nothing but the version on a withdrawal", () => {
    expect(flagBody(3, "  Rules work is a change  ")).toEqual({
      version: 3,
      out_of_scope: true,
      reason: "Rules work is a change",
    });
    expect(withdrawBody(4)).toEqual({ version: 4, out_of_scope: false });
  });

  it("sends an allowance only as a whole number of minutes above zero", () => {
    expect(decisionBody(5, "approve", "", "480")).toEqual({
      version: 5,
      decision: "approve",
      overage_allowance_minutes: 480,
    });
    // "Approved, no extra budget" is the absent field, never a zero.
    expect(decisionBody(5, "approve", "", "")).toEqual({ version: 5, decision: "approve" });
    expect(decisionBody(5, "approve", "", "0")).toEqual({ version: 5, decision: "approve" });
    expect(decisionBody(5, "approve", "", "1.5")).toEqual({ version: 5, decision: "approve" });
    // A decline never carries one, whatever is in the box.
    expect(decisionBody(5, "decline", "Not funded", "480")).toEqual({
      version: 5,
      decision: "decline",
      note: "Not funded",
    });
  });

  it("refuses a wordless flag and a wordless decline before the API does", () => {
    expect(validateFlag("   ")).toMatch(/Say why this work is outside the contract/);
    expect(validateFlag("Beyond the retainer")).toBeNull();
    expect(validateDecision("decline", " ", "")).toMatch(/Say why the work is declined/);
    expect(validateDecision("decline", "Not funded", "")).toBeNull();
    expect(validateDecision("approve", "", "")).toBeNull();
    expect(validateDecision("approve", "", "half an hour")).toMatch(/whole number of minutes/);
    expect(validateDecision("approve", "", "-30")).toMatch(/whole number of minutes/);
    expect(validateDecision("approve", "", "480")).toBeNull();
  });
});

/** Every refusal the two routes answer with (backend test/scope.int-spec.ts). */
describe("the refusals in words", () => {
  const worded = (data: Record<string, unknown>, status = 409) => describeScopeError(scopeError({ status, data }));

  it("words each code the API answers with", () => {
    expect(worded({ code: "ticket_closed" })).toMatch(/closed or cancelled/);
    expect(worded({ code: "already_flagged" })).toMatch(/already flagged out of scope/);
    expect(worded({ code: "reason_required" }, 400)).toBe("A flag says why. Give a reason and try again.");
    expect(worded({ code: "not_flagged" })).toMatch(/no flag waiting for a decision/);
    expect(worded({ code: "flagger_cannot_decide" })).toBe("You raised this flag, so someone else decides it.");
    expect(worded({ code: "stale_version" })).toMatch(/Someone else changed this ticket/);
  });

  it("names the day the contract had no period for", () => {
    const error = scopeError({ status: 409, data: { code: "no_contract_period", on: "2026-09-07" } });
    expect(error.on).toBe("2026-09-07");
    expect(describeScopeError(error)).toMatch(/no period covering 2026-09-07/);
    expect(worded({ code: "no_contract_period" })).toMatch(/no period covering today/);
  });

  it("falls back to the shared wording for a code this build does not know", () => {
    expect(worded({ code: "forbidden" }, 403)).toBeTruthy();
  });
});
