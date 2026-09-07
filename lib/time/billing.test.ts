import { describe, expect, it } from "vitest";
import {
  allowedActions,
  billingError,
  billingPeriodBody,
  canExport,
  checksumPrefix,
  describeBillingError,
  periodLabel,
} from "@/lib/time/billing";
import { aBillingPeriod, aLockedPeriod } from "@/redux/timeApi.test";

describe("billing vocabulary", () => {
  it("offers the moves the status allows and the viewer may make, in the table's order", () => {
    const finance = (key: string) => key === "time:lock-period";
    const owner = (key: string) => key === "contracts:manage";
    const both = () => true;
    expect(allowedActions("open", both)).toEqual(["submit", "lock"]);
    expect(allowedActions("open", owner)).toEqual(["submit"]);
    expect(allowedActions("open", finance)).toEqual(["lock"]);
    expect(allowedActions("submitted", both)).toEqual(["reopen", "approve", "lock"]);
    expect(allowedActions("approved", both)).toEqual(["lock"]);
    expect(allowedActions("approved", owner)).toEqual([]);
    expect(allowedActions("locked", both)).toEqual([]);
    expect(allowedActions("exported", both)).toEqual([]);
    expect(canExport("locked")).toBe(true);
    expect(canExport("exported")).toBe(true);
    expect(canExport("approved")).toBe(false);
  });

  it("names a period by its month, builds the month's body and shortens the checksum", () => {
    expect(periodLabel(aBillingPeriod())).toBe("September 2026");
    expect(periodLabel(aBillingPeriod({ starts_on: "2026-09-01", ends_on: "2026-09-15" }))).toBe("2026-09-01 to 2026-09-15");
    expect(billingPeriodBody("2026-02")).toEqual({ starts_on: "2026-02-01", ends_on: "2026-02-28" });
    expect(billingPeriodBody("2026-12")).toEqual({ starts_on: "2026-12-01", ends_on: "2026-12-31" });
    expect(checksumPrefix(aLockedPeriod().checksum)).toBe("3f2a9c8e1b7d");
    expect(checksumPrefix(null)).toBe("");
  });

  it("words the refusals: invalid_transition with the allowed moves, stale_version, period_not_locked", () => {
    const invalid = billingError({
      status: 409,
      data: { code: "invalid_transition", status: "open", allowed: ["submit", "lock"] },
    });
    expect(invalid.periodStatus).toBe("open");
    expect(describeBillingError(invalid)).toBe(
      "This period is open; from here it can only be submit or lock. The list has been reloaded.",
    );
    expect(
      describeBillingError(
        billingError({ status: 409, data: { code: "invalid_transition", status: "locked", allowed: ["mark_exported"] } }),
      ),
    ).toBe("This period is locked and cannot be moved from here. The list has been reloaded.");
    expect(
      describeBillingError(
        billingError({ status: 409, data: { code: "invalid_transition", status: "submitted", allowed: ["reopen", "approve", "lock"] } }),
      ),
    ).toBe("This period is submitted; from here it can only be reopen, approve or lock. The list has been reloaded.");
    expect(describeBillingError(billingError({ status: 409, data: { code: "stale_version" } }))).toBe(
      "Someone else changed this period. It has been reloaded.",
    );
    expect(describeBillingError(billingError({ status: 409, data: { code: "period_not_locked", status: "approved" } }))).toBe(
      "The finance file is produced once the period is locked.",
    );
    expect(
      describeBillingError(billingError({ status: 403, data: { code: "forbidden", permission: "time:lock-period" } })),
    ).toBe("You need the time:lock-period permission.");
  });
});
