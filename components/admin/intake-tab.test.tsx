import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AliasStatePill, IntakeTab } from "@/components/admin/intake-tab";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

const aliases = [
  {
    id: "a-1",
    address: "brk-support@mail.xms.local",
    kind: "canonical",
    default_ticket_type: null,
    state: "active",
    disabled_reason: null,
    disabled_at: null,
  },
  {
    id: "a-2",
    address: "help@brookfield.test",
    kind: "alias",
    default_ticket_type: "service_request",
    state: "disabled_by_loop_guard",
    disabled_reason: "3 suppressions in 10 minutes",
    disabled_at: "2026-09-07T09:00:00Z",
  },
];

describe("IntakeTab", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders the alias state pills with the loop guard reason", () => {
    renderDesk(
      <>
        <AliasStatePill state="active" />
        <AliasStatePill state="disabled_by_admin" />
        <AliasStatePill state="disabled_by_loop_guard" reason="3 suppressions in 10 minutes" />
      </>,
    );
    expect(screen.getByText("Active")).toHaveAttribute("data-state", "resolved");
    expect(screen.getByText("Disabled by admin")).toHaveAttribute("data-state", "closed");
    expect(screen.getByText("Disabled by loop guard: 3 suppressions in 10 minutes")).toHaveAttribute(
      "data-alias-state",
      "disabled_by_loop_guard",
    );
  });

  it("lists the aliases, adds one with the lowercased address and the chosen type, and disables with a confirm", async () => {
    const calls = stubFetch({
      "GET /v1/admin/accounts/acct-1/aliases": () => json(aliases),
      "POST /v1/admin/accounts/acct-1/aliases": () =>
        json({ ...aliases[0], id: "a-3", address: "new@brookfield.test", kind: "alias" }, 201),
      "POST /v1/admin/aliases/a-1/disable": () => json({ ...aliases[0], state: "disabled_by_admin" }, 201),
    });
    renderDesk(<IntakeTab accountId="acct-1" />);
    await screen.findByText("brk-support@mail.xms.local");
    expect(screen.getByText("defaults to service request")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Address"), { target: { value: "New@Brookfield.test" } });
    fireEvent.change(screen.getByLabelText("Default type"), { target: { value: "incident" } });
    fireEvent.click(screen.getByRole("button", { name: "Add alias" }));
    await waitFor(() =>
      expect(calls.find((call) => call.key === "POST /v1/admin/accounts/acct-1/aliases")?.body).toEqual({
        address: "new@brookfield.test",
        kind: "alias",
        default_ticket_type: "incident",
      }),
    );

    const disable = screen.getByRole("button", { name: "Disable" });
    fireEvent.click(disable);
    expect(screen.getByText("Click again to confirm")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm disable" }));
    await waitFor(() => expect(calls.some((call) => call.key === "POST /v1/admin/aliases/a-1/disable")).toBe(true));
  });
});
