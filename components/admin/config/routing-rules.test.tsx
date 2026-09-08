import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RoutingRulesPanel } from "@/components/admin/config/routing-rules";
import { ACCOUNT_ID, aRoutingRule, GROUP_ID } from "@/redux/ticketsApi.test";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

const RULES = `GET /v1/accounts/${ACCOUNT_ID}/routing-rules`;
const SAVE = `PUT /v1/accounts/${ACCOUNT_ID}/routing-rules`;

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: [ACCOUNT_ID], permissions } });

const groups = () => json([{ id: GROUP_ID, name: "Application support", status: "active" }]);

/**
 * The account's routing defaults (TM-08). The API answers the read to
 * `tickets:view` and the write to `admin:config`, so the panel asks nothing
 * without the first and offers nothing without the second.
 */
describe("RoutingRulesPanel", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("asks nothing without tickets:view and says which permission is missing", async () => {
    const calls = stubFetch({ "GET /v1/admin/me": me(["admin:accounts", "admin:config"]) });
    renderDesk(<RoutingRulesPanel accountId={ACCOUNT_ID} />);
    await screen.findByText(/needs the tickets:view permission/);
    expect(calls.some((call) => call.key.includes("routing-rules"))).toBe(false);
  });

  it("shows the rules read only to a reader without admin:config", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["admin:accounts", "tickets:view"]),
      [RULES]: () => json([aRoutingRule({ category: "consolidation" })]),
      "GET /v1/groups": groups,
    });
    renderDesk(<RoutingRulesPanel accountId={ACCOUNT_ID} />);
    const category = (await screen.findByLabelText("Category of rule 1")) as HTMLInputElement;
    expect(category.value).toBe("consolidation");
    expect(category).toBeDisabled();
    expect(screen.queryByText("Save rules")).toBeNull();
    expect(screen.getByText(/needs the admin:config permission/)).toBeTruthy();
  });

  it("adds a rule, refuses one with no group, then saves the whole set in one PUT", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["admin:accounts", "admin:config", "tickets:view"]),
      [RULES]: () => json([aRoutingRule()]),
      "GET /v1/groups": groups,
      [SAVE]: () => json([aRoutingRule(), aRoutingRule({ id: "r-2", ticket_type: "change" })]),
    });
    renderDesk(<RoutingRulesPanel accountId={ACCOUNT_ID} />);
    await screen.findByLabelText("Category of rule 1");
    fireEvent.click(screen.getByText("Add rule"));
    // The new row names no group yet, so the set is refused before the API is asked.
    fireEvent.click(screen.getByText("Save rules"));
    await screen.findByText("Every rule has to name a group.");
    expect(calls.some((call) => call.key === SAVE)).toBe(false);

    fireEvent.change(screen.getByLabelText("Type of rule 2"), { target: { value: "change" } });
    fireEvent.change(screen.getByLabelText("Group of rule 2"), { target: { value: GROUP_ID } });
    fireEvent.click(screen.getByText("Save rules"));
    await waitFor(() => expect(calls.some((call) => call.key === SAVE)).toBe(true));
    expect(calls.find((call) => call.key === SAVE)?.body).toEqual({
      rules: [
        { ticket_type: "incident", category: null, group_id: GROUP_ID },
        { ticket_type: "change", category: null, group_id: GROUP_ID },
      ],
    });
  });

  it("refuses two rules covering the same type and category before the API is asked", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["admin:config", "tickets:view"]),
      [RULES]: () => json([aRoutingRule()]),
      "GET /v1/groups": groups,
      [SAVE]: () => json([]),
    });
    renderDesk(<RoutingRulesPanel accountId={ACCOUNT_ID} />);
    await screen.findByLabelText("Category of rule 1");
    fireEvent.click(screen.getByText("Add rule"));
    fireEvent.change(screen.getByLabelText("Group of rule 2"), { target: { value: GROUP_ID } });
    fireEvent.click(screen.getByText("Save rules"));
    await screen.findByText("Two rules cannot cover the same type and category.");
    expect(calls.some((call) => call.key === SAVE)).toBe(false);
  });
});
