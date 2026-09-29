import { describe, expect, it } from "vitest";
import { apiError, describeError } from "@/lib/admin/api-error";

describe("apiError", () => {
  it("reads the typed body off an RTK Query error", () => {
    const parsed = apiError({ status: 403, data: { code: "forbidden", permission: "admin:config" } });
    expect(parsed).toMatchObject({ status: 403, code: "forbidden", permission: "admin:config" });
  });

  it("calls a transport failure a network error rather than guessing at a code", () => {
    expect(apiError({ status: "FETCH_ERROR" }).code).toBe("network");
    expect(apiError("not an error at all")).toMatchObject({ status: "unknown", code: "error" });
  });

  it("reads max_days and max_bytes off the wire", () => {
    const parsed = apiError({ status: 400, data: { code: "range_too_wide", max_days: 366, max_bytes: 65536 } });
    expect(parsed.maxDays).toBe(366);
    expect(parsed.maxBytes).toBe(65536);
  });
});

describe("the refusals the API gained with the security fixes", () => {
  it("names the widest span a route reads", () => {
    expect(describeError({ status: 400, code: "range_too_wide", maxDays: 366 })).toBe(
      "That is a wider span than this reads: 366 days at a time.",
    );
    // Without the figure the sentence still stands rather than printing
    // "undefined days".
    expect(describeError({ status: 400, code: "range_too_wide" })).toBe("That is a wider span than this reads.");
  });

  it("says a recorded change needs a reason", () => {
    expect(describeError({ status: 400, code: "reason_required" })).toBe(
      "This change is recorded, so it needs a reason.",
    );
  });

  it("names the ceiling in kilobytes rather than in bytes", () => {
    expect(describeError({ status: 400, code: "form_data_too_large", maxBytes: 65536 })).toContain("64 kB");
  });

  it("tells a reader an expired upload link is worth retrying", () => {
    expect(describeError({ status: 403, code: "upload_expired" })).toBe(
      "The upload link had expired. Choose the file again.",
    );
  });

  it("still names an unknown code rather than swallowing it", () => {
    expect(describeError({ status: 418, code: "teapot" })).toBe("The request failed (teapot).");
  });
});
