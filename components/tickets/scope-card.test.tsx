import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScopeCard } from "@/components/tickets/scope-card";
import { anApprovedScope, aFlaggedScope, aScope, aTicketView, APPROVER_ID, FLAGGER_ID } from "@/redux/ticketsApi.test";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({ usePathname: () => "/tickets/CS1000199" }));

const FLAG = "POST /v1/tickets/CS1000199/scope";
const DECISION = "POST /v1/tickets/CS1000199/scope/decision";

const me =
  (permissions: string[], userId = APPROVER_ID) =>
  () =>
    json({ principal: { kind: "internal", userId, accountIds: [], permissions } });

/**
 * The Scope card (TM-11, Ticket Management functional 5.1 and technical
 * 3.3): the flag and its decision on the record, the two actions split
 * across two permissions, and every refusal the API answers with in words.
 */
describe("ScopeCard", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("offers nothing to a reader who holds neither permission, and says so", async () => {
    stubFetch({ "GET /v1/admin/me": me(["tickets:view"]) });
    renderDesk(<ScopeCard ticket={aTicketView({ scope: aFlaggedScope() })} />);
    await screen.findByText("Flagging and deciding scope are not yours to do on this ticket.");
    expect(screen.queryByRole("button", { name: "Flag out of scope" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    // The state itself is still readable: the flag is on the record.
    expect(screen.getByText("Flagged out of scope")).toBeInTheDocument();
  });

  it("shows the flag, who raised it and why, and the decision with its allowance", async () => {
    stubFetch({ "GET /v1/admin/me": me(["tickets:view"]) });
    renderDesk(<ScopeCard ticket={aTicketView({ scope: anApprovedScope() })} />);
    const card = await screen.findByRole("region", { name: "Scope" });
    expect(within(card).getByText("Approved out of scope")).toHaveAttribute("data-state", "complete");
    expect(card).toHaveTextContent("A new hierarchy is a project, not support.");
    expect(card).toHaveTextContent("Cara Lee");
    expect(card).toHaveTextContent("Agreed with the client.");
    expect(card).toHaveTextContent("Dana Reid");
    expect(card).toHaveTextContent("8 h of extra budget (480 minutes)");
  });

  it("draws nothing at all when the API answered without a scope block", async () => {
    stubFetch({ "GET /v1/admin/me": me(["tickets:work"]) });
    const { container } = renderDesk(<ScopeCard ticket={aTicketView({ scope: undefined })} />);
    expect(container.querySelector('[data-testid="ticket-scope"]')).toBeNull();
  });

  it("raises a flag with its reason under tickets:work, and refuses a wordless one before the API", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["tickets:work"]),
      [FLAG]: () => json(aTicketView({ scope: aFlaggedScope(), version: 4 })),
    });
    renderDesk(<ScopeCard ticket={aTicketView({ scope: aScope(), version: 3 })} />);
    fireEvent.click(await screen.findByRole("button", { name: "Flag out of scope" }));
    fireEvent.click(screen.getByRole("button", { name: "Flag out of scope" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Say why this work is outside the contract");
    expect(calls.some((call) => call.key === FLAG)).toBe(false);

    fireEvent.change(screen.getByLabelText("Why is this work outside the contract?"), {
      target: { value: "  The migration is beyond the retainer.  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Flag out of scope" }));
    await waitFor(() => expect(calls.some((call) => call.key === FLAG)).toBe(true));
    expect(calls.find((call) => call.key === FLAG)?.body).toEqual({
      version: 3,
      out_of_scope: true,
      reason: "The migration is beyond the retainer.",
    });
  });

  it("withdraws a pending flag with the version alone", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["tickets:work"], FLAGGER_ID),
      [FLAG]: () => json(aTicketView({ scope: aScope(), version: 5 })),
    });
    renderDesk(<ScopeCard ticket={aTicketView({ scope: aFlaggedScope(), version: 4 })} />);
    fireEvent.click(await screen.findByRole("button", { name: "Withdraw flag" }));
    await waitFor(() => expect(calls.some((call) => call.key === FLAG)).toBe(true));
    expect(calls.find((call) => call.key === FLAG)?.body).toEqual({ version: 4, out_of_scope: false });
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("approves with an optional allowance and a note under tickets:approve-scope", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["tickets:approve-scope"]),
      [DECISION]: () => json(aTicketView({ scope: anApprovedScope(), version: 5 })),
    });
    renderDesk(<ScopeCard ticket={aTicketView({ scope: aFlaggedScope(), version: 4 })} />);
    await screen.findByTestId("scope-decision");
    fireEvent.change(screen.getByLabelText("Allowance in minutes (optional)"), { target: { value: "480" } });
    fireEvent.change(screen.getByLabelText("Note (required to decline)"), {
      target: { value: "Agreed with the client." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(calls.some((call) => call.key === DECISION)).toBe(true));
    expect(calls.find((call) => call.key === DECISION)?.body).toEqual({
      version: 4,
      decision: "approve",
      note: "Agreed with the client.",
      overage_allowance_minutes: 480,
    });
  });

  it("declines only with a note, and never sends an allowance with a decline", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["tickets:approve-scope"]),
      [DECISION]: () => json(aTicketView({ scope: aFlaggedScope({ out_of_scope: "declined" }) })),
    });
    renderDesk(<ScopeCard ticket={aTicketView({ scope: aFlaggedScope(), version: 4 })} />);
    await screen.findByTestId("scope-decision");
    fireEvent.change(screen.getByLabelText("Allowance in minutes (optional)"), { target: { value: "480" } });
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Say why the work is declined");
    expect(calls.some((call) => call.key === DECISION)).toBe(false);

    fireEvent.change(screen.getByLabelText("Note (required to decline)"), {
      target: { value: "The client has not funded this." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    await waitFor(() => expect(calls.some((call) => call.key === DECISION)).toBe(true));
    expect(calls.find((call) => call.key === DECISION)?.body).toEqual({
      version: 4,
      decision: "decline",
      note: "The client has not funded this.",
    });
  });

  it("hides the decision from the person who raised the flag, and says why", async () => {
    const calls = stubFetch({ "GET /v1/admin/me": me(["tickets:work", "tickets:approve-scope"], FLAGGER_ID) });
    renderDesk(<ScopeCard ticket={aTicketView({ scope: aFlaggedScope(), version: 4 })} />);
    await screen.findByText(/You raised this flag, so someone else decides it/);
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Decline" })).not.toBeInTheDocument();
    // They may still withdraw it: withdrawing is not deciding.
    expect(screen.getByRole("button", { name: "Withdraw flag" })).toBeInTheDocument();
    expect(calls.some((call) => call.key === DECISION)).toBe(false);
  });

  it("words each refusal the flag route answers with", async () => {
    const cases: [Record<string, unknown>, RegExp][] = [
      [{ code: "already_flagged" }, /already flagged out of scope/],
      [{ code: "ticket_closed" }, /closed or cancelled/],
      [{ code: "reason_required" }, /A flag says why/],
      [{ code: "stale_version" }, /Someone else changed this ticket/],
    ];
    for (const [body, expected] of cases) {
      stubFetch({ "GET /v1/admin/me": me(["tickets:work"]), [FLAG]: () => json(body, 409) });
      const view = renderDesk(<ScopeCard ticket={aTicketView({ scope: aScope(), version: 3 })} />);
      const card = within(view.container);
      fireEvent.click(await view.findByRole("button", { name: "Flag out of scope" }));
      fireEvent.change(card.getByLabelText("Why is this work outside the contract?"), {
        target: { value: "Beyond the retainer" },
      });
      fireEvent.click(card.getByRole("button", { name: "Flag out of scope" }));
      await waitFor(() => expect(card.getByRole("alert")).toHaveTextContent(expected));
      view.unmount();
      vi.unstubAllGlobals();
    }
  });

  it("words the refusals the decision route answers with", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["tickets:approve-scope"]),
      [DECISION]: () => json({ code: "no_contract_period", on: "2026-09-07" }, 409),
    });
    renderDesk(<ScopeCard ticket={aTicketView({ scope: aFlaggedScope(), version: 4 })} />);
    await screen.findByTestId("scope-decision");
    fireEvent.change(screen.getByLabelText("Allowance in minutes (optional)"), { target: { value: "480" } });
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("no period covering 2026-09-07");
  });

  it("words flagger_cannot_decide and not_flagged when the server refuses a decision anyway", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["tickets:approve-scope"]),
      [DECISION]: () => json({ code: "not_flagged" }, 409),
    });
    renderDesk(<ScopeCard ticket={aTicketView({ scope: aFlaggedScope(), version: 4 })} />);
    await screen.findByTestId("scope-decision");
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("There is no flag waiting for a decision");

    vi.unstubAllGlobals();
    stubFetch({
      "GET /v1/admin/me": me(["tickets:approve-scope"]),
      [DECISION]: () => json({ code: "flagger_cannot_decide" }, 409),
    });
    const second = renderDesk(<ScopeCard ticket={aTicketView({ scope: aFlaggedScope(), version: 4 })} />);
    await waitFor(() => expect(within(second.container).getByTestId("scope-decision")).toBeInTheDocument());
    fireEvent.click(within(second.container).getByRole("button", { name: "Approve" }));
    await waitFor(() =>
      expect(within(second.container).getByRole("alert")).toHaveTextContent(
        "You raised this flag, so someone else decides it.",
      ),
    );
  });
});
