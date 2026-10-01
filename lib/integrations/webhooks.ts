/**
 * An account's webhooks as the desk words them (INT-02): why XMS stopped
 * sending to an endpoint, what it listens for, which API clients may carry
 * one, and how a delivery XMS gave up on failed last.
 */
import type { ApiClient } from "@/redux/apiClientsApi";
import type { WebhookDelivery, WebhookSubscription } from "@/redux/webhooksApi";

/**
 * Why the worker stopped sending, in words rather than in its own
 * vocabulary. A subscription paused by a person carries their note instead.
 */
export function pausedLine(row: WebhookSubscription): string {
  if (row.status !== "paused") return "";
  if (row.paused_note) return row.paused_note;
  switch (row.paused_reason) {
    case "consecutive_failures":
      return `Paused by XMS after ${row.consecutive_failures} deliveries in a row failed.`;
    case "endpoint_gone":
      return "Paused by XMS: the endpoint stopped answering at all.";
    case "manual":
      return "Paused by hand.";
    default:
      return row.paused_reason ? `Paused: ${row.paused_reason}.` : "Paused.";
  }
}

export function eventsLabel(eventTypes: string[]): string {
  return `${eventTypes.length} ${eventTypes.length === 1 ? "event" : "events"}: ${eventTypes.join(", ")}`;
}

/** Only the active clients granted this account can carry one of its endpoints. */
export function eligibleClients(clients: ApiClient[], accountId: string): ApiClient[] {
  return clients.filter((client) => client.account_ids.includes(accountId) && client.status === "active");
}

export function lastErrorLine(row: Pick<WebhookDelivery, "response_status" | "error">): string {
  const error = row.error ?? "No response.";
  return row.response_status ? `HTTP ${row.response_status}. ${error}` : error;
}
