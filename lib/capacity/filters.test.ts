import { describe, expect, it } from "vitest";
import {
  capacityFilterFromSearch,
  capacityFilterToSearch,
  demandFilterFromSearch,
  demandFilterToSearch,
  skillsFilterFromSearch,
  skillsFilterToSearch,
  varianceFilterFromSearch,
  varianceFilterToSearch,
} from "@/lib/capacity/filters";

describe("capacity filters", () => {
  it("reads the month and the filters from the URL and falls back to the current month", () => {
    expect(capacityFilterFromSearch(new URLSearchParams(""), "2026-09")).toEqual({
      month: "2026-09",
      role: undefined,
      group: undefined,
      account: undefined,
    });
    expect(
      capacityFilterFromSearch(new URLSearchParams("month=2026-11&role=consultant&group=g-1&account=a-1"), "2026-09"),
    ).toEqual({
      month: "2026-11",
      role: "consultant",
      group: "g-1",
      account: "a-1",
    });
    expect(capacityFilterFromSearch(new URLSearchParams("month=2026-13"), "2026-09").month).toBe("2026-09");
    expect(capacityFilterFromSearch(new URLSearchParams("month=nope"), "2026-09").month).toBe("2026-09");
  });

  it("writes only the filters set and the month only when it is not the current one", () => {
    expect(capacityFilterToSearch({ month: "2026-09" }, "2026-09")).toBe("");
    expect(capacityFilterToSearch({ month: "2026-10" }, "2026-09")).toBe("?month=2026-10");
    expect(capacityFilterToSearch({ month: "2026-09", role: "consultant", account: "a-1" }, "2026-09")).toBe(
      "?role=consultant&account=a-1",
    );
    expect(capacityFilterToSearch({ month: "2026-10", group: "g-1" }, "2026-09")).toBe("?month=2026-10&group=g-1");
  });

  it("does the same for the variance screen with account and person", () => {
    expect(varianceFilterFromSearch(new URLSearchParams("account=a-1&person=p-1"), "2026-09")).toEqual({
      month: "2026-09",
      account: "a-1",
      person: "p-1",
    });
    expect(varianceFilterToSearch({ month: "2026-08", person: "p-1" }, "2026-09")).toBe("?month=2026-08&person=p-1");
    expect(varianceFilterToSearch({ month: "2026-09" }, "2026-09")).toBe("");
  });

  it("reads the demand range with the three-month default and writes only what leaves it", () => {
    expect(demandFilterFromSearch(new URLSearchParams(""), "2026-09")).toEqual({
      from: "2026-09",
      to: "2026-12",
      account: undefined,
    });
    expect(demandFilterFromSearch(new URLSearchParams("from=2026-11&to=2027-02&account=a-1"), "2026-09")).toEqual({
      from: "2026-11",
      to: "2027-02",
      account: "a-1",
    });
    // A `to` before `from` or a malformed one falls back to the horizon from `from`.
    expect(demandFilterFromSearch(new URLSearchParams("from=2026-11&to=2026-10"), "2026-09").to).toBe("2027-02");
    expect(demandFilterFromSearch(new URLSearchParams("to=nope"), "2026-09").to).toBe("2026-12");
    expect(demandFilterToSearch({ from: "2026-09", to: "2026-12" }, "2026-09")).toBe("");
    expect(demandFilterToSearch({ from: "2026-09", to: "2026-10" }, "2026-09")).toBe("?to=2026-10");
    expect(demandFilterToSearch({ from: "2026-11", to: "2027-02", account: "a-1" }, "2026-09")).toBe(
      "?from=2026-11&account=a-1",
    );
    expect(demandFilterToSearch({ from: "2026-11", to: "2026-11" }, "2026-09")).toBe("?from=2026-11&to=2026-11");
  });

  it("reads the skills lens with its own filter only, and writes the account lens but not the people one", () => {
    expect(skillsFilterFromSearch(new URLSearchParams(""))).toEqual({
      lens: "people",
      role: undefined,
      account: undefined,
    });
    expect(skillsFilterFromSearch(new URLSearchParams("role=consultant&account=a-1"))).toEqual({
      lens: "people",
      role: "consultant",
      account: undefined,
    });
    expect(skillsFilterFromSearch(new URLSearchParams("lens=account&account=a-1&role=consultant"))).toEqual({
      lens: "account",
      role: undefined,
      account: "a-1",
    });
    expect(skillsFilterFromSearch(new URLSearchParams("lens=teams")).lens).toBe("people");
    expect(skillsFilterToSearch({ lens: "people" })).toBe("");
    expect(skillsFilterToSearch({ lens: "people", role: "architect" })).toBe("?role=architect");
    expect(skillsFilterToSearch({ lens: "account" })).toBe("?lens=account");
    expect(skillsFilterToSearch({ lens: "account", account: "a-1", role: "architect" })).toBe(
      "?lens=account&account=a-1",
    );
  });
});
