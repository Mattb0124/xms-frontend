import { afterEach, describe, expect, it, vi } from "vitest";
import { integrationsApi } from "@/redux/integrationsApi";
import { makeStore } from "@/redux/store";
import {
  aDestination,
  aFinanceDelivery,
  BILLING_PERIOD_ID,
  FINANCE_ACCOUNT_ID,
} from "@/test-kit/integrations";
import { json, stubFetch } from "@/test-kit/portal";

const DESTINATION = `GET /v1/finance/destinations/${FINANCE_ACCOUNT_ID}`;
const SET_DESTINATION = `PUT /v1/finance/destinations/${FINANCE_ACCOUNT_ID}`;
const DELIVERIES = "GET /v1/finance/deliveries";
const DELIVER = "POST /v1/finance/deliveries";

describe("integrationsApi finance endpoints", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads the destination, tolerating the null the API returns before one is set", async () => {
    const calls = stubFetch({ [DESTINATION]: () => json(null) });
    const store = makeStore();
    const destination = await store
      .dispatch(integrationsApi.endpoints.financeDestination.initiate(FINANCE_ACCOUNT_ID))
      .unwrap();
    expect(destination).toBeNull();
    expect(calls[0].key).toBe(DESTINATION);
  });

  it("sets an HTTPS destination and surfaces the secret the API mints once", async () => {
    const calls = stubFetch({
      [SET_DESTINATION]: () => json({ ...aDestination(), secret: "whsec_shown_once" }),
    });
    const store = makeStore();
    const saved = await store
      .dispatch(
        integrationsApi.endpoints.setFinanceDestination.initiate({
          accountId: FINANCE_ACCOUNT_ID,
          body: {
            kind: "https",
            endpoint_url: "https://finance.example.test/xms/billing",
            format: "csv",
            enabled: true,
          },
        }),
      )
      .unwrap();
    expect(saved.secret).toBe("whsec_shown_once");
    expect(calls[0].body).toEqual({
      kind: "https",
      endpoint_url: "https://finance.example.test/xms/billing",
      format: "csv",
      enabled: true,
    });
  });

  it("sets an object store destination with the prefix and no endpoint", async () => {
    const calls = stubFetch({
      [SET_DESTINATION]: () =>
        json(aDestination({ kind: "object_store", endpoint_url: null, object_prefix: "finance/xms", secret_kid: null })),
    });
    const store = makeStore();
    const saved = await store
      .dispatch(
        integrationsApi.endpoints.setFinanceDestination.initiate({
          accountId: FINANCE_ACCOUNT_ID,
          body: { kind: "object_store", object_prefix: "finance/xms", format: "xlsx", enabled: false },
        }),
      )
      .unwrap();
    expect(saved.secret).toBeUndefined();
    expect(calls[0].body).toEqual({
      kind: "object_store",
      object_prefix: "finance/xms",
      format: "xlsx",
      enabled: false,
    });
  });

  it("filters the deliveries by account and period with the API's parameter names", async () => {
    const calls = stubFetch({ [DELIVERIES]: () => json([aFinanceDelivery()]) });
    const store = makeStore();
    await store
      .dispatch(integrationsApi.endpoints.financeDeliveries.initiate({ account_id: FINANCE_ACCOUNT_ID }))
      .unwrap();
    await store
      .dispatch(
        integrationsApi.endpoints.financeDeliveries.initiate({
          account_id: FINANCE_ACCOUNT_ID,
          period_id: BILLING_PERIOD_ID,
        }),
      )
      .unwrap();
    expect(calls.map((call) => decodeURIComponent(call.search))).toEqual([
      `?account_id=${FINANCE_ACCOUNT_ID}`,
      `?account_id=${FINANCE_ACCOUNT_ID}&period_id=${BILLING_PERIOD_ID}`,
    ]);
  });

  it("delivers a period now with the period id alone and reloads the deliveries", async () => {
    const calls = stubFetch({
      [DELIVERIES]: () => json([aFinanceDelivery()]),
      [DELIVER]: () => json(aFinanceDelivery({ id: "del-2", status: "delivered", ack_received_at: null }), 201),
    });
    const store = makeStore();
    await store
      .dispatch(integrationsApi.endpoints.financeDeliveries.initiate({ account_id: FINANCE_ACCOUNT_ID }))
      .unwrap();
    const delivery = await store
      .dispatch(
        integrationsApi.endpoints.deliverPeriodNow.initiate({
          accountId: FINANCE_ACCOUNT_ID,
          period_id: BILLING_PERIOD_ID,
        }),
      )
      .unwrap();
    expect(delivery.status).toBe("delivered");
    expect(calls.find((call) => call.key === DELIVER)?.body).toEqual({ period_id: BILLING_PERIOD_ID });
    await vi.waitFor(() => expect(calls.filter((call) => call.key === DELIVERIES)).toHaveLength(2));
  });

  it("keeps the deliveries as they are when the period is not locked", async () => {
    const calls = stubFetch({
      [DELIVERIES]: () => json([aFinanceDelivery()]),
      [DELIVER]: () => json({ code: "period_not_locked", status: "open" }, 409),
    });
    const store = makeStore();
    await store
      .dispatch(integrationsApi.endpoints.financeDeliveries.initiate({ account_id: FINANCE_ACCOUNT_ID }))
      .unwrap();
    const refused = await store.dispatch(
      integrationsApi.endpoints.deliverPeriodNow.initiate({
        accountId: FINANCE_ACCOUNT_ID,
        period_id: BILLING_PERIOD_ID,
      }),
    );
    expect("error" in refused && (refused.error as { data: { code: string } }).data.code).toBe("period_not_locked");
    expect(calls.filter((call) => call.key === DELIVERIES)).toHaveLength(1);
  });
});
