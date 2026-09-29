import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SlaTable, slaRows } from "@/components/tickets/sla-table";
import type { ClockView } from "@/lib/tickets/sla";

/** The record was fetched at 10:00; the resolution clock has 8h of its 16h left. */
const FETCHED = new Date("2026-09-15T10:00:00Z");
const clock = (over: Partial<ClockView> = {}): ClockView => ({
  kind: "resolution",
  dueAt: "2026-09-15T18:00:00Z",
  remainingMinutes: 480,
  paused: false,
  breached: false,
  met: false,
  targetMinutes: 960,
  pausedTotalMinutes: 0,
  ...over,
});

const minutesLater = (minutes: number) => new Date(FETCHED.getTime() + minutes * 60_000);

/**
 * The SLAs related list reads each clock the way ServiceNow's SLA list reads
 * its rows: elapsed, share of target, time left, pause total, breached. The
 * server owns every due time and latch; the browser only counts down.
 */
describe("slaRows", () => {
  it("reads a running clock as in progress, with the elapsed share of its target", () => {
    const [row] = slaRows({ resolution: clock() }, FETCHED, FETCHED);
    expect(row.definition).toBe("Resolution");
    expect(row.stage).toBe("In progress");
    expect(row.elapsedMinutes).toBe(480);
    expect(row.percent).toBe(50);
    expect(row.leftMinutes).toBe(480);
    expect(row.breached).toBe(false);
  });

  it("counts down from the fetch, so the elapsed share follows the clock", () => {
    const [row] = slaRows({ resolution: clock() }, FETCHED, minutesLater(60));
    expect(row.elapsedMinutes).toBe(540);
    expect(row.leftMinutes).toBe(420);
    expect(row.percent).toBeCloseTo(56.25);
  });

  it("reads a clock past its due time as breached, over a hundred percent, with nothing left", () => {
    const overdue = clock({ dueAt: "2026-09-15T08:00:00Z", remainingMinutes: -120 });
    const [row] = slaRows({ resolution: overdue }, FETCHED, FETCHED);
    expect(row.stage).toBe("Breached");
    expect(row.breached).toBe(true);
    expect(row.elapsedMinutes).toBe(1080);
    expect(row.percent).toBeCloseTo(112.5);
    expect(row.leftMinutes).toBe(0);
  });

  it("reads a met clock as met, frozen where it stopped, and never as breached", () => {
    const [row] = slaRows({ resolution: clock({ met: true, remainingMinutes: 300 }) }, FETCHED, minutesLater(600), {
      resolution: "2026-09-15T14:59:00Z",
    });
    expect(row.stage).toBe("Met");
    expect(row.met).toBe(true);
    expect(row.breached).toBe(false);
    expect(row.elapsedMinutes).toBe(660);
    expect(row.metAt).toBe("2026-09-15T14:59:00Z");
  });

  it("holds a paused clock still", () => {
    const [row] = slaRows({ resolution: clock({ paused: true, pausedTotalMinutes: 90 }) }, FETCHED, minutesLater(60));
    expect(row.stage).toBe("Paused");
    expect(row.elapsedMinutes).toBe(480);
    expect(row.pausedMinutes).toBe(90);
  });

  it("lists the response clock before the resolution clock", () => {
    const rows = slaRows(
      { resolution: clock(), response: clock({ kind: "response", targetMinutes: 240 }) },
      FETCHED,
      FETCHED,
    );
    expect(rows.map((row) => row.definition)).toEqual(["Response", "Resolution"]);
  });
});

describe("SlaTable", () => {
  it("draws one row per clock with the columns ServiceNow's list has", () => {
    render(
      <SlaTable
        sla={{
          response: clock({
            kind: "response",
            dueAt: "2026-09-15T12:00:00Z",
            remainingMinutes: 120,
            targetMinutes: 240,
          }),
          resolution: clock(),
        }}
        fetchedAt={FETCHED}
      />,
    );
    const table = screen.getByRole("table", { name: "Service levels" });
    for (const header of [
      "SLA definition",
      "Stage",
      "Elapsed",
      "Elapsed percentage",
      "Time left",
      "Paused",
      "Breached",
      "Due",
    ]) {
      expect(within(table).getByRole("columnheader", { name: header })).toBeInTheDocument();
    }
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Response");
    expect(rows[1]).toHaveTextContent("Resolution");
  });

  it("says so when the ticket carries no clock", () => {
    render(<SlaTable sla={{}} />);
    expect(screen.getByText("No SLA on this ticket.")).toBeInTheDocument();
  });
});
