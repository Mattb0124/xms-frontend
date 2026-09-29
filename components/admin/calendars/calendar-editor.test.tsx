import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CalendarEditor, calendarPatch } from "@/components/admin/calendars/calendar-editor";
import { ACCOUNT_ID, aCalendar, aHolidayCalendar, CALENDAR_ID, HOLIDAY_LIBRARY_ID } from "@/test-kit/calendars";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({ usePathname: () => `/admin/calendars/${CALENDAR_ID}` }));

describe("CalendarEditor", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("creates a calendar from the grid: minutes from midnight, 0 = Sunday, the library and make default", async () => {
    const calls = stubFetch({
      "GET /v1/holiday-calendars": () => json([aHolidayCalendar()]),
      [`POST /v1/accounts/${ACCOUNT_ID}/calendars`]: () => json(aCalendar(), 201),
    });
    const onCreated = vi.fn();
    renderDesk(<CalendarEditor accountId={ACCOUNT_ID} onCreated={onCreated} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "UK standard hours" } });
    fireEvent.change(screen.getByLabelText("Time zone"), { target: { value: "Europe/London" } });
    const library = await screen.findByLabelText("Holiday library");
    await waitFor(() => expect(within(library).getAllByRole("option")).toHaveLength(2));
    fireEvent.change(library, { target: { value: HOLIDAY_LIBRARY_ID } });
    // The chosen library's dates are listed read only.
    expect(within(screen.getByLabelText("Holiday dates")).getByText("Christmas Day")).toBeInTheDocument();
    // Trim the standard week to Monday and add a Sunday interval.
    for (const day of ["Tuesday", "Wednesday", "Thursday", "Friday"]) {
      fireEvent.click(screen.getByLabelText(`Remove ${day} interval 1`));
    }
    fireEvent.change(screen.getByLabelText("Monday interval 1 start"), { target: { value: "08:00" } });
    fireEvent.change(screen.getByLabelText("Monday interval 1 end"), { target: { value: "18:00" } });
    const sunday = screen.getByText("Sunday").closest("tr")!;
    fireEvent.click(within(sunday).getByRole("button", { name: /Add hours/ }));
    fireEvent.change(screen.getByLabelText("Sunday interval 1 start"), { target: { value: "10:00" } });
    fireEvent.change(screen.getByLabelText("Sunday interval 1 end"), { target: { value: "12:00" } });
    fireEvent.click(screen.getByLabelText(/Account default/));
    fireEvent.click(screen.getByRole("button", { name: "Create calendar" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    const post = calls.find((call) => call.key.startsWith("POST"));
    expect(post?.body).toEqual({
      name: "UK standard hours",
      time_zone: "Europe/London",
      holiday_calendar_id: HOLIDAY_LIBRARY_ID,
      hours: [
        { weekday: 1, start_minute: 480, end_minute: 1080 },
        { weekday: 0, start_minute: 600, end_minute: 720 },
      ],
      make_default: true,
    });
  });

  it("blocks a bad grid locally with the server's wording and shows the server's invalid_hours problems", async () => {
    const calls = stubFetch({
      "GET /v1/holiday-calendars": () => json([]),
      [`POST /v1/accounts/${ACCOUNT_ID}/calendars`]: () =>
        json({ code: "invalid_hours", problems: ["weekday 1: intervals overlap"] }, 400),
    });
    renderDesk(<CalendarEditor accountId={ACCOUNT_ID} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Broken" } });
    fireEvent.change(screen.getByLabelText("Monday interval 1 end"), { target: { value: "08:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Create calendar" }));
    expect(await screen.findByTestId("hour-problems")).toHaveTextContent("Monday interval 1: end must be after start");
    expect(calls.some((call) => call.key.startsWith("POST"))).toBe(false);
    fireEvent.change(screen.getByLabelText("Monday interval 1 end"), { target: { value: "17:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Create calendar" }));
    await waitFor(() => expect(calls.some((call) => call.key.startsWith("POST"))).toBe(true));
    expect(await screen.findByTestId("hour-problems")).toHaveTextContent("weekday 1: intervals overlap");
    expect(screen.getByText(/The working hours are not valid: weekday 1: intervals overlap/)).toBeInTheDocument();
  });

  it("patches only what changed with the version, and retires after a confirm", async () => {
    const calls = stubFetch({
      "GET /v1/holiday-calendars": () => json([aHolidayCalendar()]),
      [`PATCH /v1/calendars/${CALENDAR_ID}`]: () => json(aCalendar({ version: 2, name: "UK core hours" })),
    });
    renderDesk(<CalendarEditor accountId={ACCOUNT_ID} calendar={aCalendar()} refetch={() => undefined} />);
    expect(screen.getByText("Default")).toHaveAttribute("data-state", "ready");
    expect(screen.getByLabelText(/Account default/)).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "UK core hours" } });
    fireEvent.change(screen.getByLabelText("Monday interval 1 end"), { target: { value: "17:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save calendar" }));
    await waitFor(() => expect(calls.some((call) => call.key.startsWith("PATCH"))).toBe(true));
    const patch = calls.find((call) => call.key.startsWith("PATCH"))!;
    expect(patch.body).toEqual({
      version: 1,
      name: "UK core hours",
      hours: [
        { weekday: 1, start_minute: 480, end_minute: 1020 },
        { weekday: 2, start_minute: 480, end_minute: 1080 },
        { weekday: 3, start_minute: 480, end_minute: 1080 },
        { weekday: 4, start_minute: 480, end_minute: 1080 },
        { weekday: 5, start_minute: 480, end_minute: 1080 },
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: "Retire" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm retire" }));
    await waitFor(() => expect(calls.filter((call) => call.key.startsWith("PATCH"))).toHaveLength(2));
    expect(calls[calls.length - 1].body).toEqual({ version: 1, status: "retired" });
  });

  it("computes the patch diff without touching unchanged fields", () => {
    const calendar = aCalendar();
    expect(
      calendarPatch(
        calendar,
        {
          name: calendar.name,
          time_zone: calendar.time_zone,
          holiday_calendar_id: HOLIDAY_LIBRARY_ID,
          make_default: true,
        },
        calendar.hours,
      ),
    ).toEqual({ version: 1 });
    expect(
      calendarPatch(
        aCalendar({ is_default: false }),
        { name: "Other", time_zone: "Europe/Lisbon", holiday_calendar_id: "", make_default: true },
        calendar.hours,
      ),
    ).toEqual({ version: 1, name: "Other", time_zone: "Europe/Lisbon", holiday_calendar_id: null, make_default: true });
  });
});
