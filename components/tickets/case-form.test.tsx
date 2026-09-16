import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaseForm, billableMinutes, externalReference } from "@/components/tickets/case-form";
import { NOTES_TABS, RELATED_TABS } from "@/components/tickets/record-tabs";
import { ACCOUNT_ID, CONTRACT_ID, aContract, aTicketView } from "@/test-kit/tickets";
import { aPosition } from "@/test-kit/time";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({ usePathname: () => "/cases/CS1000199" }));

const ACCOUNTS = [{ id: ACCOUNT_ID, key: "AUS", name: "Austral Mining Corporation" }];

/** Two entries, one billable: 1h 30m of the 2h 00m logged bills. */
const TIME = {
  entries: [
    { id: "t-1", minutes: 90, billable_class: "billable", activity_type: "analysis" },
    { id: "t-2", minutes: 30, billable_class: "internal", activity_type: "meeting" },
  ],
  total_minutes: 120,
};

function stub(permissions: string[], extra: Record<string, () => Response> = {}) {
  return stubFetch({
    "GET /v1/admin/me": () => json({ principal: { kind: "internal", userId: "u-ben", accountIds: [], permissions } }),
    "GET /v1/accounts": () => json(ACCOUNTS),
    "GET /v1/groups": () => json([]),
    "GET /v1/users": () => json([]),
    [`GET /v1/accounts/${ACCOUNT_ID}/contracts`]: () => json([aContract()]),
    "GET /v1/tickets/CS1000199/time": () => json(TIME),
    ...extra,
  });
}

/** The label of every row, in document order: the left column, then the right, then the wide rows. */
function labelsOf(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("[data-field]"))
    .map((row) => row.querySelector("span,label")?.textContent ?? "")
    .filter(Boolean);
}

/**
 * Matt's direction 2026-09-15: the case form reads the way the ServiceNow CSM
 * case form reads, so the team's hands find each field where they already
 * go. Two columns, labels right-aligned against the controls, the short
 * description and the description full width under them.
 */
describe("CaseForm", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("draws ServiceNow's two columns in its order, then the description rows", async () => {
    stub(["tickets:view"]);
    const { container } = renderDesk(
      <CaseForm ticket={aTicketView({ configuration_item_id: "ci-1", configuration_item_name: "HFM PROD" })} />,
    );
    await screen.findByText("Total time");
    expect(labelsOf(container)).toEqual([
      "Number",
      "Channel",
      "Ticket type",
      "Category",
      "Configuration item",
      "Account",
      "Requester",
      "Contract",
      "State",
      "Assignment group",
      "Assigned to",
      "Impact",
      "Urgency",
      "Priority",
      "Created",
      "Created by",
      "Total time",
      "Billable time",
      "External reference",
      "Out of scope",
      "Short description",
      "Description",
    ]);
    // The number is the key, and the state is a value: the state menu in the
    // record bar is the way to change it.
    expect(container.querySelector('[data-field="number"]')).toHaveTextContent("CS1000199");
    expect(container.querySelector('[data-field="state"]')).toHaveTextContent(aTicketView().state_label);
  });

  it("is named Details and carries the matrix caption under the priority, which is a select in place", async () => {
    stub(["tickets:view", "tickets:override-priority"]);
    const { container } = renderDesk(<CaseForm ticket={aTicketView()} />);
    expect(screen.getByRole("region", { name: "Details" })).toBeInTheDocument();
    expect(container.querySelector('[data-field="priority"]')).toHaveTextContent("Derived from the matrix");
    // ServiceNow's controls stand open on the form; nothing is clicked first.
    await waitFor(() => expect(screen.getByLabelText("Priority")).toHaveValue("p2"));
  });

  it("says so when the priority was overridden by hand", async () => {
    stub(["tickets:view", "tickets:override-priority"]);
    const { container } = renderDesk(<CaseForm ticket={aTicketView({ priority_overridden: true })} />);
    await waitFor(() =>
      expect(container.querySelector('[data-field="priority"]')).toHaveTextContent("Overridden by hand"),
    );
  });

  /**
   * The running stack once drew the contract's uuid, because the row's only
   * option was built from the id itself whenever the account's contract
   * directory was out of reach. The position route names it instead.
   */
  it("names the contract, and shows no id in any row", async () => {
    stubFetch({
      "GET /v1/admin/me": () =>
        json({ principal: { kind: "internal", userId: "u-ana", accountIds: [], permissions: ["tickets:view"] } }),
      "GET /v1/accounts": () => json(ACCOUNTS),
      "GET /v1/groups": () => json([]),
      "GET /v1/users": () => json([]),
      "GET /v1/tickets/CS1000199/time": () => json(TIME),
      [`GET /v1/accounts/${ACCOUNT_ID}/contracts/${CONTRACT_ID}/position`]: () =>
        json(
          aPosition({
            contract: { id: CONTRACT_ID, key: "CT10001", name: "Managed services retainer", model: "retainer" },
          }),
        ),
    });
    const ticket = aTicketView();
    const { container } = renderDesk(<CaseForm ticket={ticket} />);
    await waitFor(() =>
      expect(container.querySelector('[data-field="contract_id"]')).toHaveTextContent(
        "CT10001 Managed services retainer",
      ),
    );
    expect(container.textContent).not.toContain(ticket.contract_id);
    expect(container.textContent).not.toContain(ticket.account_id);
  });

  it("prints the total and the billable time from the ticket's entries", async () => {
    stub(["tickets:view"]);
    const { container } = renderDesk(<CaseForm ticket={aTicketView()} />);
    await waitFor(() => expect(container.querySelector('[data-field="total_time"]')).toHaveTextContent("2h 00m"));
    expect(container.querySelector('[data-field="billable_time"]')).toHaveTextContent("1h 30m");
  });

  it("shows the account in full, the requester by name, and the assignee picker in place", async () => {
    stub(["tickets:view"]);
    const { container } = renderDesk(<CaseForm ticket={aTicketView()} />);
    await waitFor(() =>
      expect(container.querySelector('[data-field="account"] [data-readonly-value]')).toHaveTextContent(
        "AUS · Austral Mining Corporation",
      ),
    );
    expect(container.querySelector('[data-field="requester"] [data-readonly-value]')).toHaveTextContent("Pat Client");
    // The picker is drawn in place, as ServiceNow draws Assigned to, and it
    // names the assignee itself; the seeded reader is the assignee here.
    expect(screen.getByRole("combobox", { name: "Assignee" })).toHaveAttribute(
      "data-current-assignee",
      "Ben Okafor (you)",
    );
  });

  it("commits the short description and the description as fields of the form", async () => {
    const calls = stub(["tickets:view", "tickets:work"], {
      "PATCH /v1/tickets/CS1000199": () => json(aTicketView({ version: 4 })),
    });
    renderDesk(<CaseForm ticket={aTicketView()} />);
    const description = await screen.findByLabelText("Description");
    fireEvent.change(description, { target: { value: "The report times out after 30 seconds." } });
    fireEvent.blur(description);
    await waitFor(() => expect(calls.some((call) => call.key.startsWith("PATCH "))).toBe(true));
    expect(calls.find((call) => call.key.startsWith("PATCH "))?.body).toEqual({
      version: 3,
      description: "The report times out after 30 seconds.",
    });
  });
});

describe("the form's own arithmetic", () => {
  it("sums the billable class alone, at the adjusted minutes where an entry was adjusted", () => {
    expect(
      billableMinutes([
        { minutes: 90, billable_class: "billable" },
        { minutes: 60, adjusted_minutes: 45, billable_class: "billable" },
        { minutes: 30, billable_class: "internal" },
      ]),
    ).toBe(135);
  });

  it("joins the external references and reads an empty map as nothing", () => {
    expect(externalReference({ servicenow: "INC0448120", opsramp: "52824463" })).toBe("INC0448120 · 52824463");
    expect(externalReference({})).toBe("");
  });
});

/**
 * The two tab rows under the form, in ServiceNow's order: what a person
 * writes on the case, then the lists that hang off it, SLAs first.
 */
describe("the record's tabs", () => {
  it("puts the notes and the closure information under the form", () => {
    expect(NOTES_TABS.map((tab) => tab.label)).toEqual(["Notes", "Closure information"]);
  });

  it("orders the related lists as ServiceNow does, SLAs first", () => {
    expect(RELATED_TABS.map((tab) => tab.label)).toEqual([
      "SLAs",
      "Time entries",
      "Attachments",
      "Related cases",
      "Emails",
      "Activity",
      "Solutions",
      "Contract",
      "Scope",
      "Sync",
    ]);
  });
});

/**
 * Reassignment (TM-08): a ticket moves to a group or to a person. The pickers
 * stand in place on the form now, so nothing is opened first.
 */
describe("CaseForm reassignment", () => {
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
      "GET /v1/tickets/CS1000199/time": () => json(TIME),
      "PATCH /v1/tickets/CS1000199": patch ?? (() => json(aTicketView({ group_id: GROUP_ID, version: 4 }))),
    });
  }

  it("moves the ticket to a group and sends the version with it", async () => {
    const calls = stubGroups(["tickets:view", "tickets:work"]);
    renderDesk(<CaseForm ticket={aTicketView()} />);
    await screen.findByRole("option", { name: "Application support" });
    fireEvent.change(screen.getByLabelText("Group"), { target: { value: GROUP_ID } });
    await waitFor(() => expect(calls.some((call) => call.key.startsWith("PATCH "))).toBe(true));
    expect(calls.find((call) => call.key.startsWith("PATCH "))?.body).toEqual({ version: 3, group_id: GROUP_ID });
  });

  it("leaves a retired group off the picker, since the API refuses work queued to one", async () => {
    stubGroups(["tickets:view", "tickets:work"]);
    renderDesk(<CaseForm ticket={aTicketView()} />);
    await screen.findByRole("option", { name: "Application support" });
    expect(screen.queryByRole("option", { name: /Legacy team/ })).toBeNull();
  });

  it("still shows a retired group that is the one in force", async () => {
    stubGroups(["tickets:view", "tickets:work"]);
    renderDesk(<CaseForm ticket={aTicketView({ group_id: "g-old" })} />);
    expect(await screen.findByRole("option", { name: "Legacy team (retired)" })).toBeTruthy();
  });

  it("words the refusal when the group has been retired underneath the desk", async () => {
    stubGroups(["tickets:view", "tickets:work"], () => json({ code: "group_retired" }, 400));
    renderDesk(<CaseForm ticket={aTicketView()} />);
    await screen.findByRole("option", { name: "Application support" });
    fireEvent.change(screen.getByLabelText("Group"), { target: { value: GROUP_ID } });
    await screen.findByText(/has been retired/);
  });
});
