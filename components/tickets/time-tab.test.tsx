import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatMinutes, LogTimeForm, TimeTab, today, validateDraft } from "@/components/tickets/time-tab";
import { toDeskCatalogs } from "@/lib/tickets/use-catalogs";
import { ACCOUNT_ID, CONTRACT_ID, aCompTimeContract, aPremiumContract } from "@/redux/ticketsApi.test";
import type { LogTimeBody } from "@/redux/timeApi";
import { anAfterHoursEntry, anEntry, aRatedEntry } from "@/redux/timeApi.test";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({ usePathname: () => "/tickets/CS0001001" }));

const catalogs = toDeskCatalogs({
  resolution_codes: [],
  activity_types: [
    { key: "analysis", label: "Analysis", billable_class: "billable" },
    { key: "rework", label: "Rework of own defect", billable_class: "absorbed" },
  ],
  billable_classes: [
    { key: "billable", label: "Billable", consumes_contract: true },
    { key: "absorbed", label: "Absorbed", consumes_contract: false },
  ],
});

const viewer = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u", accountIds: [ACCOUNT_ID], permissions } });

describe("LogTimeForm", () => {
  it("defaults the billable class from the activity, validates the minutes and submits the body", async () => {
    const onSubmit = vi.fn<(body: LogTimeBody) => Promise<void>>(async () => undefined);
    render(<LogTimeForm catalogs={catalogs} onSubmit={onSubmit} />);
    expect(screen.getByLabelText("Billable class")).toHaveValue("billable");
    fireEvent.change(screen.getByLabelText("Activity"), { target: { value: "rework" } });
    expect(screen.getByLabelText("Billable class")).toHaveValue("absorbed");

    fireEvent.click(screen.getByRole("button", { name: "Log time" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Minutes must be a whole number above zero.");
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "45m" }));
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Reran the import" } });
    fireEvent.click(screen.getByRole("button", { name: "Log time" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        performed_on: today(),
        minutes: 45,
        activity_type: "rework",
        billable_class: "absorbed",
        description: "Reran the import",
        after_hours: undefined,
        performed_start: undefined,
      }),
    );
    expect(screen.getByLabelText("Minutes")).toHaveValue("");
  });

  it("sends the person's own after-hours statement when no start time is given", async () => {
    const onSubmit = vi.fn<(body: LogTimeBody) => Promise<void>>(async () => undefined);
    render(<LogTimeForm catalogs={catalogs} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: "30m" }));
    fireEvent.click(screen.getByLabelText("I did this work after hours"));
    fireEvent.click(screen.getByRole("button", { name: "Log time" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ minutes: 30, after_hours: true, performed_start: undefined });
  });

  it("sends the start time as performed_start and hides the statement while a start time is given", async () => {
    const onSubmit = vi.fn<(body: LogTimeBody) => Promise<void>>(async () => undefined);
    render(<LogTimeForm catalogs={catalogs} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByLabelText("I did this work after hours"));
    fireEvent.change(screen.getByLabelText("Start time"), { target: { value: "19:30" } });
    expect(screen.queryByLabelText("I did this work after hours")).not.toBeInTheDocument();
    expect(
      screen.getByText("The account calendar decides the after-hours class from the start time."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "1h" }));
    fireEvent.click(screen.getByRole("button", { name: "Log time" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    // The earlier tick does not travel once the calendar can judge from the start time.
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ minutes: 60, performed_start: "19:30", after_hours: undefined });
    // Clearing the start time brings the statement back, unticked.
    fireEvent.change(screen.getByLabelText("Start time"), { target: { value: "" } });
    expect(screen.getByLabelText("I did this work after hours")).not.toBeChecked();
  });

  it("refuses a future date, a day-plus entry and a malformed start time", () => {
    const base = {
      performedOn: today(),
      performedStart: "",
      minutes: "30",
      activityType: "analysis",
      billableClass: "billable",
      description: "",
      afterHours: false,
    };
    expect(validateDraft(base)).toBeNull();
    expect(validateDraft({ ...base, performedStart: "07:15" })).toBeNull();
    expect(validateDraft({ ...base, performedStart: "25:00" })).toBe("Start time must be HH:MM, 24-hour.");
    expect(validateDraft({ ...base, performedOn: "2999-01-01" })).toBe("The date cannot be in the future.");
    expect(validateDraft({ ...base, minutes: "1500" })).toBe("One entry cannot exceed a day.");
    expect(formatMinutes(135)).toBe("2h 15m");
  });
});

describe("TimeTab", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists the entries with adjustments struck through and the total", async () => {
    stubFetch({
      "GET /v1/admin/me": viewer(["tickets:view"]),
      "GET /v1/tickets/CS0001001/time": () =>
        json({ entries: [anEntry({ adjusted_minutes: 30, description: "Traced" })], total_minutes: 30 }),
    });
    renderDesk(<TimeTab ticketKey="CS0001001" catalogs={catalogs} />);
    await waitFor(() => expect(screen.getByTestId("time-total")).toHaveTextContent("30m"));
    expect(screen.getByText("45m")).toHaveClass("line-through");
    expect(screen.queryByRole("form", { name: "Log time" })).not.toBeInTheDocument();
    expect(document.querySelector("[data-after-hours]")).toBeNull();
  });

  it("badges after-hours entries with the contract's handling and posts performed_start when time is logged", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": viewer(["tickets:view", "time:log"]),
      "GET /v1/tickets/CS0001001/time": () =>
        json({
          entries: [anAfterHoursEntry({ description: "Late fix" }), anEntry({ id: "e-2", description: "Daytime" })],
          total_minutes: 90,
        }),
      [`GET /v1/accounts/${ACCOUNT_ID}/contracts`]: () =>
        json([aCompTimeContract({ id: "other" }), aPremiumContract()]),
      "POST /v1/tickets/CS0001001/time": () => json(anAfterHoursEntry({ id: "e-3" }), 201),
    });
    renderDesk(<TimeTab ticketKey="CS0001001" catalogs={catalogs} accountId={ACCOUNT_ID} contractId={CONTRACT_ID} />);
    const late = (await screen.findByText("Late fix")).closest("tr") as HTMLElement;
    await within(late).findByText("Premium 1.5x per contract");
    expect(within(late).getByText("After hours")).toBeInTheDocument();
    expect(within(late).getByText("1.5x")).toBeInTheDocument();
    expect(late.querySelector("[data-start]")).toHaveTextContent("19:30");
    const day = screen.getByText("Daytime").closest("tr") as HTMLElement;
    expect(day.querySelector("[data-after-hours]")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "45m" }));
    fireEvent.change(screen.getByLabelText("Start time"), { target: { value: "19:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Log time" }));
    await waitFor(() =>
      expect(calls.find((call) => call.key.startsWith("POST "))?.body).toEqual({
        performed_on: today(),
        minutes: 45,
        activity_type: "analysis",
        billable_class: "billable",
        performed_start: "19:30",
      }),
    );
    await screen.findByText("45m logged on CS0001001");
  });

  it("shows the amount and the frozen rate where present, the over-budget pill, and words overage_blocked", async () => {
    stubFetch({
      "GET /v1/admin/me": viewer(["tickets:view", "time:log"]),
      "GET /v1/tickets/CS0001001/time": () =>
        json({
          entries: [
            aRatedEntry({ description: "Rated" }),
            aRatedEntry({
              id: "e-over",
              description: "Past the line",
              over_budget: true,
              rate_snapshot: "200.00",
              amount: "300.00",
            }),
            anEntry({ id: "e-plain", description: "Unrated" }),
          ],
          total_minutes: 225,
        }),
      "POST /v1/tickets/CS0001001/time": () =>
        json({ code: "overage_blocked", available_minutes: 600, consumed_minutes: 570, requested_minutes: 60 }, 409),
    });
    renderDesk(<TimeTab ticketKey="CS0001001" catalogs={catalogs} />);
    const rated = (await screen.findByText("Rated")).closest("tr") as HTMLElement;
    expect(rated.querySelector("[data-amount]")).toHaveTextContent("225.00");
    expect(rated.querySelector("[data-rate-snapshot]")).toHaveTextContent("at 150.00/h");
    expect(rated.querySelector("[data-over-budget]")).toBeNull();
    const over = screen.getByText("Past the line").closest("tr") as HTMLElement;
    expect(within(over).getByText("Over budget")).toBeInTheDocument();
    expect(over.querySelector("[data-amount]")).toHaveTextContent("300.00");
    const plain = screen.getByText("Unrated").closest("tr") as HTMLElement;
    expect(plain.querySelector("[data-amount]")).toBeNull();
    expect(plain.querySelector("[data-over-budget]")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "1h" }));
    fireEvent.click(screen.getByRole("button", { name: "Log time" }));
    await screen.findByText(
      "This entry would take the period over its 10 h budget (9.5 h used); the contract blocks overage.",
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
