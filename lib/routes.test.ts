import { describe, expect, it } from "vitest";
import { matchScreen, pinnedScreens, SCREENS, visibleScreens } from "@/lib/routes";

describe("route registry", () => {
  it("fails closed: nothing is visible until permissions have loaded", () => {
    expect(visibleScreens(undefined)).toEqual([]);
    expect(pinnedScreens(undefined)).toEqual([]);
  });

  it("shows only unrestricted screens to a user with no permissions", () => {
    const labels = visibleScreens([]).map((s) => s.label);
    expect(labels).toEqual(["My work", "Solutions"]);
    expect(labels).not.toContain("Admin");
  });

  it("shows Admin to admin:accounts and Queue to tickets:view", () => {
    const labels = visibleScreens(new Set(["admin:accounts", "tickets:view"])).map((s) => s.label);
    expect(labels).toContain("Admin");
    expect(labels).toContain("Queue");
    expect(labels).not.toContain("Users");
    expect(labels).not.toContain("Dispatch");
  });

  it("every screen has a unique screen id and path", () => {
    const ids = SCREENS.map((s) => s.screen);
    const paths = SCREENS.map((s) => s.path);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("matches concrete paths, including dynamic segments", () => {
    expect(matchScreen("/tickets")?.screen).toBe("queue");
    expect(matchScreen("/tickets/CS0001204")?.screen).toBe("ticket");
    expect(matchScreen("/tickets/dispatch")?.screen).toBe("dispatch");
    expect(matchScreen("/nowhere")).toBeUndefined();
  });
});
