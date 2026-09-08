import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CalendarTab } from "@/components/roster/calendar-tab";
import { CertificationsTab, ExpiryPill } from "@/components/roster/certifications-tab";
import { changedFields, DetailsTab } from "@/components/roster/details-tab";
import { SkillsTab } from "@/components/roster/skills-tab";
import { aCertification, aPersonDetail, aPersonSkill, aSkill, PERSON_ID, SKILL_ID } from "@/redux/rosterApi.test";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({ usePathname: () => `/roster/${PERSON_ID}` }));

describe("CalendarTab", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows the API's hours per day and sends the working days as ISO numbers with the times", async () => {
    const calls = stubFetch({
      [`PUT /v1/roster/people/${PERSON_ID}/calendar`]: () =>
        json({ working_days: [1, 2, 3, 6], day_start: "08:00", day_end: "16:30", hours_per_day: "8.50" }),
    });
    const person = aPersonDetail();
    renderDesk(<CalendarTab personId={PERSON_ID} calendar={person.calendar} canEdit timeZone="Europe/London" />);
    expect(screen.getByTestId("hours-per-day")).toHaveTextContent("8.5 h");
    expect(screen.getByLabelText("Monday")).toBeChecked();
    expect(screen.getByLabelText("Saturday")).not.toBeChecked();
    fireEvent.click(screen.getByLabelText("Saturday"));
    fireEvent.click(screen.getByLabelText("Thursday"));
    fireEvent.click(screen.getByLabelText("Friday"));
    fireEvent.change(screen.getByLabelText("Day starts"), { target: { value: "08:00" } });
    fireEvent.change(screen.getByLabelText("Day ends"), { target: { value: "16:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Save calendar" }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].body).toEqual({ working_days: [1, 2, 3, 6], day_start: "08:00", day_end: "16:30" });
    await screen.findByText("Calendar saved");
  });

  it("shows the typed day_end_before_start copy and is read only without capacity:manage", async () => {
    stubFetch({
      [`PUT /v1/roster/people/${PERSON_ID}/calendar`]: () => json({ code: "day_end_before_start" }, 400),
    });
    const { unmount } = renderDesk(
      <CalendarTab personId={PERSON_ID} calendar={aPersonDetail().calendar} canEdit timeZone="UTC" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save calendar" }));
    await screen.findByText("The day must end after it starts.");
    unmount();
    renderDesk(<CalendarTab personId={PERSON_ID} calendar={null} canEdit={false} timeZone="UTC" />);
    expect(screen.queryByRole("button", { name: "Save calendar" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Monday")).toBeDisabled();
    expect(screen.getByText(/Calendar missing/)).toBeInTheDocument();
  });
});

describe("SkillsTab", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("saves the whole set: a changed level, a catalog addition and a removal in one PUT", async () => {
    const calls = stubFetch({
      "GET /v1/roster/skills": () =>
        json([
          aSkill(),
          aSkill({ id: "s-coupa", code: "coupa", name: "Coupa" }),
          aSkill({ id: "s-close", code: "close", name: "Close", kind: "process" }),
        ]),
      [`PUT /v1/roster/people/${PERSON_ID}/skills`]: () => json([aPersonSkill({ level: 4 })]),
    });
    renderDesk(
      <SkillsTab
        personId={PERSON_ID}
        canEdit
        skills={[aPersonSkill(), aPersonSkill({ skill_id: "s-coupa", code: "coupa", name: "Coupa", level: 2 })]}
      />,
    );
    const onestream = within(screen.getByLabelText("Level for OneStream"));
    expect(onestream.getByRole("radio", { name: /3/ })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(onestream.getByRole("radio", { name: /4/ }));
    fireEvent.click(screen.getByLabelText("Remove Coupa"));
    const picker = await screen.findByLabelText("Skill");
    await waitFor(() => expect(within(picker).getAllByRole("option").length).toBeGreaterThan(1));
    // Coupa is back in the picker once removed from the draft; Close never left it.
    fireEvent.change(picker, { target: { value: "s-close" } });
    fireEvent.click(screen.getByRole("button", { name: "Add skill" }));
    expect(screen.getByLabelText("Level for Close")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save skills" }));
    await waitFor(() => expect(calls.some((call) => call.key.startsWith("PUT"))).toBe(true));
    const put = calls.find((call) => call.key.startsWith("PUT"));
    expect(put?.body).toEqual({
      skills: [
        { skill_id: SKILL_ID, level: 4 },
        { skill_id: "s-close", level: 2 },
      ],
    });
  });

  it("creates a new catalog skill and adds it to the draft; read only without capacity:manage", async () => {
    const calls = stubFetch({
      "GET /v1/roster/skills": () => json([aSkill()]),
      "POST /v1/roster/skills": () =>
        json(aSkill({ id: "s-new", code: "planning", name: "Planning", kind: "process" }), 201),
    });
    const { unmount } = renderDesk(<SkillsTab personId={PERSON_ID} canEdit skills={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Add a new skill" }));
    fireEvent.change(screen.getByLabelText("Kind"), { target: { value: "process" } });
    fireEvent.change(screen.getByLabelText("Code"), { target: { value: "Planning" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Planning" } });
    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));
    await screen.findByLabelText("Level for Planning");
    const post = calls.find((call) => call.key === "POST /v1/roster/skills");
    expect(post?.body).toEqual({ kind: "process", code: "planning", name: "Planning" });
    unmount();
    renderDesk(<SkillsTab personId={PERSON_ID} canEdit={false} skills={[aPersonSkill()]} />);
    expect(screen.getByText("Proficient")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save skills" })).not.toBeInTheDocument();
  });
});

describe("CertificationsTab", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("tones expiry red past, amber within 90 days and green beyond", () => {
    const today = new Date("2026-09-07T00:00:00Z");
    render(
      <>
        <ExpiryPill expiresOn="2026-08-01" today={today} />
        <ExpiryPill expiresOn="2026-10-01" today={today} />
        <ExpiryPill expiresOn="2028-03-01" today={today} />
        <ExpiryPill expiresOn={null} today={today} />
      </>,
    );
    expect(screen.getByText("Expired")).toHaveAttribute("data-state", "overdue");
    expect(screen.getByText("Expires in 24 days")).toHaveAttribute("data-state", "needs-input");
    expect(screen.getByText("Valid")).toHaveAttribute("data-state", "complete");
    expect(screen.getByText("No expiry")).toHaveAttribute("data-state", "blocked");
  });

  it("adds with the contract body and removes after a confirm", async () => {
    const calls = stubFetch({
      [`POST /v1/roster/people/${PERSON_ID}/certifications`]: () => json(aCertification({ id: "c-new" }), 201),
      [`DELETE /v1/roster/people/${PERSON_ID}/certifications/${aCertification().id}`]: () =>
        new Response(null, { status: 204 }),
    });
    renderDesk(
      <CertificationsTab
        personId={PERSON_ID}
        canEdit
        certifications={[aCertification()]}
        today={new Date("2026-09-07T00:00:00Z")}
      />,
    );
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "PMP" } });
    fireEvent.change(screen.getByLabelText("Issuer"), { target: { value: "PMI" } });
    fireEvent.change(screen.getByLabelText("Obtained on"), { target: { value: "2026-01-15" } });
    fireEvent.click(screen.getByRole("button", { name: "Add certification" }));
    await waitFor(() => expect(calls.some((call) => call.key.startsWith("POST"))).toBe(true));
    expect(calls.find((call) => call.key.startsWith("POST"))?.body).toEqual({
      name: "PMP",
      issuer: "PMI",
      obtained_on: "2026-01-15",
    });
    const remove = screen.getByRole("button", { name: "Remove" });
    fireEvent.click(remove);
    expect(screen.getByText("Click again to confirm")).toBeInTheDocument();
    expect(calls.some((call) => call.key.startsWith("DELETE"))).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Confirm remove" }));
    await waitFor(() => expect(calls.some((call) => call.key.startsWith("DELETE"))).toBe(true));
  });
});

describe("DetailsTab", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("computes only the changed fields, typed for the API", () => {
    const person = aPersonDetail();
    expect(
      changedFields(person, {
        display_name: person.display_name,
        role: person.role,
        fte_percent: "100",
        hours_base_per_week: "40",
        admin_overhead_percent: "15",
        currency: "GBP",
        country: "GB",
        time_zone: "Europe/London",
        start_date: "2024-01-08",
        end_date: "",
        assignment_group_ids: [...person.assignment_group_ids],
      }),
    ).toEqual({});
    expect(
      changedFields(person, {
        display_name: person.display_name,
        role: "team_lead",
        fte_percent: "60",
        hours_base_per_week: "40",
        admin_overhead_percent: "",
        currency: "gbp",
        country: "",
        time_zone: "Europe/Lisbon",
        start_date: "2024-01-08",
        end_date: "2026-12-31",
        assignment_group_ids: [],
      }),
    ).toEqual({
      role: "team_lead",
      fte_percent: 60,
      admin_overhead_percent: null,
      country: null,
      time_zone: "Europe/Lisbon",
      end_date: "2026-12-31",
      assignment_group_ids: [],
    });
  });

  it("sends the version with the changed fields and toasts Reloaded on stale_version", async () => {
    const refetch = vi.fn();
    const calls = stubFetch({
      [`PATCH /v1/roster/people/${PERSON_ID}`]: () => json({ code: "stale_version" }, 409),
    });
    renderDesk(<DetailsTab person={aPersonDetail()} refetch={refetch} canEdit groups={[]} />);
    fireEvent.change(screen.getByLabelText("FTE %"), { target: { value: "80" } });
    expect(screen.getByText("1 field changed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("Reloaded");
    expect(calls[0].body).toEqual({ version: 2, fte_percent: 80 });
    expect(refetch).toHaveBeenCalled();
  });

  it("is read only without admin:users", () => {
    renderDesk(<DetailsTab person={aPersonDetail()} refetch={() => undefined} canEdit={false} />);
    expect(screen.getByLabelText("FTE %")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
  });
});
