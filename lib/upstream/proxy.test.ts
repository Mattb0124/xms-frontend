import { describe, expect, it } from "vitest";
import { apiPath, forwardRequestHeaders, forwardResponseHeaders } from "@/lib/upstream/forward";

describe("apiPath", () => {
  it("joins segments and encodes them", () => {
    expect(apiPath(["tickets", "CS0001001"])).toBe("tickets/CS0001001");
    expect(apiPath(["accounts", "a b"])).toBe("accounts/a%20b");
  });

  it("refuses an empty path and any segment that could climb out of /v1", () => {
    expect(apiPath([])).toBeNull();
    expect(apiPath([".."])).toBeNull();
    expect(apiPath(["tickets", "..", "admin"])).toBeNull();
    expect(apiPath(["."])).toBeNull();
    expect(apiPath(["a/b"])).toBeNull();
  });
});

describe("forwarded headers", () => {
  it("keeps the bearer and drops the browser cookie", () => {
    const headers = new Headers({
      authorization: "Bearer tok-1",
      cookie: "session=secret",
      accept: "application/json",
      host: "xms.example.test",
    });
    const forwarded = forwardRequestHeaders(headers);
    expect(forwarded.get("authorization")).toBe("Bearer tok-1");
    expect(forwarded.get("accept")).toBe("application/json");
    expect(forwarded.get("cookie")).toBeNull();
    expect(forwarded.get("host")).toBeNull();
  });

  it("keeps the download headers and drops an upstream cookie and any CORS grant", () => {
    const headers = new Headers({
      "content-type": "text/csv",
      "content-disposition": 'attachment; filename="events.csv"',
      "x-request-id": "req-1",
      "set-cookie": "session=from-api",
      "access-control-allow-origin": "*",
    });
    const forwarded = forwardResponseHeaders(headers);
    expect(forwarded.get("content-disposition")).toContain("events.csv");
    expect(forwarded.get("x-request-id")).toBe("req-1");
    expect(forwarded.get("set-cookie")).toBeNull();
    expect(forwarded.get("access-control-allow-origin")).toBeNull();
  });
});
