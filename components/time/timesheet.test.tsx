import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { dayStatus, dayTone, Timesheet, weekOf } from "@/components/time/timesheet";
import type { DeskCatalogs } from "@/lib/tickets/use-catalogs";
import { anAfterHoursEntry, anEntry, aRatedEntry } from "@/redux/timeApi.test";
import type { TimesheetWeek, TimesheetWeekDay } from "@/redux/timeApi";

/** A constructed week: Monday to Sunday of 2026-09-07 with the calendar's 8-hour days. */
export function aWeekDay(overrides: Partial<TimesheetWeekDay> = {}): TimesheetWeekDay {
  return {
    date: "2026-09-07",
    weekday: 1,
    expected_minutes: 480,
    logged_minutes: 0,
    unlogged_minutes: 480,
    holiday: false,
    entries: [],
    ...overrides,
  };
}

export function aWeek(overrides: Partial<TimesheetWeek> = {}): TimesheetWeek {
  const days: TimesheetWeekDay[] = [
    aWeekDay({
      date: "2026-09-07",
      weekday: 1,
      logged_minutes: 480,
      unlogged_minutes: 0,
      entries: [anEntry({ ticket_number: "1000001", minutes: 480, adjusted_minutes: 480 })],
    }),
    aWeekDay({
      date: "2026-09-08",
      weekday: 2,
      logged_minutes: 300,
      unlogged_minutes: 180,
      entries: [
        anEntry({
          id: "e-2",
          performed_on: "2026-09-08",
          minutes: 300,
          adjusted_minutes: 300,
          bucket_label: "Internal",
        }),
      ],
    }),
    aWeekDay({ date: "2026-09-09", weekday: 3, expected_minutes: 0, unlogged_minutes: 0, holiday: true }),
    aWeekDay({ date: "2026-09-10", weekday: 4 }),
    aWeekDay({ date: "2026-09-11", weekday: 5 }),
    aWeekDay({ date: "2026-09-12", weekday: 6, expected_minutes: 0, unlogged_minutes: 0 }),
    aWeekDay({ date: "2026-09-13", weekday: 7, expected_minutes: 0, unlogged_minutes: 0 }),
  ];
  return {
    from: "2026-09-07",
    to: "2026-09-13",
    days,
    total_minutes: 780,
    unlogged_minutes: 180 + 480 + 480,
    ...overrides,
  };
}

const catalogs = {
  activityTypes: [{ key: "analysis", label: "Analysis" }],
  billableClasses: [],
  resolutionCodes: [],
} as unknown as DeskCatalogs;

describe("day highlight rules", () => {
  it("is amber on a working day with unlogged minutes, muted when nothing is expected, plain when fully logged", () => {
    expect(dayTone({ expected_minutes: 480, unlogged_minutes: 120 })).toBe("unlogged");
    expect(dayTone({ expected_minutes: 480, unlogged_minutes: 0 })).toBe("complete");
    expect(dayTone({ expected_minutes: 0, unlogged_minutes: 0 })).toBe("off");
  });

  it("describes the day from the server's numbers", () => {
    expect(dayStatus(aWeekDay({ logged_minutes: 360, unlogged_minutes: 120 }))).toBe("6h of 8h, 2h unlogged");
    expect(dayStatus(aWeekDay({ logged_minutes: 480, unlogged_minutes: 0 }))).toBe("8h of 8h, all logged");
    expect(dayStatus(aWeekDay({ expected_minutes: 0, unlogged_minutes: 0, holiday: true }))).toBe("Holiday");
    expect(dayStatus(aWeekDay({ expected_minutes: 0, unlogged_minutes: 0 }))).toBe("Not a working day");
  });

  it("still computes the Monday to Sunday week for the picker", () => {
    expect(weekOf(new Date("2026-09-10T12:00:00Z"))).toMatchObject({ from: "2026-09-07", to: "2026-09-13" });
  });
});

describe("Timesheet", () => {
  it("renders the week with per-day tones, expected against logged, and the totals in the header", () => {
    render(<Timesheet week={aWeek()} catalogs={catalogs} />);
    expect(screen.getByTestId("week-total")).toHaveTextContent("13h");
    expect(screen.getByTestId("week-unlogged")).toHaveTextContent("19h");
    const monday = document.querySelector('[data-day="2026-09-07"]')!;
    expect(monday).toHaveAttribute("data-tone", "complete");
    expect(within(monday as HTMLElement).getByText("8h of 8h, all logged")).toBeInTheDocument();
    const tuesday = document.querySelector('[data-day="2026-09-08"]')!;
    expect(tuesday).toHaveAttribute("data-tone", "unlogged");
    expect(within(tuesday as HTMLElement).getByText("5h of 8h, 3h unlogged")).toBeInTheDocument();
    const wednesday = document.querySelector('[data-day="2026-09-09"]')!;
    expect(wednesday).toHaveAttribute("data-tone", "off");
    expect(within(wednesday as HTMLElement).getByText("Holiday")).toBeInTheDocument();
    expect(document.querySelector('[data-day="2026-09-12"]')).toHaveAttribute("data-tone", "off");
    expect(screen.getByRole("link", { name: "CS1000001" })).toBeInTheDocument();
    expect(screen.getByText("Internal")).toBeInTheDocument();
    expect(screen.getAllByText("Analysis")).toHaveLength(2);
    expect(document.querySelectorAll("[data-entry]")).toHaveLength(2);
  });

  it("badges non-standard entries with their class and start time, and the multiplier only when it is not 1", () => {
    const week = aWeek({
      days: [
        aWeekDay({
          date: "2026-09-12",
          weekday: 6,
          expected_minutes: 0,
          unlogged_minutes: 0,
          logged_minutes: 120,
          entries: [
            anAfterHoursEntry({ id: "e-w", performed_on: "2026-09-12", after_hours_class: "weekend", minutes: 90 }),
            anAfterHoursEntry({
              id: "e-h",
              performed_on: "2026-09-12",
              after_hours_class: "holiday",
              rate_multiplier: "1.000",
              performed_start: null,
              minutes: 30,
            }),
          ],
        }),
      ],
    });
    render(<Timesheet week={week} catalogs={catalogs} />);
    const weekend = document.querySelector('[data-entry="e-w"]') as HTMLElement;
    expect(within(weekend).getByText("Weekend")).toBeInTheDocument();
    expect(within(weekend).getByText("1.5x")).toBeInTheDocument();
    expect(weekend.querySelector("[data-start]")).toHaveTextContent("19:30");
    const holiday = document.querySelector('[data-entry="e-h"]') as HTMLElement;
    expect(within(holiday).getByText("Holiday")).toBeInTheDocument();
    expect(holiday.querySelector("[data-rate]")).toBeNull();
    expect(holiday.querySelector("[data-start]")).toHaveTextContent("");
    // Without the contract the timesheet cannot explain the handling rule.
    expect(document.querySelector("[data-handling]")).toBeNull();
  });

  it("shows the amount and the rate where the entry carries them and the over-budget pill", () => {
    const week = aWeek({
      days: [
        aWeekDay({
          logged_minutes: 180,
          unlogged_minutes: 300,
          entries: [
            aRatedEntry({ id: "e-rated", ticket_number: "1000001" }),
            aRatedEntry({
              id: "e-over",
              ticket_number: "1000002",
              minutes: 60,
              adjusted_minutes: 60,
              amount: "200.00",
              rate_snapshot: "200.00",
              over_budget: true,
            }),
            anEntry({ id: "e-plain", minutes: 30, adjusted_minutes: 30, bucket_label: "Internal" }),
          ],
        }),
      ],
    });
    render(<Timesheet week={week} catalogs={catalogs} />);
    const rated = document.querySelector('[data-entry="e-rated"]') as HTMLElement;
    expect(rated.querySelector("[data-amount]")).toHaveTextContent("225.00");
    expect(rated.querySelector("[data-rate-snapshot]")).toHaveTextContent("at 150.00/h");
    expect(rated.querySelector("[data-over-budget]")).toBeNull();
    const over = document.querySelector('[data-entry="e-over"]') as HTMLElement;
    expect(within(over).getByText("Over budget")).toBeInTheDocument();
    expect(over.querySelector("[data-amount]")).toHaveTextContent("200.00");
    const plain = document.querySelector('[data-entry="e-plain"]') as HTMLElement;
    expect(plain.querySelector("[data-amount]")).toBeNull();
    expect(plain.querySelector("[data-over-budget]")).toBeNull();
  });
});

/**
 * Non-ticket time on the timesheet (TB-12): an entry hanging off a bucket
 * rather than a ticket is named by the bucket, and one the API answered
 * without a label still says what it is.
 */
describe("non-ticket entries", () => {
  it("names the bucket where the entry has one, and the ticket key where it does not", () => {
    const week = aWeek({
      days: [
        aWeekDay({
          date: "2026-09-07",
          weekday: 1,
          logged_minutes: 135,
          entries: [
            anEntry({ id: "e-ticket", ticket_number: "1000199", bucket_label: null }),
            anEntry({ id: "e-bucket", ticket_id: null, ticket_number: null, bucket_label: "Governance" }),
            anEntry({ id: "e-unnamed", ticket_id: null, ticket_number: null, bucket_label: null }),
          ],
        }),
      ],
    });
    render(<Timesheet week={week} catalogs={catalogs} />);
    expect(document.querySelector('[data-entry="e-ticket"] [data-key]')).toHaveTextContent("CS1000199");
    expect(document.querySelector('[data-entry="e-bucket"] [data-bucket]')).toHaveTextContent("Governance");
    expect(document.querySelector('[data-entry="e-unnamed"] [data-bucket]')).toHaveTextContent("Non-ticket time");
  });
});
