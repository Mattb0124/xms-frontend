import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TicketPage from "@/app/(internal)/cases/[key]/page";
import { ACCOUNT_ID, aContract, aTicketView } from "@/test-kit/tickets";
import { json, renderDesk, stubFetch, type RecordedCall } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({
  useParams: () => ({ key: "CS1000199" }),
  usePathname: () => "/cases/CS1000199",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const CATALOGS = {
  resolution_codes: [{ key: "fixed", label: "Fixed", no_solution: false }],
  activity_types: [{ key: "analysis", label: "Analysis", billable_class: "billable" }],
  billable_classes: [{ key: "billable", label: "Billable", consumes_contract: true }],
};

function openRecord(): RecordedCall[] {
  const calls = stubFetch({
    "GET /v1/admin/me": () =>
      json({
        principal: {
          kind: "internal",
          userId: "u-ana",
          accountIds: [ACCOUNT_ID],
          permissions: ["tickets:view", "tickets:work"],
        },
      }),
    "GET /v1/tickets/CS1000199": () => json(aTicketView()),
    "GET /v1/accounts": () => json([{ id: ACCOUNT_ID, key: "AUS", name: "Austral Mining" }]),
    "GET /v1/groups": () => json([]),
    [`GET /v1/accounts/${ACCOUNT_ID}/contracts`]: () => json([aContract()]),
    "GET /v1/catalogs": () => json(CATALOGS),
    "GET /v1/tickets/CS1000199/comments": () => json([]),
    "GET /v1/tickets/CS1000199/transitions": () => json({ state: "in_progress", allowed: [] }),
    "GET /v1/tickets/CS1000199/time": () => json({ entries: [], total_minutes: 0 }),
    "GET /v1/tickets/CS1000199/participants": () => json({ participants: [], invitations: [] }),
    "GET /v1/users": () => json([]),
    "GET /v1/roster/people": () => json([]),
  });
  renderDesk(<TicketPage />);
  return calls;
}

const pathsOf = (calls: RecordedCall[], path: string) => calls.filter((call) => call.key === `GET ${path}`);

/**
 * Review finding 24: opening one ticket fired 18 API calls, including
 * /v1/catalogs twice (once bare, once with account_id) and full directory
 * loads of /v1/users and /v1/roster/people on every record open. Nothing was
 * slow; this is head-room, and it is cheap to keep.
 */
describe("the ticket record's call budget", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("asks for the catalogs once, and only once the account is known", async () => {
    const calls = openRecord();
    await screen.findByRole("region", { name: "Details" });
    await waitFor(() => expect(pathsOf(calls, "/v1/catalogs").length).toBeGreaterThan(0));
    const catalogs = pathsOf(calls, "/v1/catalogs");
    expect(catalogs).toHaveLength(1);
    // Never the bare call: the account travels with it.
    expect(catalogs[0].search).toContain(ACCOUNT_ID);
  });

  it("leaves the user directory and the roster alone until the assignee picker is focused", async () => {
    const calls = openRecord();
    // The picker stands in place on the form now, as ServiceNow draws
    // Assigned to, and it still asks for nothing until it is focused.
    const picker = await screen.findByRole("combobox", { name: "Assignee" });
    await waitFor(() => expect(pathsOf(calls, "/v1/accounts")).toHaveLength(1));
    expect(pathsOf(calls, "/v1/users")).toHaveLength(0);
    expect(pathsOf(calls, "/v1/roster/people")).toHaveLength(0);

    fireEvent.focus(picker);
    await waitFor(() => expect(pathsOf(calls, "/v1/users")).toHaveLength(1));
  });
});

/**
 * Matt's direction 2026-09-15: the record reads the way the ServiceNow case
 * form reads. The form, then the Notes card, then the Related lists card with
 * the SLAs open first.
 */
describe("the ticket record's layout", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("stacks the form, the notes and the related lists, with the SLAs open first", async () => {
    openRecord();
    const details = await screen.findByRole("region", { name: "Details" });
    const notes = screen.getByRole("region", { name: "Notes" });
    const related = screen.getByRole("region", { name: "Related lists" });
    // Document order is the order on the page.
    expect(details.compareDocumentPosition(notes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(notes.compareDocumentPosition(related) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("tab", { name: /^SLAs/ })).toHaveAttribute("aria-selected", "true");
    // The fixture ticket carries no clock, so the tab says so; a ticket with
    // clocks draws the table (sla-table.test.tsx).
    expect(
      screen.queryByRole("table", { name: "Service levels" }) ?? screen.getByText("No SLA on this ticket."),
    ).toBeInTheDocument();
    // The record bar carries Follow where ServiceNow puts it.
    expect(screen.getByRole("button", { name: /^(Follow|Unfollow)$/ })).toBeInTheDocument();
  });
});
