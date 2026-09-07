import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { localToday, TimeTodayCard } from "@/components/time/time-today-card";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: [], permissions } });

function unlogged(day: { expected_minutes: number; logged_minutes: number; unlogged_minutes: number; holiday?: boolean }) {
  return () =>
    json({
      from: "2026-09-07",
      to: "2026-09-07",
      days: [{ date: "2026-09-07", weekday: 1, holiday: false, ...day }],
      unlogged_minutes: day.unlogged_minutes,
    });
}

describe("TimeTodayCard", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("formats today in the viewer's zone", () => {
    expect(localToday(new Date(2026, 8, 7, 9, 30))).toBe("2026-09-07");
  });

  it("renders nothing and never asks the API without time:log", async () => {
    const calls = stubFetch({ "GET /v1/admin/me": me(["tickets:view"]) });
    renderDesk(<TimeTodayCard today="2026-09-07" />);
    await waitFor(() => expect(calls.some((call) => call.key === "GET /v1/admin/me")).toBe(true));
    expect(screen.queryByTestId("time-today")).not.toBeInTheDocument();
    expect(calls.some((call) => call.key === "GET /v1/timesheets/me/unlogged")).toBe(false);
  });

  it("shows logged and unlogged minutes for today with the amber tone and the way to the timesheet", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["tickets:view", "time:log"]),
      "GET /v1/timesheets/me/unlogged": unlogged({ expected_minutes: 480, logged_minutes: 135, unlogged_minutes: 345 }),
    });
    renderDesk(<TimeTodayCard today="2026-09-07" />);
    await screen.findByText("2h 15m");
    expect(calls.find((call) => call.key === "GET /v1/timesheets/me/unlogged")?.search).toBe(
      "?from=2026-09-07&to=2026-09-07",
    );
    expect(screen.getByTestId("time-today")).toHaveAttribute("data-tone", "unlogged");
    expect(screen.getByTestId("time-today")).toHaveAttribute("href", "/time");
    expect(screen.getByText("2h 15m of 8h, 5h 45m unlogged")).toBeInTheDocument();
    expect(screen.getByText("5h 45m still to log before the day closes.")).toBeInTheDocument();
  });

  it("mutes a day with nothing expected and turns green once fully logged", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["time:log"]),
      "GET /v1/timesheets/me/unlogged": unlogged({ expected_minutes: 0, logged_minutes: 0, unlogged_minutes: 0, holiday: true }),
    });
    const { unmount } = renderDesk(<TimeTodayCard today="2026-09-07" />);
    await screen.findByText("Holiday");
    expect(screen.getByTestId("time-today")).toHaveAttribute("data-tone", "off");
    expect(screen.getByText("Nothing expected today.")).toBeInTheDocument();
    unmount();
    vi.unstubAllGlobals();
    stubFetch({
      "GET /v1/admin/me": me(["time:log"]),
      "GET /v1/timesheets/me/unlogged": unlogged({ expected_minutes: 480, logged_minutes: 480, unlogged_minutes: 0 }),
    });
    renderDesk(<TimeTodayCard today="2026-09-07" />);
    await screen.findByText("8h of 8h, all logged");
    expect(screen.getByTestId("time-today")).toHaveAttribute("data-tone", "complete");
  });
});
