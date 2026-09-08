import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientsView } from "@/components/admin/api-clients/api-clients-view";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";
import { anApiClient, API_CLIENT_ID, FINANCE_ACCOUNT_ID, OTHER_ACCOUNT_ID, someScopes } from "@/test-kit/integrations";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/api-clients" }));

const CLIENTS = "GET /v1/admin/api-clients";
const SCOPES = "GET /v1/admin/api-clients/scopes";
const CREATE = "POST /v1/admin/api-clients";
const REVOKE = `POST /v1/admin/api-clients/${API_CLIENT_ID}/revoke`;
const ACCOUNTS = "GET /v1/admin/accounts";

const me = (permissions: string[]) => () =>
  json({
    principal: {
      kind: "internal",
      userId: "u1",
      accountIds: [FINANCE_ACCOUNT_ID, OTHER_ACCOUNT_ID],
      permissions,
    },
  });

const directory = {
  [ACCOUNTS]: () =>
    json([
      { id: FINANCE_ACCOUNT_ID, key: "ACME", name: "Acme Group" },
      { id: OTHER_ACCOUNT_ID, key: "BETA", name: "Beta Foods" },
    ]),
};

describe("ApiClientsView", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fails closed without admin:api-clients and never reads the clients", async () => {
    const calls = stubFetch({ "GET /v1/admin/me": me(["admin:accounts", "tickets:view"]) });
    renderDesk(<ApiClientsView />);
    await screen.findByText(/API clients need the admin:api-clients permission/);
    expect(calls.some((call) => call.key === CLIENTS || call.key === SCOPES)).toBe(false);
  });

  it("lists the clients with prefix, scope chips, account count, rate limit, last used and status", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["admin:api-clients"]),
      [CLIENTS]: () =>
        json([
          anApiClient(),
          anApiClient({
            id: "c-2",
            name: "Old loader",
            key_prefix: "axk_live_b2xkbG9h",
            scopes: ["kb:read"],
            account_ids: [FINANCE_ACCOUNT_ID, OTHER_ACCOUNT_ID],
            last_used_at: null,
            expires_at: "2026-12-31T00:00:00Z",
            status: "revoked",
            rate_limit_per_minute: 12_000,
          }),
        ]),
      [SCOPES]: () => json(someScopes()),
    });
    renderDesk(<ApiClientsView />);
    const table = await screen.findByRole("table", { name: "API clients" });
    const active = within(table).getByRole("row", { name: /Finance loader/ });
    expect(active).toHaveTextContent("axk_live_Zm9vYmFy");
    expect(within(active).getByText("tickets:view")).toBeInTheDocument();
    expect(within(active).getByText("exports:read")).toBeInTheDocument();
    expect(active.querySelector("[data-accounts]")).toHaveTextContent("1 account");
    expect(active).toHaveTextContent("2026-09-06 07:15");
    expect(active).toHaveTextContent("No expiry");
    expect(active.querySelector("[data-rate-limit]")).toHaveTextContent("600 / min");
    expect(within(active).getByText("Active")).toHaveAttribute("data-state", "ready");
    expect(within(active).getByRole("button", { name: "Revoke" })).toBeInTheDocument();

    const revoked = within(table).getByRole("row", { name: /Old loader/ });
    expect(revoked).toHaveTextContent("Never used");
    expect(revoked).toHaveTextContent("Expires 2026-12-31");
    // A raised limit reads with its thousands separator, not as bare digits.
    expect(revoked.querySelector("[data-rate-limit]")).toHaveTextContent("12,000 / min");
    expect(revoked.querySelector("[data-accounts]")).toHaveTextContent("2 accounts");
    expect(within(revoked).getByText("Revoked", { selector: ".aix-state-pill" })).toHaveAttribute(
      "data-state",
      "blocked",
    );
    expect(within(revoked).queryByRole("button", { name: "Revoke" })).not.toBeInTheDocument();
  });

  it("says that webhook subscriptions are registered by the client with its key", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["admin:api-clients"]),
      [CLIENTS]: () => json([]),
      [SCOPES]: () => json(someScopes()),
    });
    renderDesk(<ApiClientsView />);
    expect(await screen.findByText(/registers its own endpoints through the API with its key/)).toBeInTheDocument();
    expect(await screen.findByText("No API client issued yet.")).toBeInTheDocument();
  });

  it("creates a client with the body the API takes and shows the key once, absent from the list", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["admin:api-clients", "admin:accounts"]),
      [CLIENTS]: () => json([anApiClient({ name: "Finance loader" })]),
      [SCOPES]: () => json(someScopes()),
      [CREATE]: () =>
        json({ ...anApiClient({ id: "c-new", name: "Ledger reader" }), key: "axk_live_only-once-abc" }, 201),
      ...directory,
    });
    renderDesk(<ApiClientsView />);
    fireEvent.click(await screen.findByRole("button", { name: "New client" }));
    const form = await screen.findByRole("form", { name: "New API client" });

    // The form refuses before the API does, and says what is missing.
    fireEvent.click(within(form).getByRole("button", { name: "Create client" }));
    expect(await within(form).findByText("Give the client a name.")).toBeInTheDocument();
    expect(calls.some((call) => call.key === CREATE)).toBe(false);

    fireEvent.change(within(form).getByLabelText("Name"), { target: { value: "Ledger reader" } });
    // Scopes come from the server's catalog with their descriptions.
    expect(within(form).getByText("Read published articles")).toBeInTheDocument();
    fireEvent.click(within(form).getByRole("checkbox", { name: /tickets:view/ }));
    fireEvent.click(within(form).getByRole("checkbox", { name: /exports:read/ }));
    // Accounts are the granted ones, named from the directory.
    fireEvent.click(within(form).getByRole("checkbox", { name: "Acme Group" }));
    fireEvent.change(within(form).getByLabelText("Expires"), { target: { value: "2027-01-31" } });

    // The rate limit opens on the API's own default and is refused before the
    // API when it is not a whole number in range.
    const rate = within(form).getByLabelText("Rate limit (requests a minute)");
    expect(rate).toHaveValue("600");
    fireEvent.change(rate, { target: { value: "0" } });
    fireEvent.click(within(form).getByRole("button", { name: "Create client" }));
    expect(await within(form).findByText(/between 1 and 100,000 requests a minute/)).toBeInTheDocument();
    expect(calls.some((call) => call.key === CREATE)).toBe(false);
    fireEvent.change(rate, { target: { value: "1200" } });
    fireEvent.click(within(form).getByRole("button", { name: "Create client" }));

    await waitFor(() =>
      expect(calls.find((call) => call.key === CREATE)?.body).toEqual({
        name: "Ledger reader",
        scopes: ["tickets:view", "exports:read"],
        account_ids: [FINANCE_ACCOUNT_ID],
        expires_at: "2027-01-31",
        rate_limit_per_minute: 1200,
      }),
    );
    const once = await screen.findByTestId("new-api-key");
    expect(within(once).getByText("axk_live_only-once-abc")).toBeInTheDocument();
    expect(once).toHaveTextContent("It will not be shown again");
    // The key lives only in the panel: the list keeps the prefix alone.
    const table = screen.getByRole("table", { name: "API clients" });
    expect(within(table).queryByText("axk_live_only-once-abc")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "I have stored it" }));
    await waitFor(() => expect(screen.queryByTestId("new-api-key")).not.toBeInTheDocument());
  });

  it("revokes a client behind a confirm and shows it revoked", async () => {
    let revoked = false;
    const calls = stubFetch({
      "GET /v1/admin/me": me(["admin:api-clients"]),
      [CLIENTS]: () => json([anApiClient({ status: revoked ? "revoked" : "active" })]),
      [SCOPES]: () => json(someScopes()),
      [REVOKE]: () => {
        revoked = true;
        return json({ id: API_CLIENT_ID, status: "revoked" }, 201);
      },
    });
    renderDesk(<ApiClientsView />);
    const table = await screen.findByRole("table", { name: "API clients" });
    const row = within(table).getByRole("row", { name: /Finance loader/ });
    // The first click only arms the confirm; nothing reaches the API yet.
    fireEvent.click(within(row).getByRole("button", { name: "Revoke" }));
    expect(calls.some((call) => call.key === REVOKE)).toBe(false);
    fireEvent.click(within(row).getByRole("button", { name: "Confirm revoke" }));
    await screen.findByText("Client revoked");
    await waitFor(() =>
      expect(screen.getByRole("table", { name: "API clients" }).querySelector("[data-client]")).toHaveAttribute(
        "data-status",
        "revoked",
      ),
    );
  });

  it("words already_revoked when the server revoked the client first", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["admin:api-clients"]),
      [CLIENTS]: () => json([anApiClient()]),
      [SCOPES]: () => json(someScopes()),
      [REVOKE]: () => json({ code: "already_revoked" }, 409),
    });
    renderDesk(<ApiClientsView />);
    const table = await screen.findByRole("table", { name: "API clients" });
    const row = within(table).getByRole("row", { name: /Finance loader/ });
    fireEvent.click(within(row).getByRole("button", { name: "Revoke" }));
    fireEvent.click(within(row).getByRole("button", { name: "Confirm revoke" }));
    await screen.findByText("Not revoked");
    expect(screen.getByText("This client was already revoked. The list has been reloaded.")).toBeInTheDocument();
  });
});
