import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PropertiesPanel } from "@/components/tickets/properties-panel";
import { WORK_AREA_TABS } from "@/components/tickets/work-area-tabs";
import { ACCOUNT_ID, aContract, aTicketView } from "@/redux/ticketsApi.test";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({ usePathname: () => "/tickets/CS1000199" }));

const ACCOUNTS = [{ id: ACCOUNT_ID, key: "AUS", name: "Austral Mining Corporation" }];

function stub(permissions: string[]) {
  return stubFetch({
    "GET /v1/admin/me": () => json({ principal: { kind: "internal", userId: "u-ben", accountIds: [], permissions } }),
    "GET /v1/accounts": () => json(ACCOUNTS),
    "GET /v1/groups": () => json([]),
    "GET /v1/users": () => json([]),
    [`GET /v1/accounts/${ACCOUNT_ID}/contracts`]: () => json([aContract()]),
  });
}

/**
 * Review findings 9 and 21: the panel's eyebrow read "PRIORITY FROM THE
 * MATRIX", which is a caption belonging beside the Priority value rather
 * than the panel's name, and read-only values sat in input-shaped boxes that
 * clipped their content.
 */
describe("PropertiesPanel", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is named Properties and carries the matrix caption on the Priority row", async () => {
    stub(["tickets:view", "tickets:override-priority"]);
    const { container } = renderDesk(<PropertiesPanel ticket={aTicketView()} />);
    expect(screen.getByRole("region", { name: "Properties" })).toBeInTheDocument();
    expect(screen.queryByText(/priority from the matrix/i)).toBeNull();
    expect(container.querySelector('[data-field="priority"]')).toHaveTextContent("Derived from the matrix");
    await waitFor(() => expect(screen.getByLabelText("Priority")).toHaveValue("p2"));
  });

  it("says so when the priority was overridden by hand", async () => {
    stub(["tickets:view", "tickets:override-priority"]);
    const { container } = renderDesk(<PropertiesPanel ticket={aTicketView({ priority_overridden: true })} />);
    await waitFor(() =>
      expect(container.querySelector('[data-field="priority"]')).toHaveTextContent("Overridden by hand"),
    );
  });

  it("shows the whole account and requester as text, with no second Assigned to row", async () => {
    stub(["tickets:view"]);
    const { container } = renderDesk(<PropertiesPanel ticket={aTicketView()} />);
    await waitFor(() =>
      expect(container.querySelector('[data-field="account"] [data-readonly-value]')).toHaveTextContent(
        "AUS · Austral Mining Corporation",
      ),
    );
    expect(container.querySelector('[data-field="requester"] [data-readonly-value]')).toHaveTextContent(
      "Pat Client <pat.client@example.test>",
    );
    // One control for one concept: the picker names the assignee itself.
    expect(screen.queryByText("Assigned to")).toBeNull();
    // The seeded reader is the assignee here, so the control marks it "(you)".
    expect(screen.getByRole("combobox", { name: "Assignee" })).toHaveAttribute(
      "data-current-assignee",
      "Ben Okafor (you)",
    );
  });
});

/** Review finding 21: the tab order differed from the prototype. */
describe("the work area tabs", () => {
  it("follows the prototype order, with Email after the five it shares", () => {
    expect(WORK_AREA_TABS.map((tab) => tab.label)).toEqual([
      "Conversation",
      "Activity",
      "Time",
      "Resolution",
      "Links",
      "Email",
    ]);
  });
});

/**
 * Reassignment (TM-08): a ticket moves to a group or to a person, and the
 * group is a picker of its own rather than a properties row, because it is
 * the queue the work sits in.
 */
describe("PropertiesPanel reassignment", () => {
  afterEach(() => vi.unstubAllGlobals());

  const GROUP_ID = "99999999-9999-4999-8999-999999999999";

  function stubGroups(permissions: string[], patch?: () => Response) {
    return stubFetch({
      "GET /v1/admin/me": () => json({ principal: { kind: "internal", userId: "u-ben", accountIds: [], permissions } }),
      "GET /v1/accounts": () => json(ACCOUNTS),
      "GET /v1/groups": () =>
        json([
          { id: GROUP_ID, name: "Application support", status: "active" },
          { id: "g-old", name: "Legacy team", status: "retired" },
        ]),
      "GET /v1/users": () => json([]),
      [`GET /v1/accounts/${ACCOUNT_ID}/contracts`]: () => json([aContract()]),
      "PATCH /v1/tickets/CS1000199": patch ?? (() => json(aTicketView({ group_id: GROUP_ID, version: 4 }))),
    });
  }

  it("moves the ticket to a group and sends the version with it", async () => {
    const calls = stubGroups(["tickets:view", "tickets:work"]);
    renderDesk(<PropertiesPanel ticket={aTicketView()} />);
    await screen.findByRole("option", { name: "Application support" });
    fireEvent.change(screen.getByLabelText("Group"), { target: { value: GROUP_ID } });
    await waitFor(() => expect(calls.some((call) => call.key.startsWith("PATCH "))).toBe(true));
    expect(calls.find((call) => call.key.startsWith("PATCH "))?.body).toEqual({ version: 3, group_id: GROUP_ID });
  });

  it("leaves a retired group off the picker, since the API refuses work queued to one", async () => {
    stubGroups(["tickets:view", "tickets:work"]);
    renderDesk(<PropertiesPanel ticket={aTicketView()} />);
    await screen.findByRole("option", { name: "Application support" });
    expect(screen.queryByRole("option", { name: /Legacy team/ })).toBeNull();
  });

  it("still shows a retired group that is the one in force", async () => {
    stubGroups(["tickets:view", "tickets:work"]);
    renderDesk(<PropertiesPanel ticket={aTicketView({ group_id: "g-old" })} />);
    expect(await screen.findByRole("option", { name: "Legacy team (retired)" })).toBeTruthy();
  });

  it("words the refusal when the group has been retired underneath the desk", async () => {
    stubGroups(["tickets:view", "tickets:work"], () => json({ code: "group_retired" }, 400));
    renderDesk(<PropertiesPanel ticket={aTicketView()} />);
    await screen.findByRole("option", { name: "Application support" });
    fireEvent.change(screen.getByLabelText("Group"), { target: { value: GROUP_ID } });
    await screen.findByText(/has been retired/);
  });
});
