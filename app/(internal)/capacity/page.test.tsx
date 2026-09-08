import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CapacityPage from "@/app/(internal)/capacity/page";
import { changedCells, presentAccounts, REMAINING_BASIS } from "@/components/capacity/capacity-grid";
import { capacityFilterToSearch } from "@/lib/capacity/filters";
import {
  ACCOUNT_ID,
  aCapacityPerson,
  aCapacityView,
  anAllocation,
  anOverPerson,
  OTHER_ACCOUNT_ID,
  OTHER_PERSON_ID,
} from "@/redux/capacityApi.test";
import { PERSON_ID } from "@/redux/rosterApi.test";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

const navigation = vi.hoisted(() => ({ search: "", replace: vi.fn(), push: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/capacity",
  useRouter: () => ({ replace: navigation.replace, push: navigation.push }),
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: [ACCOUNT_ID, OTHER_ACCOUNT_ID], permissions } });

const THIRD_ACCOUNT_ID = "99999999-9999-4999-8999-999999999999";
const ACCOUNTS = [
  { id: ACCOUNT_ID, key: "BRK", name: "Brookfield", status: "active" },
  { id: OTHER_ACCOUNT_ID, key: "AUS", name: "Austral Mining", status: "active" },
  { id: THIRD_ACCOUNT_ID, key: "NOR", name: "Northwind", status: "active" },
];

describe("capacity grid helpers", () => {
  it("lists the accounts present on any row plus the added ones, once each", () => {
    expect(presentAccounts(aCapacityView(), [])).toEqual([ACCOUNT_ID, OTHER_ACCOUNT_ID]);
    expect(presentAccounts(aCapacityView(), [ACCOUNT_ID, THIRD_ACCOUNT_ID])).toEqual([
      ACCOUNT_ID,
      OTHER_ACCOUNT_ID,
      THIRD_ACCOUNT_ID,
    ]);
  });

  it("builds the PUT cells from the changed drafts only, with the version and the note of an existing cell", () => {
    const view = aCapacityView();
    expect(
      changedCells(view, "2026-09", {
        [`${PERSON_ID}:${ACCOUNT_ID}`]: "60",
        [`${OTHER_PERSON_ID}:${ACCOUNT_ID}`]: "not hours",
      }),
    ).toEqual([]);
    expect(
      changedCells(view, "2026-09", {
        [`${PERSON_ID}:${ACCOUNT_ID}`]: "70",
        [`${PERSON_ID}:${THIRD_ACCOUNT_ID}`]: "8.5",
        [`${OTHER_PERSON_ID}:${OTHER_ACCOUNT_ID}`]: "",
      }),
    ).toEqual([
      { person_id: PERSON_ID, account_id: ACCOUNT_ID, month: "2026-09-01", planned_minutes: 4200, version: 2 },
      { person_id: PERSON_ID, account_id: THIRD_ACCOUNT_ID, month: "2026-09-01", planned_minutes: 510 },
      {
        person_id: OTHER_PERSON_ID,
        account_id: OTHER_ACCOUNT_ID,
        month: "2026-09-01",
        planned_minutes: 0,
        version: 3,
        note: "Go-live support",
      },
    ]);
  });
});

describe("CapacityPage", () => {
  beforeEach(() => {
    navigation.search = "";
    navigation.replace.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("fails closed without capacity:view and never asks for the month", async () => {
    const calls = stubFetch({ "GET /v1/admin/me": me(["tickets:view", "tickets:work"]) });
    renderDesk(<CapacityPage />);
    await screen.findByText("Not permitted");
    expect(screen.getByText(/needs the capacity:view permission/)).toBeInTheDocument();
    expect(calls.some((call) => call.key === "GET /v1/capacity")).toBe(false);
  });

  it("sends the URL filters to the API, shows the rows read only, and leaves the directories alone without tickets:view", async () => {
    navigation.search = `month=2026-09&role=consultant&group=g-1&account=${ACCOUNT_ID}`;
    const calls = stubFetch({
      "GET /v1/admin/me": me(["capacity:view"]),
      "GET /v1/capacity": () => json(aCapacityView()),
    });
    renderDesk(<CapacityPage />);
    const table = await screen.findByRole("table", { name: "Capacity by person" });
    const view = calls.find((call) => call.key === "GET /v1/capacity");
    expect(decodeURIComponent(view?.search ?? "")).toBe(`?month=2026-09&role=consultant&group=g-1&account=${ACCOUNT_ID}`);
    expect(calls.some((call) => call.key === "GET /v1/accounts" || call.key === "GET /v1/groups")).toBe(false);
    const ana = within(table).getByRole("row", { name: /Ana Silva/ });
    expect(ana.querySelector("[data-available]")).toHaveTextContent("136.8 h");
    expect(ana.querySelector("[data-allocated]")).toHaveTextContent("60 h");
    expect(ana.querySelector("[data-actual]")).toHaveTextContent("9 h");
    expect(ana.querySelector("[data-remaining]")).toHaveTextContent("76.8 h");
    /*
     * Review finding 16: a row reading Available 158.4 h, Allocated 0 h,
     * Actual 15.5 h, Remaining 158.4 h contradicts itself under a bare
     * "Remaining" heading. The server's remaining is available minus
     * allocated, clamped at zero, so the column says which plan it counts.
     */
    const remainingHead = within(table).getByRole("columnheader", { name: "Remaining of plan" });
    expect(remainingHead).toHaveAttribute("title", REMAINING_BASIS);
    expect(within(table).queryByRole("columnheader", { name: "Remaining" })).toBeNull();
    expect(screen.getByRole("region", { name: "People" })).toHaveTextContent(
      "the actual hours logged do not reduce it",
    );
    expect(within(ana).getByText("Available")).toHaveAttribute("data-state", "complete");
    const ben = within(table).getByRole("row", { name: /Ben Ito/ });
    expect(within(ben).getByText("Over")).toHaveAttribute("data-state", "overdue");
    expect(ben.querySelector("[data-remaining]")).toHaveTextContent("0 h");
    // Without the account directory the columns are named by the short id and the cells are plain text.
    expect(within(table).getByRole("columnheader", { name: ACCOUNT_ID.slice(0, 8) })).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Save allocations/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Filter by account")).toBeDisabled();
    const totals = screen.getByTestId("capacity-totals");
    expect(totals.querySelector("[data-total-available]")).toHaveTextContent("263.5 h");
    expect(totals.querySelector("[data-total-allocated]")).toHaveTextContent("200 h");
    expect(totals.querySelector("[data-total-actual]")).toHaveTextContent("29.5 h");
    // The remaining total is the server's sum (each person's remaining clamped at 0), not available minus allocated.
    expect(totals.querySelector("[data-total-remaining]")).toHaveTextContent("76.8 h");
    // The month travels to the other screen (left off the link only when it is the current month).
    expect(screen.getByRole("link", { name: "Planned versus actual" })).toHaveAttribute(
      "href",
      `/capacity/variance${capacityFilterToSearch({ month: "2026-09" })}`,
    );
    // The demand overlay: the server's weighted pipeline and project figures against the month, with the subjects.
    const overlay = screen.getByTestId("demand-overlay");
    expect(overlay.querySelector("[data-overlay-allocated]")).toHaveTextContent("200 h");
    expect(overlay.querySelector("[data-overlay-pipeline]")).toHaveTextContent("100 h");
    expect(overlay.querySelector("[data-overlay-project]")).toHaveTextContent("40 h");
    expect(overlay.querySelector("[data-overlay-total]")).toHaveTextContent("140 h");
    expect(overlay.querySelector("[data-overlay-available]")).toHaveTextContent("263.5 h");
    expect(overlay).toHaveTextContent("140 h of demand against 76.8 h remaining");
    const subjects = within(overlay).getByRole("list", { name: "Demand by subject" });
    expect(within(subjects).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "BRK Project 40 h",
      "Acme Corp Pipeline 200 h at 50%, 100 h weighted",
    ]);
    const bar = within(overlay).getByRole("img", { name: /Allocated 200 h/ });
    expect(bar.querySelector("[data-segment='allocated']")).toHaveStyle({ width: "58.82%" });
    expect(bar.querySelector("[data-segment='pipeline']")).toHaveStyle({ width: "29.41%" });
    expect(bar.querySelector("[data-segment='project']")).toHaveStyle({ width: "11.76%" });
  });

  it("says so when the month has no demand and links to the demand screen", async () => {
    navigation.search = "month=2026-09";
    stubFetch({
      "GET /v1/admin/me": me(["capacity:view"]),
      "GET /v1/capacity": () =>
        json(
          aCapacityView({
            demand: { pipeline_minutes_weighted: 0, project_minutes: 0, total_minutes: 0, by_subject: [] },
          }),
        ),
    });
    renderDesk(<CapacityPage />);
    const overlay = await screen.findByTestId("demand-overlay");
    expect(overlay).toHaveTextContent("No demand entered for September 2026.");
    expect(within(overlay).getByRole("link", { name: "Enter demand" })).toHaveAttribute("href", "/capacity/demand?from=2026-09");
    expect(within(overlay).queryByRole("list", { name: "Demand by subject" })).not.toBeInTheDocument();
  });


  it("rewrites the URL when the month or a filter changes", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["capacity:view", "tickets:view"]),
      "GET /v1/capacity": () => json(aCapacityView()),
      "GET /v1/accounts": () => json(ACCOUNTS),
      "GET /v1/groups": () => json([{ id: "g-1", name: "OneStream squad" }]),
    });
    renderDesk(<CapacityPage />);
    await screen.findByRole("table", { name: "Capacity by person" });
    fireEvent.change(screen.getByLabelText("Month"), { target: { value: "2026-10" } });
    expect(navigation.replace).toHaveBeenLastCalledWith(`/capacity${capacityFilterToSearch({ month: "2026-10" })}`);
    await waitFor(() => expect(screen.getByLabelText("Filter by group")).not.toBeDisabled());
    // No month in the URL means the current month, which is never written back.
    fireEvent.change(screen.getByLabelText("Filter by group"), { target: { value: "g-1" } });
    expect(navigation.replace).toHaveBeenLastCalledWith("/capacity?group=g-1");
  });

  it("edits cells inline under capacity:manage and saves them as one PUT with the versions; 0 clears", async () => {
    navigation.search = "month=2026-09";
    const calls = stubFetch({
      "GET /v1/admin/me": me(["capacity:view", "capacity:manage", "tickets:view"]),
      "GET /v1/capacity": () => json(aCapacityView()),
      "GET /v1/accounts": () => json(ACCOUNTS),
      "GET /v1/groups": () => json([]),
      "PUT /v1/allocations": () =>
        json({
          cells: [
            anAllocation({ planned_minutes: 4200, version: 3 }),
            { removed: true, person_id: OTHER_PERSON_ID, account_id: OTHER_ACCOUNT_ID, month: "2026-09-01" },
          ],
        }),
    });
    renderDesk(<CapacityPage />);
    await screen.findByRole("table", { name: "Capacity by person" });
    await screen.findByRole("columnheader", { name: "BRK" });
    const save = screen.getByRole("button", { name: "Save allocations" });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Ana Silva on BRK"), { target: { value: "70" } });
    fireEvent.change(screen.getByLabelText("Ben Ito on AUS"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save allocations (2)" }));
    await waitFor(() => expect(calls.some((call) => call.key === "PUT /v1/allocations")).toBe(true));
    expect(calls.find((call) => call.key === "PUT /v1/allocations")?.body).toEqual({
      cells: [
        { person_id: PERSON_ID, account_id: ACCOUNT_ID, month: "2026-09-01", planned_minutes: 4200, version: 2 },
        {
          person_id: OTHER_PERSON_ID,
          account_id: OTHER_ACCOUNT_ID,
          month: "2026-09-01",
          planned_minutes: 0,
          version: 3,
          note: "Go-live support",
        },
      ],
    });
    await screen.findByText("Allocations saved");
    expect(screen.getByText("2 cells written, 1 cleared.")).toBeInTheDocument();
    // The view is read again after the write.
    await waitFor(() => expect(calls.filter((call) => call.key === "GET /v1/capacity")).toHaveLength(2));
  });

  it("words stale_version, drops the drafts and reloads the month", async () => {
    navigation.search = "month=2026-09";
    const calls = stubFetch({
      "GET /v1/admin/me": me(["capacity:view", "capacity:manage", "tickets:view"]),
      "GET /v1/capacity": () => json(aCapacityView({ people: [aCapacityPerson()] })),
      "GET /v1/accounts": () => json(ACCOUNTS),
      "GET /v1/groups": () => json([]),
      "PUT /v1/allocations": () => json({ code: "stale_version", entity: "allocation", current: 5 }, 409),
    });
    renderDesk(<CapacityPage />);
    await screen.findByRole("columnheader", { name: "BRK" });
    fireEvent.change(screen.getByLabelText("Ana Silva on BRK"), { target: { value: "80" } });
    fireEvent.click(screen.getByRole("button", { name: "Save allocations (1)" }));
    await screen.findByText("Reloaded");
    expect(screen.getByText("Someone else changed the allocations. They have been reloaded.")).toBeInTheDocument();
    await waitFor(() => expect(calls.filter((call) => call.key === "GET /v1/capacity")).toHaveLength(2));
    expect(screen.getByLabelText("Ana Silva on BRK")).toHaveValue(60);
  });

  it("adds a column for a granted account not yet on the grid", async () => {
    navigation.search = "month=2026-09";
    stubFetch({
      "GET /v1/admin/me": me(["capacity:view", "capacity:manage", "tickets:view"]),
      "GET /v1/capacity": () => json(aCapacityView({ people: [anOverPerson()] })),
      "GET /v1/accounts": () => json(ACCOUNTS),
      "GET /v1/groups": () => json([]),
    });
    renderDesk(<CapacityPage />);
    await screen.findByRole("columnheader", { name: "AUS" });
    expect(screen.queryByRole("columnheader", { name: "NOR" })).not.toBeInTheDocument();
    const chooser = screen.getByLabelText("Add account");
    expect(within(chooser).getAllByRole("option").map((option) => option.textContent)).toEqual(["Add account", "NOR Northwind"]);
    fireEvent.change(chooser, { target: { value: THIRD_ACCOUNT_ID } });
    expect(screen.getByRole("columnheader", { name: "NOR" })).toBeInTheDocument();
    expect(screen.getByLabelText("Ben Ito on NOR")).toHaveValue(null);
    expect(screen.queryByLabelText("Add account")).not.toBeInTheDocument();
  });
});
