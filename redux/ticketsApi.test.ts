import { afterEach, describe, expect, it, vi } from "vitest";
import { makeStore } from "@/redux/store";
import { ticketsApi, type Contract } from "@/redux/ticketsApi";
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
    after_hours_handling: "none",
    after_hours_multiplier: null,
    threshold_percents: [50, 75, 90, 100],
    threshold_notify_client: false,
    overage_rule: "allow_flag",
    overage_multiplier: null,
    rollover_rule: "none",
    rollover_cap_hours: null,
    forecast_window_days: 10,
    version: 1,
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

  it("patches the handling with the version and refreshes the list", async () => {
    let reads = 0;
    const calls = stubFetch({
      [`GET /v1/accounts/${ACCOUNT_ID}/contracts`]: () => {
        reads += 1;
        return json([reads > 1 ? aPremiumContract({ version: 2 }) : aContract()]);
      },
      [`PATCH /v1/accounts/${ACCOUNT_ID}/contracts/${CONTRACT_ID}`]: () => json(aPremiumContract({ version: 2 })),
    });
    const store = makeStore();
    const subscription = store.dispatch(ticketsApi.endpoints.listAccountContracts.initiate(ACCOUNT_ID));
    await subscription.unwrap();
    const updated = await store
      .dispatch(
        ticketsApi.endpoints.patchContract.initiate({
          accountId: ACCOUNT_ID,
          contractId: CONTRACT_ID,
          body: { version: 1, after_hours_handling: "premium_rate", after_hours_multiplier: 1.5 },
        }),
      )
      .unwrap();
    expect(calls.find((call) => call.key.startsWith("PATCH "))?.body).toEqual({
      version: 1,
      after_hours_handling: "premium_rate",
      after_hours_multiplier: 1.5,
    });
    expect(updated.version).toBe(2);
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
