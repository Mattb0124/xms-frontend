import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { scheduleLabel, TicketGroupsCatalog } from "@/components/tickets/ticket-groups";
import { aProjectGroup, aTicketGroup, ACCOUNT_ID } from "@/test-kit/tickets";
import { json, renderDesk, renderDeskInShell, stubFetch } from "@/test-kit/desk";

// The toolbar band the screen portals its dimensions into pushes on the
// screen switcher, so the router has to exist.
vi.mock("next/navigation", () => ({
  usePathname: () => "/tickets/groups",
  useRouter: () => ({ push: vi.fn() }),
}));

const LIST = "GET /v1/ticket-groups";
const CREATE = "POST /v1/ticket-groups";

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: [ACCOUNT_ID], permissions } });

const accounts = () => json([{ id: ACCOUNT_ID, key: "BRK", name: "Brookfield", status: "active" }]);

/**
 * The groups catalog (TM-10): projects and change windows with the schedule
 * each one carries. The list is `tickets:view`; creating and editing are
 * `tickets:work`, so a reader without it sees the list and no form.
 */
describe("TicketGroupsCatalog", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("names the span of a window and the reason a project has none", () => {
    expect(scheduleLabel({ starts_at: "2026-10-03T18:00:00Z", ends_at: "2026-10-04T02:00:00Z" })).toContain(" to ");
    expect(scheduleLabel({ starts_at: null, ends_at: null })).toBe("No dates");
    expect(scheduleLabel({ starts_at: "2026-10-03T18:00:00Z", ends_at: null })).toContain("From ");
  });

  it("lists both kinds with the account, the freeze count and the status", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["tickets:view"]),
      "GET /v1/accounts": accounts,
      [LIST]: () => json([aTicketGroup(), aProjectGroup()]),
    });
    renderDesk(<TicketGroupsCatalog />);
    await screen.findByText("October release window");
    const list = within(screen.getByRole("table"));
    expect(list.getByText("Cutover programme")).toBeTruthy();
    expect(list.getAllByText("Brookfield")).toHaveLength(2);
    expect(list.getByText("Change window")).toBeTruthy();
    expect(list.getByText("Project")).toBeTruthy();
    expect(list.getByText("Planned")).toBeTruthy();
    expect(list.getByText("Active")).toBeTruthy();
    // The window carries one freeze; the project carries none, so its cell is blank.
    expect(list.getByText("1")).toBeTruthy();
    // Without tickets:work there is no form and no way to open one; the
    // empty state is where the reason lives now, since the toolbar carries
    // the action and a toolbar is no place for a sentence.
    expect(screen.queryByRole("button", { name: "New" })).toBeNull();
  });

  it("sends the filters the API declares", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["tickets:view"]),
      "GET /v1/accounts": accounts,
      [LIST]: () => json([aTicketGroup()]),
    });
    // In a real toolbar band: the dimensions are on the grey strip now, so
    // without one they render nowhere.
    renderDeskInShell(<TicketGroupsCatalog />);
    await screen.findByText("October release window");
    fireEvent.change(screen.getByLabelText("Kind"), { target: { value: "project" } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "active" } });
    await waitFor(() =>
      expect(calls.filter((call) => call.key === LIST).map((call) => call.search)).toContain(
        "?kind=project&status=active",
      ),
    );
  });

  it("refuses a change window without both ends before the API is asked, then creates one", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["tickets:view", "tickets:work"]),
      "GET /v1/accounts": accounts,
      [LIST]: () => json([]),
      [CREATE]: () => json(aTicketGroup(), 201),
    });
    renderDeskInShell(<TicketGroupsCatalog />);
    fireEvent.click(await screen.findByRole("button", { name: "New" }));
    const form = within(await screen.findByRole("form", { name: "New group" }));
    fireEvent.change(form.getByLabelText("Name"), { target: { value: "October release window" } });
    fireEvent.change(form.getByLabelText("Account"), { target: { value: ACCOUNT_ID } });
    fireEvent.click(form.getByText("Create group"));
    await screen.findByText("A change window needs a start and an end.");
    expect(calls.some((call) => call.key === CREATE)).toBe(false);

    fireEvent.change(form.getByLabelText("Starts"), { target: { value: "2026-10-03T18:00" } });
    fireEvent.change(form.getByLabelText("Ends"), { target: { value: "2026-10-04T02:00" } });
    fireEvent.click(form.getByText("Create group"));
    await waitFor(() => expect(calls.some((call) => call.key === CREATE)).toBe(true));
    const body = calls.find((call) => call.key === CREATE)?.body as Record<string, unknown>;
    expect(body).toMatchObject({ account_id: ACCOUNT_ID, kind: "change_window", name: "October release window" });
    // The form holds local times and sends instants.
    expect(String(body.starts_at)).toMatch(/Z$/);
  });

  it("edits the freezes on a window and sends the whole set, a removed one by being absent", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["tickets:view", "tickets:work"]),
      "GET /v1/accounts": accounts,
      [LIST]: () => json([aTicketGroup()]),
      [`PATCH /v1/ticket-groups/${aTicketGroup().id}`]: () => json(aTicketGroup({ version: 2 })),
    });
    renderDesk(<TicketGroupsCatalog />);
    fireEvent.click(await screen.findByText("October release window"));
    const form = within(await screen.findByRole("form", { name: "Edit group" }));
    // The stored freeze is in the form, reason and all.
    expect(form.getByLabelText("Freeze 1 reason")).toHaveValue("Month-end close");

    fireEvent.click(form.getByText("Add freeze"));
    // A freeze nobody finished is refused here, in the API's own rule.
    fireEvent.click(form.getByText("Save group"));
    await screen.findByText("Every freeze needs a start and an end.");
    expect(calls.some((call) => call.key.startsWith("PATCH "))).toBe(false);

    fireEvent.click(form.getAllByText("Remove freeze")[1]);
    fireEvent.click(form.getAllByText("Remove freeze")[0]);
    fireEvent.click(form.getByText("Save group"));
    await waitFor(() => expect(calls.some((call) => call.key.startsWith("PATCH "))).toBe(true));
    expect(calls.find((call) => call.key.startsWith("PATCH "))?.body).toMatchObject({ freeze_windows: [] });
  });

  it("words the API's own refusal of a schedule", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["tickets:view", "tickets:work"]),
      "GET /v1/accounts": accounts,
      [LIST]: () => json([aTicketGroup()]),
      [`PATCH /v1/ticket-groups/${aTicketGroup().id}`]: () =>
        json({ code: "invalid_schedule", problems: ["ends_at must be after starts_at"] }, 400),
    });
    renderDesk(<TicketGroupsCatalog />);
    fireEvent.click(await screen.findByText("October release window"));
    const form = within(await screen.findByRole("form", { name: "Edit group" }));
    // The kind and the account cannot move on an existing record.
    expect(form.getByLabelText("Kind")).toBeDisabled();
    expect(form.getByLabelText("Account")).toBeDisabled();
    fireEvent.click(form.getByText("Save group"));
    await screen.findByText(/ends_at must be after starts_at/);
  });
});
