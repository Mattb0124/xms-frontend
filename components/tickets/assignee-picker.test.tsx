import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssigneePicker, rosterHint } from "@/components/tickets/assignee-picker";
import { aPerson } from "@/redux/rosterApi.test";
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
