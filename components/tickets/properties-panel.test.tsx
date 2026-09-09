import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PropertiesPanel } from "@/components/tickets/properties-panel";
import { WORK_AREA_TABS } from "@/components/tickets/work-area-tabs";
import { ACCOUNT_ID, CONTRACT_ID, aContract, aTicketView } from "@/test-kit/tickets";
import { aPosition } from "@/test-kit/time";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({ usePathname: () => "/cases/CS1000199" }));

const ACCOUNTS = [{ id: ACCOUNT_ID, key: "AUS", name: "Austral Mining Corporation" }];

/**
 * A properties row is text at rest and reveals its control on click, which is
 * the hand-off's own rule for this rail: an open bordered select standing in a
 * 262px column is the one shape it must not have. Every test that drives the
 * group or assignee picker opens its row first, as a reader does.
 */
async function openRow(name: string) {
  fireEvent.click(await screen.findByRole("button", { name }));
}

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

  /*
   * The prototype's own `ticketProps` (`proto-v3/template.pretty.html`) is
   * fourteen rows in this order. The built panel had no Configuration item,
   * put Group and Assignee last, and carried Created, Resolved and Closed,
   * which the prototype's list does not have at all.
   */
  it("draws the prototype's own rows, in its order", async () => {
    stub(["tickets:view"]);
    // The row is a picker over the account register now, so it names the
    // item by its id and draws the name the register gave it.
    const { container } = renderDesk(
      <PropertiesPanel ticket={aTicketView({ configuration_item_id: "ci-1", configuration_item_name: "HFM PROD" })} />,
    );
    await screen.findByText("Configuration item");
    const labels = Array.from(container.querySelectorAll("[data-field]"))
      .map((row) => row.querySelector("span,label")?.textContent)
      .filter(Boolean);
    expect(labels.slice(0, 8)).toEqual([
      "Account",
      "Requester",
      "Type",
      "Category",
      "Configuration item",
      "Impact / urgency",
      "Priority",
      "Contract",
    ]);
    expect(labels).toContain("Source");
    expect(labels).toContain("Out of scope");
    expect(labels).toContain("External reference");
    for (const gone of ["Created", "Resolved", "Closed"]) expect(labels).not.toContain(gone);
    expect(container.querySelector('[data-field="configuration_item_id"]')).toBeTruthy();
  });

  it("is named Properties and carries the matrix caption on the Priority row", async () => {
    stub(["tickets:view", "tickets:override-priority"]);
    const { container } = renderDesk(<PropertiesPanel ticket={aTicketView()} />);
    expect(screen.getByRole("region", { name: "Properties" })).toBeInTheDocument();
    expect(screen.queryByText(/priority from the matrix/i)).toBeNull();
    // Render 02 reads the row as one line: "P2 · derived from the matrix".
    expect(container.querySelector('[data-field="priority"]')).toHaveTextContent("· derived from the matrix");
    // v3 render 02: a stacked row is its value as text until it is clicked, so
    // the select is not in the tree at rest. Clicking the value opens it.
    await waitFor(() => expect(screen.getByRole("button", { name: "P2" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "P2" }));
    await waitFor(() => expect(screen.getByLabelText("Priority")).toHaveValue("p2"));
  });

  /**
   * Render 02 names the contract ("Managed support 2026"); the running stack
   * drew its uuid, because the row's only option was built from the id
   * itself whenever the account's contract directory was out of reach.
   */
  it("names the contract, and shows no id in any row", async () => {
    stubFetch({
      "GET /v1/admin/me": () =>
        json({ principal: { kind: "internal", userId: "u-ana", accountIds: [], permissions: ["tickets:view"] } }),
      "GET /v1/accounts": () => json(ACCOUNTS),
      "GET /v1/groups": () => json([]),
      "GET /v1/users": () => json([]),
      // No contracts:view, so the directory is never asked for. The position
      // route, which the rail beside this panel reads, names the contract.
      [`GET /v1/accounts/${ACCOUNT_ID}/contracts/${CONTRACT_ID}/position`]: () =>
        json(
          aPosition({
            contract: { id: CONTRACT_ID, key: "CT10001", name: "Managed services retainer", model: "retainer" },
          }),
        ),
    });
    const ticket = aTicketView();
    const { container } = renderDesk(<PropertiesPanel ticket={ticket} />);
    await waitFor(() =>
      expect(container.querySelector('[data-field="contract_id"]')).toHaveTextContent(
        "CT10001 Managed services retainer",
      ),
    );
    // Not one row anywhere carries a raw identifier.
    expect(container.textContent).not.toContain(ticket.contract_id);
    expect(container.textContent).not.toContain(ticket.account_id);
  });

  /** Render 02 draws the two axes of the matrix as one row, with a middot. */
  it("draws impact and urgency as one row, each still its own control", async () => {
    stub(["tickets:view", "tickets:work"]);
    const { container } = renderDesk(<PropertiesPanel ticket={aTicketView({ impact: "high", urgency: "medium" })} />);
    const row = container.querySelector('[data-field="impact"]');
    expect(row).not.toBeNull();
    expect(row).toHaveTextContent("Impact / urgency");
    expect(row?.textContent).toContain("·");
    // Both values are in that one row, and neither has a row of its own.
    expect(container.querySelectorAll('[data-field="urgency"]')).toHaveLength(1);
    expect(row?.querySelector('[data-field="urgency"]')).not.toBeNull();
  });

  it("says so when the priority was overridden by hand", async () => {
    stub(["tickets:view", "tickets:override-priority"]);
    const { container } = renderDesk(<PropertiesPanel ticket={aTicketView({ priority_overridden: true })} />);
    await waitFor(() =>
      expect(container.querySelector('[data-field="priority"]')).toHaveTextContent("· overridden by hand"),
    );
  });

  it("shows the account in full and the requester by name, with no second Assigned to row", async () => {
    stub(["tickets:view"]);
    const { container } = renderDesk(<PropertiesPanel ticket={aTicketView()} />);
    await waitFor(() =>
      expect(container.querySelector('[data-field="account"] [data-readonly-value]')).toHaveTextContent(
        "AUS · Austral Mining Corporation",
      ),
    );
    expect(container.querySelector('[data-field="requester"] [data-readonly-value]')).toHaveTextContent(
      // The prototype's row is the person's name on one line; the address is
      // on the composer footer, which names who a public reply reaches.
      "Pat Client",
    );
    // One control for one concept: the picker names the assignee itself.
    expect(screen.queryByText("Assigned to")).toBeNull();
    // The row reads as the assignee's name until it is clicked.
    expect(screen.getByRole("button", { name: "Assignee" })).toHaveTextContent("Ben Okafor");
    await openRow("Assignee");
    // The seeded reader is the assignee here, so the control marks it "(you)".
    expect(screen.getByRole("combobox", { name: "Assignee" })).toHaveAttribute(
      "data-current-assignee",
      "Ben Okafor (you)",
    );
  });
});

/**
 * Review finding 21, then the v3 fidelity pass: the render (02 to 07) ends the
 * six shared tabs with Sync, which the built record had demoted to a rail card.
 * Email follows the six because the built record carries an email surface the
 * prototype does not, and dropping the tab would drop the surface.
 */
describe("the work area tabs", () => {
  it("follows the render order, with Email after the six it shares", () => {
    expect(WORK_AREA_TABS.map((tab) => tab.label)).toEqual([
      "Conversation",
      "Activity",
      "Time",
      "Resolution",
      "Links",
      "Sync",
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
    await openRow("Group");
    await screen.findByRole("option", { name: "Application support" });
    fireEvent.change(screen.getByLabelText("Group"), { target: { value: GROUP_ID } });
    await waitFor(() => expect(calls.some((call) => call.key.startsWith("PATCH "))).toBe(true));
    expect(calls.find((call) => call.key.startsWith("PATCH "))?.body).toEqual({ version: 3, group_id: GROUP_ID });
  });

  it("leaves a retired group off the picker, since the API refuses work queued to one", async () => {
    stubGroups(["tickets:view", "tickets:work"]);
    renderDesk(<PropertiesPanel ticket={aTicketView()} />);
    await openRow("Group");
    await screen.findByRole("option", { name: "Application support" });
    expect(screen.queryByRole("option", { name: /Legacy team/ })).toBeNull();
  });

  it("still shows a retired group that is the one in force", async () => {
    stubGroups(["tickets:view", "tickets:work"]);
    renderDesk(<PropertiesPanel ticket={aTicketView({ group_id: "g-old" })} />);
    await openRow("Group");
    expect(await screen.findByRole("option", { name: "Legacy team (retired)" })).toBeTruthy();
  });

  it("words the refusal when the group has been retired underneath the desk", async () => {
    stubGroups(["tickets:view", "tickets:work"], () => json({ code: "group_retired" }, 400));
    renderDesk(<PropertiesPanel ticket={aTicketView()} />);
    await openRow("Group");
    await screen.findByRole("option", { name: "Application support" });
    fireEvent.change(screen.getByLabelText("Group"), { target: { value: GROUP_ID } });
    await screen.findByText(/has been retired/);
  });
});
