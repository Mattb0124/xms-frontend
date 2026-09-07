import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PreviewPanel, PreviewResultView } from "@/components/admin/calendars/preview-panel";
import { CALENDAR_ID } from "@/redux/calendarsApi.test";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({ usePathname: () => `/admin/calendars/${CALENDAR_ID}` }));

const RESULT = {
  start: "2026-09-11T16:00:00.000Z",
  minutes: 240,
  due_at: "2026-09-14T11:00:00.000Z",
  working_minutes_between: 240,
  wall_minutes_between: 4020,
  starts_in_working_time: true,
};

describe("PreviewResultView", () => {
  it("shows the due time in the calendar's zone and the viewer's, with working and wall minutes", () => {
    render(<PreviewResultView result={RESULT} timeZone="Europe/London" viewerZone="Australia/Sydney" />);
    expect(screen.getByText("Due (Europe/London)")).toBeInTheDocument();
    expect(screen.getByText("Mon, 14 Sept 2026, 12:00")).toBeInTheDocument();
    expect(screen.getByText("Due (your zone, Australia/Sydney)")).toBeInTheDocument();
    expect(screen.getByText("Mon, 14 Sept 2026, 21:00")).toBeInTheDocument();
    expect(screen.getByText("240 (4 h)")).toBeInTheDocument();
    expect(screen.getByText("4020 (67 h)")).toBeInTheDocument();
    expect(screen.getByText("Inside working hours")).toBeInTheDocument();
  });

  it("drops the viewer line when the zones match and explains an out-of-hours start", () => {
    render(
      <PreviewResultView
        result={{ ...RESULT, starts_in_working_time: false }}
        timeZone="Europe/London"
        viewerZone="Europe/London"
      />,
    );
    expect(screen.queryByText(/your zone/)).not.toBeInTheDocument();
    expect(screen.getByText(/Outside working hours/)).toBeInTheDocument();
  });
});

describe("PreviewPanel", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts the start as an ISO instant with the minutes and renders the answer", async () => {
    const calls = stubFetch({ [`POST /v1/calendars/${CALENDAR_ID}/preview`]: () => json(RESULT) });
    renderDesk(<PreviewPanel calendarId={CALENDAR_ID} timeZone="Europe/London" viewerZone="UTC" />);
    fireEvent.change(screen.getByLabelText("Start (your zone)"), { target: { value: "2026-09-11T16:00" } });
    fireEvent.change(screen.getByLabelText("Business minutes"), { target: { value: "240" } });
    fireEvent.click(screen.getByRole("button", { name: "Compute due time" }));
    await screen.findByTestId("preview-result");
    expect(calls[0].body).toEqual({ start: new Date("2026-09-11T16:00").toISOString(), minutes: 240 });
    expect(screen.getByText("Mon, 14 Sept 2026, 12:00")).toBeInTheDocument();
    expect(screen.getByText("Mon, 14 Sept 2026, 11:00")).toBeInTheDocument();
  });

  it("shows the typed bad_start copy", async () => {
    stubFetch({ [`POST /v1/calendars/${CALENDAR_ID}/preview`]: () => json({ code: "bad_start" }, 400) });
    renderDesk(<PreviewPanel calendarId={CALENDAR_ID} timeZone="UTC" viewerZone="UTC" />);
    fireEvent.click(screen.getByRole("button", { name: "Compute due time" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("valid date and time"));
  });
});
