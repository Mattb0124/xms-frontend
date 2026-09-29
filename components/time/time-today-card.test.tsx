import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { decimalHours, localToday, loggedPercent, TimeTodayCard } from "@/components/time/time-today-card";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

const push = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push }) }));

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: [], permissions } });

function unlogged(day: {
  expected_minutes: number;
  logged_minutes: number;
  unlogged_minutes: number;
  holiday?: boolean;
}) {
  return () =>
    json({
      from: "2026-09-07",
      to: "2026-09-07",
      days: [{ date: "2026-09-07", weekday: 1, holiday: false, ...day }],
      unlogged_minutes: day.unlogged_minutes,
    });
}

describe("TimeTodayCard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    push.mockClear();
  });

  it("formats today in the viewer's zone", () => {
    expect(localToday(new Date(2026, 8, 7, 9, 30))).toBe("2026-09-07");
  });

  // Render 08 reads the day as a fraction, "2.5 / 7.5 h", because the two
  // figures are read against one another rather than as two durations.
  it("reads the day in decimal hours and drops a trailing zero", () => {
    expect(decimalHours(150)).toBe("2.5");
    expect(decimalHours(480)).toBe("8");
    expect(decimalHours(0)).toBe("0");
  });

  it("meters the logged share of the day, and clamps a day with no expectation", () => {
    expect(loggedPercent({ expected_minutes: 480, logged_minutes: 120 })).toBe(25);
    expect(loggedPercent({ expected_minutes: 0, logged_minutes: 0 })).toBe(0);
    expect(loggedPercent({ expected_minutes: 0, logged_minutes: 60 })).toBe(100);
    expect(loggedPercent({ expected_minutes: 480, logged_minutes: 600 })).toBe(100);
  });

  it("renders nothing and never asks the API without time:log", async () => {
    const calls = stubFetch({ "GET /v1/admin/me": me(["tickets:view"]) });
    renderDesk(<TimeTodayCard today="2026-09-07" />);
    await waitFor(() => expect(calls.some((call) => call.key === "GET /v1/admin/me")).toBe(true));
    expect(screen.queryByTestId("time-today")).not.toBeInTheDocument();
    expect(calls.some((call) => call.key === "GET /v1/timesheets/me/unlogged")).toBe(false);
  });

  it("shows the day as a fraction, meters it, and offers the nudge", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["tickets:view", "time:log"]),
      "GET /v1/timesheets/me/unlogged": unlogged({ expected_minutes: 450, logged_minutes: 150, unlogged_minutes: 300 }),
    });
    renderDesk(<TimeTodayCard today="2026-09-07" />);
    await screen.findByText("2.5 / 7.5 h");
    expect(calls.find((call) => call.key === "GET /v1/timesheets/me/unlogged")?.search).toBe(
      "?from=2026-09-07&to=2026-09-07",
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "33");
    // The nudge says what the server counted. The render's own copy names a
    // window and a likely ticket; the API answers in minutes per day, so the
    // sentence carries the minutes and nothing is inferred in the browser.
    expect(screen.getByText("5 h is unlogged today, of 7.5 h expected.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Log now" }));
    expect(push).toHaveBeenCalledWith("/time");
  });

  it("puts the nudge away on Not now and keeps the day's figures", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["time:log"]),
      "GET /v1/timesheets/me/unlogged": unlogged({ expected_minutes: 480, logged_minutes: 120, unlogged_minutes: 360 }),
    });
    renderDesk(<TimeTodayCard today="2026-09-07" />);
    await screen.findByTestId("unlogged-nudge");
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByTestId("unlogged-nudge")).not.toBeInTheDocument();
    expect(screen.getByText("2 / 8 h")).toBeInTheDocument();
  });

  it("says so when nothing is expected, and when the day is done", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["time:log"]),
      "GET /v1/timesheets/me/unlogged": unlogged({
        expected_minutes: 0,
        logged_minutes: 0,
        unlogged_minutes: 0,
        holiday: true,
      }),
    });
    const { unmount } = renderDesk(<TimeTodayCard today="2026-09-07" />);
    await screen.findByText("Nothing is expected today.");
    expect(screen.queryByTestId("unlogged-nudge")).not.toBeInTheDocument();
    unmount();
    vi.unstubAllGlobals();
    stubFetch({
      "GET /v1/admin/me": me(["time:log"]),
      "GET /v1/timesheets/me/unlogged": unlogged({ expected_minutes: 480, logged_minutes: 480, unlogged_minutes: 0 }),
    });
    renderDesk(<TimeTodayCard today="2026-09-07" />);
    await screen.findByText("The day is fully logged.");
    expect(screen.getByText("8 / 8 h")).toBeInTheDocument();
  });
});
