import { describe, expect, it } from "vitest";
import { filterFromSearch, filterToSearch } from "@/lib/roster/filters";
import { expiryState, formatHours, formatPercent, levelLabel, roleLabel } from "@/lib/roster/vocab";

describe("roster vocabulary", () => {
  it("labels known roles from the list and humanises unknown codes", () => {
    expect(roleLabel("senior_consultant")).toBe("Senior Consultant");
    expect(roleLabel("practice_lead")).toBe("Practice Lead");
    expect(roleLabel("data_scientist")).toBe("Data Scientist");
    expect(roleLabel(null)).toBe("");
    expect(levelLabel(3)).toBe("Proficient");
    expect(levelLabel(9)).toBe("Level 9");
  });

  it("formats the API's numeric strings without recomputing them", () => {
    expect(formatPercent("100.00")).toBe("100%");
    expect(formatPercent("62.50")).toBe("62.5%");
    expect(formatPercent(null)).toBe("");
    expect(formatHours("8.50")).toBe("8.5 h");
    expect(formatHours("40.00")).toBe("40 h");
  });

  it("tones the expiry chip: red past, amber within 90 days, green beyond, grey without", () => {
    const today = new Date("2026-09-07T12:00:00Z");
    expect(expiryState("2026-09-06", today)).toMatchObject({ tone: "overdue", label: "Expired", days: -1 });
    expect(expiryState("2026-09-07", today)).toMatchObject({ tone: "needs-input", label: "Expires today" });
    expect(expiryState("2026-09-08", today)).toMatchObject({ tone: "needs-input", label: "Expires in 1 day" });
    expect(expiryState("2026-12-06", today)).toMatchObject({ tone: "needs-input", label: "Expires in 90 days" });
    expect(expiryState("2026-12-07", today)).toMatchObject({ tone: "complete", label: "Valid", days: 91 });
    expect(expiryState(null, today)).toMatchObject({ tone: "blocked", label: "No expiry", days: null });
  });
});

describe("roster list URL grammar", () => {
  it("round-trips the filters and leaves the default active state out of the URL", () => {
    expect(filterFromSearch(new URLSearchParams(""))).toEqual({
      active: "true",
      role: undefined,
      group: undefined,
      skill: undefined,
      q: undefined,
    });
    const filter = filterFromSearch(new URLSearchParams("active=all&role=consultant&skill=onestream&q=ana"));
    expect(filter).toMatchObject({ active: "all", role: "consultant", skill: "onestream", q: "ana" });
    expect(filterToSearch(filter)).toBe("?active=all&role=consultant&skill=onestream&q=ana");
    expect(filterToSearch({ active: "true" })).toBe("");
    expect(filterFromSearch(new URLSearchParams("active=nonsense")).active).toBe("true");
  });
});
