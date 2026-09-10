import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { countedMinutes, hours, perPerson, TeamTime, windowDates } from "@/components/time/team-time";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";
import type { TimeEntry } from "@/redux/timeApi";

type TeamEntry = TimeEntry & { person_role?: string | null };

function entry(overrides: Partial<TeamEntry> = {}): TeamEntry {
  return {
    id: "e1",
    person_name: "Ana Costa",
    performed_on: "2026-09-08",
    performed_start: null,
    minutes: 120,
    activity_type: "analysis",
    billable_class: "billable",
    description: "Looked at the consolidation run",
    after_hours: false,
    after_hours_class: "standard",
    rate_multiplier: "1.000",
    rate_snapshot: "185.00",
    ticket_number: "1000008",
    bucket_label: null,
    ...overrides,
  } as TeamEntry;
}

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: ["a1"], permissions } });

describe("windowDates", () => {
  it("counts back from today inclusive, so seven days is seven days", () => {
    expect(windowDates(7, new Date("2026-09-10T12:00:00Z"))).toEqual({ from: "2026-09-04", to: "2026-09-10" });
    expect(windowDates(1, new Date("2026-09-10T12:00:00Z"))).toEqual({ from: "2026-09-10", to: "2026-09-10" });
  });

  it("crosses a month end without arithmetic of its own", () => {
    expect(windowDates(7, new Date("2026-03-03T12:00:00Z"))).toEqual({ from: "2026-02-25", to: "2026-03-03" });
  });
});

describe("countedMinutes", () => {
  it("counts what an entry is worth after an adjustment, not what was logged", () => {
    expect(countedMinutes(entry())).toBe(120);
    expect(countedMinutes(entry({ adjusted_minutes: 90 }))).toBe(90);
    // A write-off to nothing counts as nothing, not as the logged minutes.
    expect(countedMinutes(entry({ adjusted_minutes: 0 }))).toBe(0);
  });
});

describe("perPerson", () => {
  it("totals each person, most hours first", () => {
    const rows = perPerson([
      entry({ id: "a", person_name: "Ana Costa", minutes: 60 }),
      entry({ id: "b", person_name: "Ben Okafor", minutes: 180 }),
      entry({ id: "c", person_name: "Ana Costa", minutes: 30 }),
    ]);
    expect(rows.map((row) => [row.name, row.minutes, row.entries])).toEqual([
      ["Ben Okafor", 180, 1],
      ["Ana Costa", 90, 2],
    ]);
  });

  it("has nothing to total on an empty window", () => {
    expect(perPerson([])).toEqual([]);
  });
});

describe("hours", () => {
  it("reads minutes back as hours, to one decimal", () => {
    expect(hours(90)).toBe("1.5 h");
    expect(hours(0)).toBe("0 h");
  });
});

describe("TeamTime", () => {
  it("is closed, and asks nothing, without time:adjust", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["time:log"]),
      "GET /v1/time/team": () => json([entry()]),
    });
    renderDesk(<TeamTime />);
    expect(await screen.findByText("Not permitted")).toBeInTheDocument();
    expect(calls.some((call) => call.key.includes("/v1/time/team"))).toBe(false);
  });

  it("shows the group's entries with a total per person", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["time:adjust"]),
      "GET /v1/time/team": () =>
        json([
          entry(),
          entry({ id: "e2", person_name: "Ben Okafor", minutes: 60, ticket_number: null, bucket_label: "Internal" }),
        ]),
    });
    renderDesk(<TeamTime />);

    const table = within(await screen.findByRole("table", { name: "Team time" }));
    expect(table.getByText("Ana Costa")).toBeInTheDocument();
    expect(table.getByRole("link", { name: "CS1000008" })).toHaveAttribute("href", "/cases/CS1000008");
    expect(table.getByText("Internal")).toBeInTheDocument();
    // Two hours and one, in the roll-up above the table.
    expect(screen.getByText(/3 h across 2 people/)).toBeInTheDocument();
  });

  it("says plainly that a person outside a group sees only themselves", async () => {
    stubFetch({ "GET /v1/admin/me": me(["time:adjust"]), "GET /v1/time/team": () => json([]) });
    renderDesk(<TeamTime />);
    expect(await screen.findByText(/A person with no roster group sees only their own/)).toBeInTheDocument();
  });
});
