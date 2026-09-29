import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClientsApi } from "@/redux/apiClientsApi";
import { makeStore } from "@/redux/store";
import { anApiClient, API_CLIENT_ID, FINANCE_ACCOUNT_ID, someScopes } from "@/test-kit/integrations";
import { json, stubFetch } from "@/test-kit/portal";

const LIST = "GET /v1/admin/api-clients";
const SCOPES = "GET /v1/admin/api-clients/scopes";
const CREATE = "POST /v1/admin/api-clients";
const REVOKE = `POST /v1/admin/api-clients/${API_CLIENT_ID}/revoke`;

describe("apiClientsApi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads the clients and the scope catalog from the admin routes", async () => {
    const calls = stubFetch({
      [LIST]: () => json([anApiClient()]),
      [SCOPES]: () => json(someScopes()),
    });
    const store = makeStore();
    const clients = await store.dispatch(apiClientsApi.endpoints.apiClients.initiate()).unwrap();
    const scopes = await store.dispatch(apiClientsApi.endpoints.apiClientScopes.initiate()).unwrap();
    expect(clients[0]).toMatchObject({ key_prefix: "axk_live_Zm9vYmFy", status: "active" });
    expect(clients[0].account_ids).toEqual([FINANCE_ACCOUNT_ID]);
    expect(scopes.map((scope) => scope.scope)).toContain("webhooks:manage");
    expect(calls.map((call) => call.key)).toEqual([LIST, SCOPES]);
  });

  it("creates a client with the body the API takes and returns the key once", async () => {
    const calls = stubFetch({
      [CREATE]: () => json({ ...anApiClient({ id: "new" }), key: "axk_live_secret-shown-once" }, 201),
    });
    const store = makeStore();
    const created = await store
      .dispatch(
        apiClientsApi.endpoints.createApiClient.initiate({
          name: "Finance loader",
          scopes: ["tickets:view", "exports:read"],
          account_ids: [FINANCE_ACCOUNT_ID],
          expires_at: "2027-01-01T00:00:00.000Z",
        }),
      )
      .unwrap();
    expect(created.key).toBe("axk_live_secret-shown-once");
    expect(calls[0].body).toEqual({
      name: "Finance loader",
      scopes: ["tickets:view", "exports:read"],
      account_ids: [FINANCE_ACCOUNT_ID],
      expires_at: "2027-01-01T00:00:00.000Z",
    });
  });

  it("revokes a client and reads the list again even when the API refuses", async () => {
    const calls = stubFetch({
      [LIST]: () => json([anApiClient({ status: "revoked" })]),
      [REVOKE]: () => json({ code: "already_revoked" }, 409),
    });
    const store = makeStore();
    await store.dispatch(apiClientsApi.endpoints.apiClients.initiate()).unwrap();
    const refused = await store.dispatch(apiClientsApi.endpoints.revokeApiClient.initiate(API_CLIENT_ID));
    expect("error" in refused && (refused.error as { data: { code: string } }).data.code).toBe("already_revoked");
    await vi.waitFor(() => expect(calls.filter((call) => call.key === LIST)).toHaveLength(2));
  });
});
