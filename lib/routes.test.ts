import { describe, expect, it } from "vitest";
import { matchScreen, pinnedScreens, SCREENS, visibleScreens } from "@/lib/routes";

describe("route registry", () => {
  it("fails closed: nothing is visible until permissions have loaded", () => {
    expect(visibleScreens(undefined)).toEqual([]);
    expect(pinnedScreens(undefined)).toEqual([]);
  });

  it("shows only unrestricted screens to a user with no permissions", () => {
    const labels = visibleScreens([]).map((s) => s.label);
    expect(labels).toEqual(["My work"]);
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

describe("roster and calendar routes", () => {
  it("shows Roster to capacity:view and the calendar screens to admin:config", () => {
    const labels = visibleScreens(new Set(["capacity:view"])).map((s) => s.label);
    expect(labels).toContain("Roster");
    expect(labels).toContain("Person record");
    expect(labels).not.toContain("Holiday libraries");
    const admin = visibleScreens(new Set(["admin:config"])).map((s) => s.screen);
    expect(admin).toEqual(expect.arrayContaining(["admin.calendar", "admin.calendar.new", "admin.holiday_calendars"]));
    expect(SCREENS.find((s) => s.screen === "roster")?.section).toBe("Capacity");
  });

  it("matches the roster and calendar paths, including the nested new-calendar route", () => {
    expect(matchScreen("/roster")?.screen).toBe("roster");
    expect(matchScreen("/roster/11111111-1111-4111-8111-111111111111")?.screen).toBe("roster.person");
    expect(matchScreen("/admin/calendars/abc")?.screen).toBe("admin.calendar");
    expect(matchScreen("/admin/accounts/acc-1/calendars/new")?.screen).toBe("admin.calendar.new");
    expect(matchScreen("/admin/accounts/acc-1")?.screen).toBe("admin.account");
    expect(matchScreen("/admin/holiday-calendars")?.screen).toBe("admin.holiday_calendars");
  });
});
