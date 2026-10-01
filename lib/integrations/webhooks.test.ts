import { describe, expect, it } from "vitest";
import { eligibleClients, eventsLabel, lastErrorLine, pausedLine } from "@/lib/integrations/webhooks";
import { anApiClient, FINANCE_ACCOUNT_ID, OTHER_ACCOUNT_ID } from "@/test-kit/integrations";
import type { WebhookSubscription } from "@/redux/webhooksApi";

const paused = (overrides: Partial<WebhookSubscription>): WebhookSubscription => ({
  id: "sub-1",
  account_id: FINANCE_ACCOUNT_ID,
  api_client_id: "client-1",
  endpoint_url: "https://hooks.example.test/xms",
  event_types: ["ticket.created"],
  secret_kid: "kid-1",
  status: "paused",
  paused_reason: null,
  paused_note: null,
  consecutive_failures: 0,
  created_at: "2026-09-01T09:00:00Z",
  version: 1,
  client: { id: "client-1", name: "Finance loader", status: "active" },
  ...overrides,
});

describe("pausedLine", () => {
  it("says nothing for an endpoint XMS is still sending to", () => {
    expect(pausedLine(paused({ status: "active", paused_reason: "manual" }))).toBe("");
  });

  it("words each reason the worker records, and a person's own note before any of them", () => {
    expect(pausedLine(paused({ paused_reason: "consecutive_failures", consecutive_failures: 5 }))).toBe(
      "Paused by XMS after 5 deliveries in a row failed.",
    );
    expect(pausedLine(paused({ paused_reason: "endpoint_gone" }))).toBe(
      "Paused by XMS: the endpoint stopped answering at all.",
    );
    expect(pausedLine(paused({ paused_reason: "manual" }))).toBe("Paused by hand.");
    expect(pausedLine(paused({ paused_reason: "manual", paused_note: "Client migrating" }))).toBe("Client migrating");
  });

  it("repeats a reason it has no words for, and says only that it is paused where there is none", () => {
    expect(pausedLine(paused({ paused_reason: "quota" }))).toBe("Paused: quota.");
    expect(pausedLine(paused({}))).toBe("Paused.");
  });
});

describe("eventsLabel", () => {
  it("counts the events and names them", () => {
    expect(eventsLabel(["ticket.created"])).toBe("1 event: ticket.created");
    expect(eventsLabel(["ticket.created", "ticket.resolved"])).toBe("2 events: ticket.created, ticket.resolved");
  });
});

describe("eligibleClients", () => {
  it("keeps the active clients granted the account", () => {
    const granted = anApiClient();
    const clients = [
      granted,
      anApiClient({ id: "client-revoked", status: "revoked" }),
      anApiClient({ id: "client-other", account_ids: [OTHER_ACCOUNT_ID] }),
    ];
    expect(eligibleClients(clients, FINANCE_ACCOUNT_ID)).toEqual([granted]);
  });
});

describe("lastErrorLine", () => {
  it("leads with the HTTP status where the endpoint answered", () => {
    expect(lastErrorLine({ response_status: 500, error: "upstream timeout" })).toBe("HTTP 500. upstream timeout");
  });

  it("says there was no response where nothing came back", () => {
    expect(lastErrorLine({ response_status: null, error: null })).toBe("No response.");
  });
});
