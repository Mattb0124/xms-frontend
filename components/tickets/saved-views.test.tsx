import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { savedViewLabel, SavedViewsBar } from "@/components/tickets/saved-views";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";
import { aSavedView, SAVED_VIEW_ID, VIEW_ACCOUNT_ID, VIEW_OWNER_ID } from "@/test-kit/views";
import type { GrantedAccount } from "@/redux/ticketsApi";

vi.mock("next/navigation", () => ({ usePathname: () => "/tickets" }));

const me = (userId = VIEW_OWNER_ID) => ({
  principal: { kind: "internal", userId, accountIds: [VIEW_ACCOUNT_ID], permissions: ["tickets:view"] },
});

const accounts: GrantedAccount[] = [
  { id: VIEW_ACCOUNT_ID, key: "BRK", name: "Brookfield", status: "active", owner_id: null, owner_name: "Erin Walsh" },
  {
    id: "22222222-2222-4222-8222-222222222222",
    key: "NWH",
    name: "Northwind Health",
    status: "active",
    owner_id: null,
    owner_name: null,
  },
];

const bar = (overrides: Partial<Parameters<typeof SavedViewsBar>[0]> = {}) => (
  <SavedViewsBar
    params={{ open: true, priority: ["p1"], account_id: [VIEW_ACCOUNT_ID] }}
    accounts={accounts}
    current={null}
    available
    starred={false}
    onToggleStar={() => {}}
    onSaved={() => {}}
    onDeleted={() => {}}
    {...overrides}
  />
);

describe("savedViewLabel", () => {
  it("names a shared view as shared and leaves a private one plain", () => {
    expect(savedViewLabel(aSavedView())).toBe("Brookfield P1s");
    expect(savedViewLabel(aSavedView({ share: "account" }))).toBe("Brookfield P1s (everyone on the account)");
  });
});

describe("SavedViewsBar", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("saves the current chips as a view, filed under the account chip", async () => {
    const onSaved = vi.fn();
    const calls = stubFetch({
      "GET /v1/admin/me": () => json(me()),
      "POST /v1/views": (body) => json(aSavedView({ name: JSON.parse(body ?? "{}").name as string }), 201),
    });
    renderDesk(bar({ onSaved }));

    fireEvent.click(screen.getByRole("button", { name: "Save as view" }));
    // The account chip decides the account, so nothing is guessed for the reader.
    expect(screen.getByLabelText("Account")).toHaveValue(VIEW_ACCOUNT_ID);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "My P1s" } });
    fireEvent.change(screen.getByLabelText("Shared with"), { target: { value: "account" } });
    fireEvent.click(screen.getByRole("button", { name: "Save view" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const posted = calls.find((call) => call.key === "POST /v1/views")!.body as {
      account_id: string;
      name: string;
      share: string;
      definition: { conditions: { conditions: unknown[] } };
    };
    expect(posted).toMatchObject({ account_id: VIEW_ACCOUNT_ID, name: "My P1s", share: "account" });
    expect(posted.definition.conditions.conditions).toEqual([
      { field: "state", op: "not_in", value: ["closed", "cancelled"] },
      { field: "priority", op: "in", value: ["p1"] },
      { field: "account_id", op: "in", value: [VIEW_ACCOUNT_ID] },
    ]);
  });

  it("refuses a nameless view before the API is asked", async () => {
    const calls = stubFetch({ "GET /v1/admin/me": () => json(me()) });
    renderDesk(bar({ params: { open: true } }));

    fireEvent.click(screen.getByRole("button", { name: "Save as view" }));
    fireEvent.click(screen.getByRole("button", { name: "Save view" }));

    await waitFor(() => expect(screen.getByText("A saved view needs a name.")).toBeInTheDocument());
    // Two accounts and no account chip: the picker asks rather than guessing.
    expect(screen.getByText("A saved view is filed under one account. Choose one.")).toBeInTheDocument();
    expect(calls.some((call) => call.key === "POST /v1/views")).toBe(false);
  });

  it("renames and deletes the view being shown, for its owner", async () => {
    const onDeleted = vi.fn();
    const view = aSavedView();
    const calls = stubFetch({
      "GET /v1/admin/me": () => json(me()),
      "GET /v1/views": () => json([view]),
      [`PATCH /v1/views/${SAVED_VIEW_ID}`]: () => json({ ...view, name: "Brookfield escalations", version: 2 }),
      [`DELETE /v1/views/${SAVED_VIEW_ID}`]: () => new Response(null, { status: 204 }),
    });
    renderDesk(bar({ current: view, onDeleted }));

    // Ownership is decided from the principal the API returned, so nothing is
    // offered until it has arrived.
    await waitFor(() => expect(screen.getByRole("button", { name: "Rename" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    fireEvent.change(screen.getByLabelText("New name"), { target: { value: "Brookfield escalations" } });
    fireEvent.submit(screen.getByLabelText("New name").closest("form")!);
    await waitFor(() => expect(calls.some((call) => call.key.startsWith("PATCH"))).toBe(true));
    expect(calls.find((call) => call.key.startsWith("PATCH"))!.body).toEqual({
      version: 1,
      name: "Brookfield escalations",
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(calls.some((call) => call.key.startsWith("DELETE"))).toBe(true);
  });

  it("leaves someone else's shared view read only and says why", async () => {
    stubFetch({ "GET /v1/admin/me": () => json(me("user-quinn")) });
    renderDesk(bar({ current: aSavedView({ share: "account" }) }));

    await waitFor(() => expect(screen.getByText(/Saved by someone else/)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Rename" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("says what the API refused and keeps the form open", async () => {
    stubFetch({
      "GET /v1/admin/me": () => json(me()),
      "POST /v1/views": () => json({ code: "invalid_conditions", details: ["condition 0: value required"] }, 400),
    });
    renderDesk(bar());

    fireEvent.click(screen.getByRole("button", { name: "Save as view" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Bad" } });
    fireEvent.click(screen.getByRole("button", { name: "Save view" }));

    await waitFor(() => expect(screen.getByText(/condition 0: value required/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Save view" })).toBeInTheDocument();
  });

  it("falls back to the per-browser star while the route is not deployed", async () => {
    const onToggleStar = vi.fn();
    stubFetch({ "GET /v1/admin/me": () => json(me()) });
    renderDesk(bar({ available: false, onToggleStar }));

    fireEvent.click(screen.getByRole("button", { name: "Star this list" }));
    expect(onToggleStar).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Save as view" })).not.toBeInTheDocument();
    expect(screen.getByText(/kept in this browser/)).toBeInTheDocument();
  });
});

/**
 * Sharing a view with a group (TM-08). The API takes `share_ref` on a group
 * share alone and refuses one without it, and the server now resolves a
 * member's groups when it lists views, so the mode is worth offering.
 */
describe("SavedViewsBar group sharing", () => {
  afterEach(() => vi.unstubAllGlobals());

  const GROUP_ID = "99999999-9999-4999-8999-999999999999";
  const groups = () => json([{ id: GROUP_ID, name: "Application support", status: "active" }]);

  it("refuses a group share that names no group before the API is asked", async () => {
    const calls = stubFetch({ "GET /v1/admin/me": () => json(me()), "GET /v1/groups": groups });
    renderDesk(bar());
    fireEvent.click(screen.getByRole("button", { name: "Save as view" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "My group's P1s" } });
    fireEvent.change(screen.getByLabelText("Shared with"), { target: { value: "group" } });
    // The picker appears with the mode, and nothing is chosen in it yet.
    await screen.findByLabelText("Group");
    fireEvent.click(screen.getByRole("button", { name: "Save view" }));
    await screen.findByText("A view shared with a group has to name the group.");
    expect(calls.some((call) => call.key === "POST /v1/views")).toBe(false);
  });

  it("sends the chosen group as share_ref", async () => {
    const onSaved = vi.fn();
    const calls = stubFetch({
      "GET /v1/admin/me": () => json(me()),
      "GET /v1/groups": groups,
      "POST /v1/views": () => json(aSavedView({ share: "group", share_ref: GROUP_ID }), 201),
    });
    renderDesk(bar({ onSaved }));
    fireEvent.click(screen.getByRole("button", { name: "Save as view" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Team P1s" } });
    fireEvent.change(screen.getByLabelText("Shared with"), { target: { value: "group" } });
    // The picker offers a group only once the directory has answered.
    await screen.findByRole("option", { name: "Application support" });
    fireEvent.change(screen.getByLabelText("Group"), { target: { value: GROUP_ID } });
    fireEvent.click(screen.getByRole("button", { name: "Save view" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(calls.find((call) => call.key === "POST /v1/views")?.body).toMatchObject({
      share: "group",
      share_ref: GROUP_ID,
    });
  });

  it("names the group a shared view is for, and clears the reference on a move away", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": () => json(me()),
      "GET /v1/groups": groups,
      [`PATCH /v1/views/${SAVED_VIEW_ID}`]: () => json(aSavedView({ share: "private", share_ref: null, version: 2 })),
    });
    renderDesk(bar({ current: aSavedView({ share: "group", share_ref: GROUP_ID }) }));
    // The line names the group rather than the mode, once the directory answers.
    await screen.findByText(/shared with Application support/);
    fireEvent.change(screen.getByLabelText("Sharing"), { target: { value: "private" } });
    await waitFor(() => expect(calls.some((call) => call.key.startsWith("PATCH "))).toBe(true));
    expect(calls.find((call) => call.key.startsWith("PATCH "))?.body).toMatchObject({
      share: "private",
      share_ref: null,
    });
  });
});
