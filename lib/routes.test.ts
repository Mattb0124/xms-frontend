import { describe, expect, it } from "vitest";
import { matchScreen, PINNED_ROWS, pinnedScreens, SCREENS, visibleScreens } from "@/lib/routes";

/** Ana Costa's own set from the seeded stack: a consultant, no portfolio reports. */
const CONSULTANT = new Set([
  "ai:use",
  "kb:author",
  "tickets:create",
  "tickets:resolve",
  "tickets:view",
  "tickets:work",
  "time:log",
]);
const EVERYTHING = new Set(SCREENS.map((screen) => screen.permission).filter((p): p is string => p !== null));

describe("the pinned set is per role, and always six rows", () => {
  it("gives a reader who holds everything the render's own six, in the render's order", () => {
    expect(pinnedScreens(EVERYTHING).map((screen) => screen.label)).toEqual([
      "My work",
      "Cases",
      "Dispatch",
      "Quarantine",
      "My timesheet",
      "Operations",
    ]);
  });

  it("gives a consultant six rows too, with Solutions where Operations cannot open", () => {
    // Operations needs reports:view-portfolio. The pin used to be a flag, so
    // the row vanished and the sidebar came back five rows tall.
    const labels = pinnedScreens(CONSULTANT).map((screen) => screen.label);
    expect(labels).toHaveLength(PINNED_ROWS);
    expect(labels).toEqual(["My work", "Cases", "Dispatch", "Quarantine", "My timesheet", "Solutions"]);
    expect(labels).not.toContain("Operations");
  });

  it("never pins a screen the reader may not open, and never more than six", () => {
    for (const permissions of [new Set<string>(), CONSULTANT, EVERYTHING]) {
      const pins = pinnedScreens(permissions);
      const visible = new Set(visibleScreens(permissions).map((screen) => screen.path));
      expect(pins.length).toBeLessThanOrEqual(PINNED_ROWS);
      for (const pin of pins) expect(visible.has(pin.path)).toBe(true);
    }
  });

  it("ranks the pins uniquely, so the sidebar's order does not depend on the sort being stable", () => {
    const ranks = SCREENS.map((screen) => screen.pinned).filter((rank): rank is number => typeof rank === "number");
    expect(new Set(ranks).size).toBe(ranks.length);
    expect(ranks.length).toBeGreaterThan(PINNED_ROWS);
  });
});

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

  it("shows Admin to admin:accounts and Cases to tickets:view", () => {
    const labels = visibleScreens(new Set(["admin:accounts", "tickets:view"])).map((s) => s.label);
    expect(labels).toContain("Admin");
    expect(labels).toContain("Cases");
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
    expect(matchScreen("/tickets")?.screen).toBe("cases");
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

describe("migration routes", () => {
  it("shows the migration console only to admin:migration", () => {
    const screens = visibleScreens(new Set(["admin:migration"])).map((s) => s.screen);
    expect(screens).toEqual(
      expect.arrayContaining(["admin.migration", "admin.migration.new", "admin.migration.batch"]),
    );
    expect(screens).not.toContain("admin");
    const admin = visibleScreens(new Set(["admin:accounts", "admin:config", "admin:connectors"])).map((s) => s.screen);
    expect(admin).not.toContain("admin.migration");
    expect(SCREENS.find((s) => s.screen === "admin.migration")?.section).toBe("Admin");
  });

  it("matches the console paths, with the new-batch route ahead of the record", () => {
    expect(matchScreen("/admin/migration")?.screen).toBe("admin.migration");
    expect(matchScreen("/admin/migration/new")?.screen).toBe("admin.migration.new");
    expect(matchScreen("/admin/migration/88888888-8888-4888-8888-888888888888")?.screen).toBe("admin.migration.batch");
  });
});

describe("capacity routes", () => {
  it("shows Capacity and Planned vs actual to capacity:view only, in the Capacity section", () => {
    const screens = visibleScreens(new Set(["capacity:view"])).map((s) => s.screen);
    expect(screens).toEqual(expect.arrayContaining(["capacity", "capacity.variance"]));
    expect(visibleScreens(new Set(["tickets:view", "tickets:work"])).map((s) => s.screen)).not.toContain("capacity");
    expect(SCREENS.find((s) => s.screen === "capacity")?.section).toBe("Capacity");
    expect(SCREENS.find((s) => s.screen === "capacity.variance")?.section).toBe("Capacity");
  });

  it("matches the capacity paths", () => {
    expect(matchScreen("/capacity")?.screen).toBe("capacity");
    expect(matchScreen("/capacity/variance")?.screen).toBe("capacity.variance");
  });
});
