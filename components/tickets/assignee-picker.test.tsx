import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assigneeLabel, AssigneePicker, rosterHint } from "@/components/tickets/assignee-picker";
import { aPerson } from "@/test-kit/roster";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({ usePathname: () => "/tickets/CS0001204" }));

const USERS = [
  { id: "u-ana", email: "ana.silva@example.com", first_name: "Ana", last_name: "Silva" },
  { id: "u-ben", email: "ben@example.com", first_name: "Ben", last_name: "Ito" },
];

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u-ben", accountIds: [], permissions } });

describe("AssigneePicker roster enrichment", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("formats the hint from the role and time zone", () => {
    expect(rosterHint(aPerson())).toBe("Senior Consultant, Europe/London");
    expect(rosterHint(undefined)).toBe("");
  });

  it("shows role and time zone next to a roster person when the roster is readable", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["tickets:work", "capacity:view"]),
      "GET /v1/users": () => json(USERS),
      "GET /v1/roster/people": () => json([aPerson()]),
    });
    const onChange = vi.fn();
    renderDesk(<AssigneePicker id="assignee" value={null} onChange={onChange} />);
    fireEvent.focus(screen.getByRole("combobox", { name: "Assignee" }));
    await screen.findByText("Senior Consultant, Europe/London");
    expect(calls.find((call) => call.key === "GET /v1/roster/people")?.search).toBe("?active=true");
    // Ben is not on the roster: name and email only.
    const ben = screen.getByRole("option", { name: /Ben Ito/ });
    expect(ben.querySelector("[data-roster-hint]")).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: /Ana Silva/ }));
    expect(onChange).toHaveBeenCalledWith(USERS[0]);
  });

  it("keeps the plain list and never asks for the roster without capacity:view", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["tickets:work"]),
      "GET /v1/users": () => json(USERS),
    });
    renderDesk(<AssigneePicker id="assignee" value={null} onChange={() => undefined} />);
    fireEvent.focus(screen.getByRole("combobox", { name: "Assignee" }));
    await screen.findByRole("option", { name: /Ana Silva/ });
    await waitFor(() => expect(calls.some((call) => call.key === "GET /v1/admin/me")).toBe(true));
    expect(calls.some((call) => call.key === "GET /v1/roster/people")).toBe(false);
    expect(document.querySelector("[data-roster-hint]")).toBeNull();
  });
});

/**
 * Review finding 10: the Assignee control was two rows for one concept, an
 * empty combobox beside "Assign to me" and a separate read-only "Assigned to
 * Ben Okafor" line, so reassigning looked like assigning from nothing.
 */
describe("AssigneePicker names the current assignee", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("words the closed control from the record, marking the reader's own tickets", () => {
    expect(assigneeLabel("Ben Okafor", false)).toBe("Ben Okafor");
    expect(assigneeLabel("Ben Okafor", true)).toBe("Ben Okafor (you)");
    expect(assigneeLabel(null, false)).toBe("Unassigned");
    expect(assigneeLabel(undefined, true)).toBe("Unassigned");
  });

  it("shows the assignee before the directory loads and searches from empty once focused", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["tickets:work"]),
      "GET /v1/users": () => json(USERS),
    });
    renderDesk(<AssigneePicker id="assignee" value="u-ana" valueLabel="Ana Silva" onChange={() => undefined} />);
    const box = screen.getByRole("combobox", { name: "Assignee" });
    expect(box).toHaveValue("Ana Silva");
    expect(box).toHaveAttribute("data-current-assignee", "Ana Silva");
    fireEvent.focus(box);
    // Open, the box is a search field and the assignee stays in the placeholder.
    expect(box).toHaveValue("");
    expect(box).toHaveAttribute("placeholder", "Ana Silva");
    await screen.findByRole("option", { name: /Ana Silva/ });
  });

  it("reads Unassigned with no assignee and hides Assign to me when the reader already holds it", () => {
    stubFetch({ "GET /v1/admin/me": me(["tickets:work"]), "GET /v1/users": () => json(USERS) });
    const { unmount } = renderDesk(
      <AssigneePicker id="assignee" value={null} valueLabel={null} currentUserId="u-ben" onChange={() => undefined} />,
    );
    expect(screen.getByRole("combobox", { name: "Assignee" })).toHaveAttribute("data-current-assignee", "Unassigned");
    expect(screen.getByRole("button", { name: "Assign to me" })).toBeInTheDocument();
    unmount();

    renderDesk(
      <AssigneePicker
        id="assignee"
        value="u-ben"
        valueLabel="Ben Ito"
        currentUserId="u-ben"
        onChange={() => undefined}
      />,
    );
    expect(screen.getByRole("combobox", { name: "Assignee" })).toHaveValue("Ben Ito (you)");
    expect(screen.queryByRole("button", { name: "Assign to me" })).toBeNull();
  });
});

describe("AssigneePicker capacity markers (CAP-06)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("names the marker only for warning and over, and caps the candidates at 50 roster ids", async () => {
    const { aCapacityCheck } = await import("@/test-kit/capacity");
    const { capacityWarning, checkCandidates } = await import("@/components/tickets/assignee-picker");
    expect(capacityWarning(undefined)).toBe("");
    expect(capacityWarning(aCapacityCheck())).toBe("");
    expect(capacityWarning(aCapacityCheck({ status: "warning" }))).toBe("Near capacity this month");
    expect(capacityWarning(aCapacityCheck({ status: "over" }))).toBe("Over capacity this month");
    expect(capacityWarning(aCapacityCheck({ status: "no_calendar" }))).toBe("");
    const users = Array.from({ length: 70 }, (_, index) => ({
      id: `u-${index}`,
      email: `${index}@example.com`,
      first_name: "P",
      last_name: String(index),
    }));
    const byUserId = new Map(users.map((user) => [user.id, aPerson({ id: `p-${user.id}`, user_id: user.id })]));
    const ids = checkCandidates(users, byUserId);
    expect(ids).toHaveLength(50);
    expect(ids[0]).toBe("p-u-0");
    expect(checkCandidates(users.slice(0, 3), new Map())).toEqual([]);
  });

  it("checks the visible candidates once per open picker under tickets:work and shows the hours and the marker", async () => {
    const { aCapacityCheck } = await import("@/test-kit/capacity");
    const calls = stubFetch({
      "GET /v1/admin/me": me(["tickets:work", "capacity:view"]),
      "GET /v1/users": () => json(USERS),
      "GET /v1/roster/people": () =>
        json([aPerson(), aPerson({ id: "p-ben", user_id: "u-ben", display_name: "Ben Ito", role: "consultant" })]),
      "GET /v1/capacity/check": () =>
        json([
          aCapacityCheck(),
          aCapacityCheck({
            person_id: "p-ben",
            display_name: "Ben Ito",
            status: "over",
            allocated_minutes: 8400,
            available_minutes: 7603,
            remaining_minutes: 0,
          }),
        ]),
    });
    renderDesk(<AssigneePicker id="assignee" value={null} onChange={() => undefined} />);
    fireEvent.focus(screen.getByRole("combobox", { name: "Assignee" }));
    const ana = await screen.findByRole("option", { name: /Ana Silva/ });
    await waitFor(() => expect(ana.querySelector("[data-capacity-hint]")).toHaveTextContent("76.8 h left"));
    expect(ana.querySelector("[data-capacity-warning]")).toBeNull();
    const ben = screen.getByRole("option", { name: /Ben Ito/ });
    expect(ben.querySelector("[data-capacity-hint]")).toHaveTextContent("Over by 13.3 h");
    expect(within(ben).getByRole("img", { name: "Over capacity this month" })).toHaveAttribute(
      "data-capacity-warning",
      "over",
    );
    const checks = calls.filter((call) => call.key === "GET /v1/capacity/check");
    expect(checks).toHaveLength(1);
    const params = new URLSearchParams(checks[0].search);
    expect(params.get("person_ids")?.split(",")).toEqual([aPerson().id, "p-ben"]);
    expect(params.get("month")).toMatch(/^\d{4}-\d{2}$/);
  });

  it("never checks capacity without tickets:work", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["capacity:view"]),
      "GET /v1/users": () => json(USERS),
      "GET /v1/roster/people": () => json([aPerson()]),
    });
    renderDesk(<AssigneePicker id="assignee" value={null} onChange={() => undefined} />);
    fireEvent.focus(screen.getByRole("combobox", { name: "Assignee" }));
    await screen.findByText("Senior Consultant, Europe/London");
    expect(calls.some((call) => call.key === "GET /v1/capacity/check")).toBe(false);
    expect(document.querySelector("[data-capacity-hint]")).toBeNull();
  });
});
