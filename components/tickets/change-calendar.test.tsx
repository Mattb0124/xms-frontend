import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChangeCalendarScreen } from "@/components/tickets/change-calendar";
import { aChangeWindow, ACCOUNT_ID, anOpenWindowAt, aFreeze } from "@/test-kit/tickets";
import { json, renderDesk, renderDeskInShell, stubFetch } from "@/test-kit/desk";

// The toolbar band the screen portals its dimensions into pushes on the
// screen switcher, so the router has to exist.
vi.mock("next/navigation", () => ({
  usePathname: () => "/cases/change-calendar",
  useRouter: () => ({ push: vi.fn() }),
}));

const CALENDAR = "GET /v1/change-calendar";
const AT = "GET /v1/change-calendar/at";

const me = () =>
  json({
    principal: { kind: "internal", userId: "u1", accountIds: [ACCOUNT_ID], permissions: ["tickets:view"] },
  });

const accounts = () => json([{ id: ACCOUNT_ID, key: "BRK", name: "Brookfield", status: "active" }]);

const calendar = (windows: unknown[]) =>
  json({ from: "2026-10-01T00:00:00.000Z", to: "2026-11-01T00:00:00.000Z", windows });

/**
 * The change calendar (TM-18). Every judgement is the server's: whether the
 * desk is inside a window right now comes from the route that answers from
 * the same rules the transition gate uses, and the screen draws it.
 */
describe("ChangeCalendarScreen", () => {
  beforeEach(() => {
    // Only the clock is faked: the timers testing-library waits on stay real,
    // and the month the screen opens on is the one these fixtures are in.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T09:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("asks for the whole month and, with one granted account, for that account right now", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me,
      "GET /v1/accounts": accounts,
      [CALENDAR]: () => calendar([aChangeWindow()]),
      [AT]: () => json(anOpenWindowAt()),
    });
    renderDesk(<ChangeCalendarScreen />);
    await screen.findByRole("list", { name: "Change windows" });
    expect(calls.find((call) => call.key === CALENDAR)?.search).toBe(
      "?from=2026-10-01T00%3A00%3A00.000Z&to=2026-11-01T00%3A00%3A00.000Z",
    );
    await waitFor(() => expect(calls.find((call) => call.key === AT)?.search).toBe(`?account_id=${ACCOUNT_ID}`));
  });

  it("says the desk is inside a window when the server says so", async () => {
    stubFetch({
      "GET /v1/admin/me": me,
      "GET /v1/accounts": accounts,
      [CALENDAR]: () => calendar([aChangeWindow()]),
      [AT]: () => json(anOpenWindowAt()),
    });
    const { container } = renderDesk(<ChangeCalendarScreen />);
    await waitFor(() => expect(container.querySelector('[data-right-now="inside"]')).not.toBeNull());
    expect(screen.getByText("Inside a change window")).toBeTruthy();
  });

  it("says it is frozen rather than open when every window holding the instant is frozen", async () => {
    stubFetch({
      "GET /v1/admin/me": me,
      "GET /v1/accounts": accounts,
      [CALENDAR]: () => calendar([aChangeWindow()]),
      [AT]: () =>
        json(
          anOpenWindowAt({
            inside: false,
            frozen: true,
            windows: [
              {
                id: "w-1",
                name: "October release window",
                status: "active",
                starts_at: "2026-10-03T18:00:00Z",
                ends_at: "2026-10-04T02:00:00Z",
                freeze: aFreeze(),
              },
            ],
          }),
        ),
    });
    const { container } = renderDesk(<ChangeCalendarScreen />);
    await waitFor(() => expect(container.querySelector('[data-right-now="frozen"]')).not.toBeNull());
    expect(screen.getByText("Frozen right now")).toBeTruthy();
    // The reason is on the "right now" line as well as in the month below it.
    expect(screen.getAllByText(/Month-end close/).length).toBeGreaterThan(1);
  });

  it("draws each window with its freezes and the changes planned inside it, and names the next one", async () => {
    stubFetch({
      "GET /v1/admin/me": me,
      "GET /v1/accounts": accounts,
      [CALENDAR]: () => calendar([aChangeWindow()]),
      [AT]: () => json(anOpenWindowAt()),
    });
    const { container } = renderDesk(<ChangeCalendarScreen />);
    const list = within(await screen.findByRole("list", { name: "Change windows" }));
    expect(list.getByText(/Freeze/)).toBeTruthy();
    expect(list.getByText("Deploy the consolidation hotfix")).toBeTruthy();
    expect(list.getByText("CS1000420")).toBeTruthy();
    // The next window is two days out from the frozen clock.
    expect(container.querySelector("[data-next-window]")?.textContent).toContain("in 2 days");
  });

  it("says nothing falls in an empty month, and points at the catalog where one is made", async () => {
    stubFetch({
      "GET /v1/admin/me": me,
      "GET /v1/accounts": accounts,
      [CALENDAR]: () => calendar([]),
      [AT]: () => json(anOpenWindowAt({ inside: false, frozen: false, windows: [] })),
    });
    const { container } = renderDesk(<ChangeCalendarScreen />);
    await screen.findByText(/No change window falls in this month/);
    await screen.findByText("Outside every window");
    expect(container.querySelector("[data-next-window]")?.textContent).toContain("No window opens later this month");
    expect(screen.getByText("The groups catalog")).toHaveAttribute("href", "/cases/groups");
  });

  it("moves the month and sends the new range", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me,
      "GET /v1/accounts": accounts,
      [CALENDAR]: () => calendar([aChangeWindow()]),
      [AT]: () => json(anOpenWindowAt()),
    });
    // The month is the strip's primary dimension now, so the toolbar band has
    // to be mounted for the control to exist at all.
    renderDeskInShell(<ChangeCalendarScreen />);
    await screen.findByRole("list", { name: "Change windows" });
    fireEvent.change(screen.getByLabelText("Month"), { target: { value: "2026-11" } });
    await waitFor(() =>
      expect(calls.filter((call) => call.key === CALENDAR).map((call) => call.search)).toContain(
        "?from=2026-11-01T00%3A00%3A00.000Z&to=2026-12-01T00%3A00%3A00.000Z",
      ),
    );
  });
});
