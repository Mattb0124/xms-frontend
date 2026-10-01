import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountWebhooksTab } from "@/components/admin/webhooks/webhooks-tab";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";
import { anApiClient, API_CLIENT_ID, FINANCE_ACCOUNT_ID, OTHER_ACCOUNT_ID } from "@/test-kit/integrations";
import type { WebhookDeadLetter, WebhookSubscription } from "@/redux/webhooksApi";

const ACCOUNT_ID = FINANCE_ACCOUNT_ID;
const BASE = `/v1/accounts/${ACCOUNT_ID}/webhooks`;

const aSubscription = (overrides: Partial<WebhookSubscription> = {}): WebhookSubscription => ({
  id: "sub-active",
  account_id: ACCOUNT_ID,
  api_client_id: API_CLIENT_ID,
  endpoint_url: "https://hooks.example.test/xms",
  event_types: ["ticket.created", "ticket.resolved"],
  secret_kid: "kid-1",
  status: "active",
  paused_reason: null,
  paused_note: null,
  consecutive_failures: 0,
  created_at: "2026-09-01T09:00:00Z",
  version: 1,
  client: { id: API_CLIENT_ID, name: "Finance loader", status: "active" },
  ...overrides,
});

const PAUSED = aSubscription({
  id: "sub-paused",
  endpoint_url: "https://hooks.example.test/paused",
  event_types: ["ticket.created"],
  status: "paused",
  paused_reason: "consecutive_failures",
  consecutive_failures: 5,
});

const aDeadLetter = (overrides: Partial<WebhookDeadLetter> = {}): WebhookDeadLetter => ({
  id: "delivery-dead",
  subscription_id: "sub-active",
  event_type: "ticket.resolved",
  attempt: 8,
  status: "dead_lettered",
  response_status: 500,
  duration_ms: 1200,
  error: "upstream timeout",
  next_attempt_at: null,
  created_at: "2026-09-02T10:00:00Z",
  endpoint_url: "https://hooks.example.test/xms",
  first_failed_at: "2026-09-02T09:00:00Z",
  ...overrides,
});

function routes(overrides: Record<string, (body?: string) => Response> = {}) {
  return stubFetch({
    [`GET ${BASE}`]: () => json([aSubscription(), PAUSED]),
    "GET /v1/admin/api-clients": () =>
      json([
        anApiClient(),
        anApiClient({ id: "client-revoked", name: "Old loader", status: "revoked" }),
        anApiClient({ id: "client-other", name: "Other account loader", account_ids: [OTHER_ACCOUNT_ID] }),
      ]),
    "GET /v1/webhooks/event-types": () => json(["ticket.created", "ticket.resolved"]),
    [`GET ${BASE}/dead-letters`]: () => json([]),
    ...overrides,
  });
}

async function rowOf(endpoint: string): Promise<HTMLElement> {
  const cell = await screen.findByText(endpoint);
  const row = cell.closest("tr");
  if (!row) throw new Error(`no row for ${endpoint}`);
  return row;
}

describe("AccountWebhooksTab", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists the endpoints with what they listen for and why one is paused", async () => {
    routes();
    renderDesk(<AccountWebhooksTab accountId={ACCOUNT_ID} />);
    const active = await rowOf("https://hooks.example.test/xms");
    expect(active).toHaveTextContent("2 events: ticket.created, ticket.resolved");
    expect(active).toHaveTextContent("Finance loader");
    const paused = await rowOf("https://hooks.example.test/paused");
    expect(paused).toHaveTextContent("1 event: ticket.created");
    expect(paused).toHaveTextContent("Paused by XMS after 5 deliveries in a row failed.");
    expect(within(paused).getByRole("button", { name: "Resume" })).toBeInTheDocument();
    expect(within(active).getByRole("button", { name: "Pause" })).toBeInTheDocument();
    expect(screen.queryByText("Dead letters")).not.toBeInTheDocument();
  });

  it("pauses with the administrator's reason and resumes, saying so each time", async () => {
    const calls = routes({
      [`POST ${BASE}/sub-active/pause`]: () => json(aSubscription({ status: "paused" })),
      [`POST ${BASE}/sub-paused/resume`]: () => json(aSubscription({ id: "sub-paused" })),
    });
    renderDesk(<AccountWebhooksTab accountId={ACCOUNT_ID} />);
    fireEvent.click(within(await rowOf("https://hooks.example.test/xms")).getByRole("button", { name: "Pause" }));
    await screen.findByText("Sending paused");
    expect(calls.find((call) => call.key === `POST ${BASE}/sub-active/pause`)?.body).toEqual({
      reason: "Paused by an administrator",
    });
    fireEvent.click(within(await rowOf("https://hooks.example.test/paused")).getByRole("button", { name: "Resume" }));
    await screen.findByText("Sending resumed");
    expect(calls.some((call) => call.key === `POST ${BASE}/sub-paused/resume`)).toBe(true);
  });

  it("shows a rotated secret once, until it is dismissed", async () => {
    routes({
      [`POST ${BASE}/sub-active/rotate-secret`]: () =>
        json({ id: "sub-active", secret_kid: "kid-2", secret: "whsec_rotated_once" }),
    });
    renderDesk(<AccountWebhooksTab accountId={ACCOUNT_ID} />);
    const row = await rowOf("https://hooks.example.test/xms");
    fireEvent.click(within(row).getByRole("button", { name: "Rotate secret" }));
    fireEvent.click(within(row).getByRole("button", { name: "Confirm rotate secret" }));
    expect(await screen.findByText("whsec_rotated_once")).toBeInTheDocument();
    expect(screen.getByText("The signing secret")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "I have copied it" }));
    await waitFor(() => expect(screen.queryByText("whsec_rotated_once")).not.toBeInTheDocument());
  });

  it("removes an endpoint, and words a refusal as a toast", async () => {
    const calls = routes({
      [`DELETE ${BASE}/sub-active`]: () => json({ code: "forbidden" }, 403),
    });
    renderDesk(<AccountWebhooksTab accountId={ACCOUNT_ID} />);
    const row = await rowOf("https://hooks.example.test/xms");
    fireEvent.click(within(row).getByRole("button", { name: "Remove" }));
    fireEvent.click(within(row).getByRole("button", { name: "Confirm remove" }));
    await screen.findByText("It was not removed");
    expect(calls.some((call) => call.key === `DELETE ${BASE}/sub-active`)).toBe(true);
  });

  it("registers an endpoint as one of the account's active clients and shows its secret", async () => {
    const calls = routes({
      [`POST ${BASE}`]: () =>
        json({ ...aSubscription({ id: "sub-new", endpoint_url: "https://new.example.test/x" }), secret: "whsec_new" }),
    });
    renderDesk(<AccountWebhooksTab accountId={ACCOUNT_ID} />);
    fireEvent.click(await screen.findByRole("button", { name: "Register an endpoint" }));
    const sendAs = screen.getByLabelText("Send as");
    expect(
      within(sendAs)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Choose a client", "Finance loader"]);
    fireEvent.change(sendAs, { target: { value: API_CLIENT_ID } });
    fireEvent.change(screen.getByLabelText("Endpoint"), { target: { value: " https://new.example.test/x " } });
    fireEvent.click(screen.getByRole("checkbox", { name: "ticket.resolved" }));
    fireEvent.click(screen.getByRole("button", { name: "Register" }));

    expect(await screen.findByText("whsec_new")).toBeInTheDocument();
    expect(calls.find((call) => call.key === `POST ${BASE}`)?.body).toEqual({
      api_client_id: API_CLIENT_ID,
      endpoint_url: "https://new.example.test/x",
      event_types: ["ticket.resolved"],
    });
    await waitFor(() => expect(screen.queryByLabelText("Send as")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Register an endpoint" })).toBeInTheDocument();
  });

  it("opens and hides one endpoint's deliveries", async () => {
    const calls = routes({
      [`GET ${BASE}/sub-active/deliveries`]: () => json([{ ...aDeadLetter(), status: "delivered" }]),
    });
    renderDesk(<AccountWebhooksTab accountId={ACCOUNT_ID} />);
    const row = await rowOf("https://hooks.example.test/xms");
    fireEvent.click(within(row).getByRole("button", { name: "Deliveries" }));
    expect(await screen.findByText("delivered")).toBeInTheDocument();
    expect(calls.some((call) => call.key === `GET ${BASE}/sub-active/deliveries`)).toBe(true);
    fireEvent.click(within(row).getByRole("button", { name: "Hide deliveries" }));
    await waitFor(() => expect(screen.queryByText("delivered")).not.toBeInTheDocument());
  });

  it("lists the dead letters and replays one", async () => {
    const calls = routes({
      [`GET ${BASE}/dead-letters`]: () => json([aDeadLetter()]),
      [`POST ${BASE}/dead-letters/delivery-dead/replay`]: () => json({}),
    });
    renderDesk(<AccountWebhooksTab accountId={ACCOUNT_ID} />);
    const error = await screen.findByText(/upstream timeout/);
    expect(error).toHaveTextContent("HTTP 500. upstream timeout");
    const row = error.closest("tr");
    if (!row) throw new Error("no dead-letter row");
    fireEvent.click(within(row).getByRole("button", { name: "Replay" }));
    fireEvent.click(within(row).getByRole("button", { name: "Confirm replay" }));
    await screen.findByText("Sent again");
    expect(calls.some((call) => call.key === `POST ${BASE}/dead-letters/delivery-dead/replay`)).toBe(true);
  });
});
