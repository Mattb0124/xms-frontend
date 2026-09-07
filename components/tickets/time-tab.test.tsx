import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatMinutes, LogTimeForm, TimeTab, today, validateDraft } from "@/components/tickets/time-tab";
import { toDeskCatalogs } from "@/lib/tickets/use-catalogs";
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

describe("LogTimeForm", () => {
  it("defaults the billable class from the activity, validates the minutes and submits the body", async () => {
    const onSubmit = vi.fn(async () => undefined);
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
      }),
    );
    expect(screen.getByLabelText("Minutes")).toHaveValue("");
  });

  it("refuses a future date and a day-plus entry", () => {
    const base = {
      performedOn: today(),
      minutes: "30",
      activityType: "analysis",
      billableClass: "billable",
      description: "",
      afterHours: false,
    };
    expect(validateDraft(base)).toBeNull();
    expect(validateDraft({ ...base, performedOn: "2999-01-01" })).toBe("The date cannot be in the future.");
    expect(validateDraft({ ...base, minutes: "1500" })).toBe("One entry cannot exceed a day.");
    expect(formatMinutes(135)).toBe("2h 15m");
  });
});

describe("TimeTab", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists the entries with adjustments struck through and the total", async () => {
    stubFetch({
      "GET /v1/admin/me": () =>
        json({ principal: { kind: "internal", userId: "u", accountIds: [], permissions: ["tickets:view"] } }),
      "GET /v1/tickets/CS0001001/time": () =>
        json({
          entries: [
            {
              id: "e-1",
              person_name: "Cara Lee",
              performed_on: "2026-09-07",
              minutes: 45,
              adjusted_minutes: 30,
              activity_type: "analysis",
              billable_class: "billable",
              description: "Traced",
              after_hours: false,
              created_at: "x",
            },
          ],
          total_minutes: 30,
        }),
    });
    renderDesk(<TimeTab ticketKey="CS0001001" catalogs={catalogs} />);
    await waitFor(() => expect(screen.getByTestId("time-total")).toHaveTextContent("30m"));
    expect(screen.getByText("45m")).toHaveClass("line-through");
    expect(screen.queryByRole("form", { name: "Log time" })).not.toBeInTheDocument();
  });
});
