import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AccountCalendarsTab,
} from "@/components/admin/calendars/account-calendars-tab";
import {
  HolidayLibraryList,
  NewHolidayLibraryForm,
  parseHolidayLines,
} from "@/components/admin/calendars/holiday-libraries";
import { ACCOUNT_ID, aCalendar, aHolidayCalendar } from "@/redux/calendarsApi.test";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/holiday-calendars" }));

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: [ACCOUNT_ID], permissions } });

describe("holiday libraries", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("parses pasted date and label lines and skips the rest", () => {
    expect(parseHolidayLines("2027-01-01, New Year's Day\n2027-04-02\tGood Friday\nnonsense\n\n2027-12-25; Christmas Day")).toEqual([
      { date: "2027-01-01", label: "New Year's Day" },
      { date: "2027-04-02", label: "Good Friday" },
      { date: "2027-12-25", label: "Christmas Day" },
    ]);
  });

  it("lists the libraries with their dates on demand", () => {
    render(<HolidayLibraryList rows={[aHolidayCalendar()]} />);
    expect(screen.getByText("England and Wales 2026")).toBeInTheDocument();
    expect(screen.getByText("2 dates")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show dates" }));
    expect(within(screen.getByLabelText("Dates of England and Wales 2026")).getByText("Christmas Day")).toBeInTheDocument();
  });

  it("creates a library with the upper-cased country and only the valid dates", async () => {
    const calls = stubFetch({ "POST /v1/holiday-calendars": () => json(aHolidayCalendar(), 201) });
    const onCreated = vi.fn();
    renderDesk(<NewHolidayLibraryForm onCreated={onCreated} />);
    fireEvent.change(screen.getByLabelText("Country"), { target: { value: "gb" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "England and Wales 2027" } });
    fireEvent.change(screen.getByLabelText("Holiday 1 date"), { target: { value: "2027-01-01" } });
    fireEvent.change(screen.getByLabelText("Holiday 1 label"), { target: { value: "New Year's Day" } });
    fireEvent.click(screen.getByRole("button", { name: "Add date" }));
    fireEvent.change(screen.getByLabelText("Holiday 2 label"), { target: { value: "No date, dropped" } });
    fireEvent.change(screen.getByLabelText("Or paste lines"), { target: { value: "2027-12-25, Christmas Day" } });
    fireEvent.blur(screen.getByLabelText("Or paste lines"));
    expect(screen.getByText("2 valid dates")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create library" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(calls[0].body).toEqual({
      country: "GB",
      name: "England and Wales 2027",
      holidays: [
        { date: "2027-01-01", label: "New Year's Day" },
        { date: "2027-12-25", label: "Christmas Day" },
      ],
    });
  });
});

describe("AccountCalendarsTab", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists the account calendars with the default marked and offers New calendar only with admin:config", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["admin:accounts", "tickets:view"]),
      [`GET /v1/accounts/${ACCOUNT_ID}/calendars`]: () =>
        json([aCalendar(), aCalendar({ id: "cal-2", name: "Brazil coverage", time_zone: "America/Sao_Paulo", is_default: false, status: "retired" })]),
    });
    const { unmount } = renderDesk(<AccountCalendarsTab accountId={ACCOUNT_ID} />);
    expect(await screen.findByRole("link", { name: "UK standard hours" })).toHaveAttribute("href", `/admin/calendars/${aCalendar().id}`);
    expect(screen.getByText("Default")).toHaveAttribute("data-state", "ready");
    expect(screen.getByText("Retired")).toHaveAttribute("data-state", "blocked");
    expect(screen.getAllByText("50 h per week")).toHaveLength(2);
    await waitFor(() => expect(screen.queryByRole("link", { name: "New calendar" })).not.toBeInTheDocument());
    unmount();
    stubFetch({
      "GET /v1/admin/me": me(["admin:accounts", "admin:config"]),
      [`GET /v1/accounts/${ACCOUNT_ID}/calendars`]: () => json([]),
    });
    renderDesk(<AccountCalendarsTab accountId={ACCOUNT_ID} />);
    expect(await screen.findByRole("link", { name: "New calendar" })).toHaveAttribute(
      "href",
      `/admin/accounts/${ACCOUNT_ID}/calendars/new`,
    );
    expect(await screen.findByText(/No calendar yet/)).toBeInTheDocument();
  });
});
