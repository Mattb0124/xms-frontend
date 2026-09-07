import { describe, expect, it } from "vitest";
import { describeTransitionError, transitionError } from "@/lib/tickets/transition-errors";

const rtk = (status: number, data: Record<string, unknown>) => ({ status, data });

describe("transition error toasts", () => {
  it("lists the missing close-discipline items in words", () => {
    const error = transitionError(
      rtk(409, { code: "missing_requirements", items: ["resolution_code", "solution_link", "time_logged"] }),
    );
    const copy = describeTransitionError(error);
    expect(copy.title).toBe("Not moved");
    expect(copy.detail).toBe(
      "Still needed: a resolution code, a solution link or a new-article candidate, logged time or a time exemption reason.",
    );
    expect(copy.reload).toBe(false);
  });

  it("says the state changed elsewhere and asks for a reload on invalid_transition", () => {
    const copy = describeTransitionError(
      transitionError(rtk(409, { code: "invalid_transition", from: "awaiting_client", to: "resolved" })),
    );
    expect(copy.title).toBe("Status changed elsewhere");
    expect(copy.detail).toContain("Awaiting client");
    expect(copy.reload).toBe(true);
  });

  it("reloads on stale_version and keeps the version the server reported", () => {
    const error = transitionError(rtk(409, { code: "stale_version", version: 4 }));
    expect(error.version).toBe(4);
    expect(describeTransitionError(error)).toMatchObject({ title: "Reloaded", reload: true });
  });

  it("falls back to the generic error copy for anything else", () => {
    expect(
      describeTransitionError(transitionError(rtk(403, { code: "forbidden", permission: "tickets:work" }))),
    ).toMatchObject({
      title: "Not saved",
      detail: "You need the tickets:work permission.",
      reload: false,
    });
  });
});
