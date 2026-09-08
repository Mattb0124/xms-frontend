import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountContactsTab } from "@/components/admin/contacts-tab";
import { contactFlagsBody, contactLabel, flagLabel, flagsLine, flagsToOffer, toggleFlag } from "@/lib/admin/contacts";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";
import type { Contact } from "@/redux/adminApi";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/accounts/acct-1" }));

const CONTACTS = "GET /v1/admin/accounts/acct-1/contacts";
const SPONSOR_ID = "11111111-1111-4111-8111-111111111111";
const BILLING_ID = "22222222-2222-4222-8222-222222222222";

/** Constructed contacts: one bound to a portal user with no flags, one flagged. */
function aContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: SPONSOR_ID,
    account_id: "acct-1",
    email: "pat@client.test",
    display_name: "Pat Client",
    portal_user_id: "u-pat",
    status: "active",
    flags: [],
    created_at: "2026-04-01T09:00:00Z",
    updated_at: "2026-04-01T09:00:00Z",
    version: 2,
    ...overrides,
  };
}

function aFlaggedContact(overrides: Partial<Contact> = {}): Contact {
  return aContact({
    id: BILLING_ID,
    email: "finance@client.test",
    display_name: "Robin Ledger",
    portal_user_id: null,
    flags: ["billing_contact"],
    version: 5,
    ...overrides,
  });
}

describe("the contact flag vocabulary", () => {
  it("words each flag and says what it is for", () => {
    expect(flagLabel("executive_sponsor")).toBe("Executive sponsor");
    expect(flagLabel("billing_contact")).toBe("Billing contact");
    expect(flagLabel("csat_recipient")).toBe("CSAT recipient");
    // A flag a newer API adds is shown as it came, never as a blank.
    expect(flagLabel("renewal_approver")).toBe("renewal_approver");
    expect(flagsLine([])).toBe("No flags");
    expect(flagsLine(["executive_sponsor", "billing_contact"])).toBe("Executive sponsor, Billing contact");
  });

  it("offers the closed set, keeping any flag a row already carries", () => {
    expect(flagsToOffer([aContact()])).toEqual(["executive_sponsor", "billing_contact", "csat_recipient"]);
    expect(flagsToOffer([aContact({ flags: ["renewal_approver"] })])).toEqual([
      "executive_sponsor",
      "billing_contact",
      "csat_recipient",
      "renewal_approver",
    ]);
  });

  it("toggles one flag and sends the whole set with the version it was read at", () => {
    expect(toggleFlag(["billing_contact"], "executive_sponsor", true)).toEqual([
      "executive_sponsor",
      "billing_contact",
    ]);
    expect(toggleFlag(["executive_sponsor", "billing_contact"], "billing_contact", false)).toEqual([
      "executive_sponsor",
    ]);
    // Setting a flag already on is not a duplicate.
    expect(toggleFlag(["executive_sponsor"], "executive_sponsor", true)).toEqual(["executive_sponsor"]);
    expect(contactFlagsBody(5, ["executive_sponsor"])).toEqual({ version: 5, flags: ["executive_sponsor"] });
  });

  it("names a contact by name and address, or by address alone", () => {
    expect(contactLabel(aContact())).toBe("Pat Client <pat@client.test>");
    expect(contactLabel(aContact({ display_name: "" }))).toBe("pat@client.test");
  });
});

/**
 * The Contacts tab (Client Portal technical 2.1, functional 5.7). It lives
 * inside the account record's admin:accounts gate, the same permission the
 * API guards both routes with.
 */
describe("AccountContactsTab", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists the contacts with their flags and whether they hold a portal user", async () => {
    stubFetch({ [CONTACTS]: () => json([aContact(), aFlaggedContact()]) });
    renderDesk(<AccountContactsTab accountId="acct-1" />);
    const list = await screen.findByRole("list", { name: "Contacts" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Pat Client <pat@client.test>");
    expect(rows[0]).toHaveTextContent("Portal user");
    expect(rows[0]).toHaveTextContent("No flags");
    expect(rows[1]).toHaveTextContent("Robin Ledger <finance@client.test>");
    expect(rows[1]).toHaveTextContent("No portal user");
    expect(rows[1]).toHaveTextContent("Billing contact");
    expect(rows[1].getAttribute("data-contact")).toBe(BILLING_ID);
  });

  it("sets executive_sponsor as the whole set with the row's own version", async () => {
    let flagged = false;
    const calls = stubFetch({
      [CONTACTS]: () => json([flagged ? aContact({ flags: ["executive_sponsor"], version: 3 }) : aContact()]),
      [`PATCH /v1/admin/accounts/acct-1/contacts/${SPONSOR_ID}/flags`]: () => {
        flagged = true;
        return json(aContact({ flags: ["executive_sponsor"], version: 3 }));
      },
    });
    renderDesk(<AccountContactsTab accountId="acct-1" />);
    const group = await screen.findByRole("group", { name: "Flags for pat@client.test" });
    fireEvent.click(within(group).getByLabelText("Executive sponsor"));
    await waitFor(() =>
      expect(calls.some((call) => call.key.startsWith("PATCH /v1/admin/accounts/acct-1/contacts/"))).toBe(true),
    );
    expect(calls.find((call) => call.key.startsWith("PATCH"))?.body).toEqual({
      version: 2,
      flags: ["executive_sponsor"],
    });
    // The list is read again, so the row shows the flag it now carries.
    await waitFor(() => expect(screen.getByRole("list", { name: "Contacts" })).toHaveTextContent("Executive sponsor"));
  });

  it("removes a flag by sending the set without it", async () => {
    const calls = stubFetch({
      [CONTACTS]: () => json([aFlaggedContact({ flags: ["executive_sponsor", "billing_contact"] })]),
      [`PATCH /v1/admin/accounts/acct-1/contacts/${BILLING_ID}/flags`]: () =>
        json(aFlaggedContact({ flags: ["executive_sponsor"], version: 6 })),
    });
    renderDesk(<AccountContactsTab accountId="acct-1" />);
    const group = await screen.findByRole("group", { name: "Flags for finance@client.test" });
    expect(within(group).getByLabelText("Billing contact")).toBeChecked();
    fireEvent.click(within(group).getByLabelText("Billing contact"));
    await waitFor(() => expect(calls.some((call) => call.key.startsWith("PATCH"))).toBe(true));
    expect(calls.find((call) => call.key.startsWith("PATCH"))?.body).toEqual({
      version: 5,
      flags: ["executive_sponsor"],
    });
  });

  it("words a stale version and reads the list again", async () => {
    let reads = 0;
    const calls = stubFetch({
      [CONTACTS]: () => {
        reads += 1;
        return json([aContact()]);
      },
      [`PATCH /v1/admin/accounts/acct-1/contacts/${SPONSOR_ID}/flags`]: () =>
        json({ code: "stale_version", current: 4 }, 409),
    });
    renderDesk(<AccountContactsTab accountId="acct-1" />);
    const group = await screen.findByRole("group", { name: "Flags for pat@client.test" });
    fireEvent.click(within(group).getByLabelText("CSAT recipient"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Someone else changed this contact");
    await waitFor(() => expect(reads).toBeGreaterThan(1));
    expect(calls.filter((call) => call.key.startsWith("PATCH"))).toHaveLength(1);
  });

  it("sends the search to the API and words an empty result", async () => {
    const calls = stubFetch({ [CONTACTS]: () => json([]) });
    renderDesk(<AccountContactsTab accountId="acct-1" />);
    await screen.findByText("This account has no contacts yet.");
    fireEvent.change(screen.getByLabelText("Search contacts"), { target: { value: "  finance  " } });
    await waitFor(() => expect(calls.some((call) => call.search === "?q=finance")).toBe(true));
    expect(await screen.findByText("No contact matches that search.")).toBeInTheDocument();
  });
});
