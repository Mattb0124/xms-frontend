import { screen, waitFor } from "@testing-library/react";
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
