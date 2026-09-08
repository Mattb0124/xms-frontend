import { afterEach, describe, expect, it, vi } from "vitest";
import { makeStore } from "@/redux/store";
import { ticketsApi, type Contract, type Engagement, type TicketView } from "@/redux/ticketsApi";
import { json, stubFetch } from "@/test-kit/portal";

export const ACCOUNT_ID = "77777777-7777-4777-8777-777777777777";
export const CONTRACT_ID = "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1";

/** A constructed contract row: a retainer with no after-hours handling and the column-default budget rules. */
export function aContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: CONTRACT_ID,
    key: "CT10001",
    name: "Support retainer",
    model: "retainer",
    status: "active",
    currency: "USD",
    engagement_id: null,
    after_hours_handling: "none",
    after_hours_multiplier: null,
    threshold_percents: [50, 75, 90, 100],
    threshold_notify_client: false,
    overage_rule: "allow_flag",
    overage_multiplier: null,
    rollover_rule: "none",
    rollover_cap_hours: null,
    forecast_window_days: 10,
    technology_codes: [],
    version: 1,
    ...overrides,
  };
}

export const ENGAGEMENT_ID = "e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1";
export const OWNER_USER_ID = "0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a";

/**
 * A constructed engagement: active, a renewal a year out, a month of notice
 * and no alert fired yet. Nothing here is copied from a live account.
 */
export function anEngagement(overrides: Partial<Engagement> = {}): Engagement {
  return {
    id: ENGAGEMENT_ID,
    account_id: ACCOUNT_ID,
    name: "Managed services 2026",
    owner_user_id: OWNER_USER_ID,
    renewal_date: "2027-03-31",
    notice_period_days: 30,
    status: "active",
    renewal_alerts_fired: [],
    created_at: "2026-04-01T09:00:00.000Z",
    updated_at: "2026-04-01T09:00:00.000Z",
    version: 1,
    ...overrides,
  };
}

/** The same engagement inside the widest lead window, with two alerts already sent. */
export function anExpiringEngagement(overrides: Partial<Engagement> = {}): Engagement {
  return anEngagement({
    id: "e2e2e2e2-e2e2-4e2e-8e2e-e2e2e2e2e2e2",
    name: "Hosting renewal",
    renewal_date: "2026-10-01",
    status: "expiring",
    renewal_alerts_fired: [90, 60],
    version: 4,
    ...overrides,
  });
}

export const TICKET_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

/** A constructed ticket record: an open incident on the retainer, assigned, with both clocks running. */
export function aTicketView(overrides: Partial<TicketView> = {}): TicketView {
  return {
    id: TICKET_ID,
    key: "CS1000199",
    account_id: ACCOUNT_ID,
    type: "incident",
    state: "in_progress",
    state_label: "In progress",
    short_description: "HFM consolidation fails on the September close",
    description: null,
    category: null,
    impact: "high",
    urgency: "high",
    priority: "p2",
    priority_overridden: false,
    source: "portal",
    requester: { id: "u-pat", email: "pat.client@example.test", display_name: "Pat Client" },
    group_id: null,
    assignee_id: "u-ben",
    assignee_name: "Ben Okafor",
    contract_id: CONTRACT_ID,
    resolution: {
      code: null,
      notes: null,
      solution_article_id: null,
      solution_candidate: false,
      time_exemption_reason: null,
    },
    external_refs: {},
    reopen_count: 0,
    first_response_at: null,
    resolved_at: null,
    closed_at: null,
    cancelled_at: null,
    sla: {},
    created_by: "u-pat",
    created_by_name: "Pat Client",
    created_at: "2026-08-25T09:00:00Z",
    updated_at: "2026-08-25T10:00:00Z",
    version: 3,
    ...overrides,
  };
}

export function aPremiumContract(overrides: Partial<Contract> = {}): Contract {
  return aContract({ after_hours_handling: "premium_rate", after_hours_multiplier: "1.500", ...overrides });
}

export function aCompTimeContract(overrides: Partial<Contract> = {}): Contract {
  return aContract({ after_hours_handling: "comp_time", after_hours_multiplier: null, ...overrides });
}

/** The contracts routes on the tickets slice (TB-13): list under tickets:view, PATCH the handling with the version. */
describe("ticketsApi contracts", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists the account's contracts with their after-hours handling", async () => {
    const calls = stubFetch({
      [`GET /v1/accounts/${ACCOUNT_ID}/contracts`]: () =>
        json([aContract(), aPremiumContract({ id: "c-2", key: "CT10002" })]),
    });
    const store = makeStore();
    const rows = await store.dispatch(ticketsApi.endpoints.listAccountContracts.initiate(ACCOUNT_ID)).unwrap();
    expect(calls.map((call) => call.key)).toEqual([`GET /v1/accounts/${ACCOUNT_ID}/contracts`]);
    expect(rows.map((row) => [row.after_hours_handling, row.after_hours_multiplier])).toEqual([
      ["none", null],
      ["premium_rate", "1.500"],
    ]);
  });

  it("patches the handling and the required technologies with the version and refreshes the list", async () => {
    let reads = 0;
    const calls = stubFetch({
      [`GET /v1/accounts/${ACCOUNT_ID}/contracts`]: () => {
        reads += 1;
        return json([reads > 1 ? aPremiumContract({ version: 2, technology_codes: ["onestream"] }) : aContract()]);
      },
      [`PATCH /v1/accounts/${ACCOUNT_ID}/contracts/${CONTRACT_ID}`]: () =>
        json(aPremiumContract({ version: 2, technology_codes: ["onestream"] })),
    });
    const store = makeStore();
    const subscription = store.dispatch(ticketsApi.endpoints.listAccountContracts.initiate(ACCOUNT_ID));
    await subscription.unwrap();
    const updated = await store
      .dispatch(
        ticketsApi.endpoints.patchContract.initiate({
          accountId: ACCOUNT_ID,
          contractId: CONTRACT_ID,
          body: {
            version: 1,
            after_hours_handling: "premium_rate",
            after_hours_multiplier: 1.5,
            technology_codes: ["onestream"],
          },
        }),
      )
      .unwrap();
    expect(calls.find((call) => call.key.startsWith("PATCH "))?.body).toEqual({
      version: 1,
      after_hours_handling: "premium_rate",
      after_hours_multiplier: 1.5,
      technology_codes: ["onestream"],
    });
    expect(updated.version).toBe(2);
    expect(updated.technology_codes).toEqual(["onestream"]);

    await vi.waitFor(() => expect(reads).toBe(2));
    subscription.unsubscribe();
  });

  it("surfaces multiplier_required and the stale version as typed errors", async () => {
    let attempt = 0;
    stubFetch({
      [`PATCH /v1/accounts/${ACCOUNT_ID}/contracts/${CONTRACT_ID}`]: () => {
        attempt += 1;
        return attempt === 1
          ? json({ code: "multiplier_required", handling: "premium_rate" }, 400)
          : json({ code: "stale_version" }, 409);
      },
    });
    const store = makeStore();
    const patch = (version: number) =>
      store
        .dispatch(
          ticketsApi.endpoints.patchContract.initiate({
            accountId: ACCOUNT_ID,
            contractId: CONTRACT_ID,
            body: { version, after_hours_handling: "premium_rate" },
          }),
        )
        .unwrap();
    await expect(patch(1)).rejects.toMatchObject({ status: 400, data: { code: "multiplier_required" } });
    await expect(patch(1)).rejects.toMatchObject({ status: 409, data: { code: "stale_version" } });
  });
});
