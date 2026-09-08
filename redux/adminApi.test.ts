import { afterEach, describe, expect, it, vi } from "vitest";
import { CATALOG_KINDS, defaultScope, formatBody, isScoped, parseBody } from "@/lib/admin/config-catalog";
import { configError, describeConfigError } from "@/lib/admin/config-errors";
import { adminApi } from "@/redux/adminApi";
import { makeStore } from "@/redux/store";
import { json, stubFetch } from "@/test-kit/portal";
import {
  ACCOUNT_ID,
  aConfigVersion,
  anAccountConfig,
  aNothingActiveConfig,
  anOverriddenConfig,
  anOverride,
} from "@/test-kit/config";

describe("adminApi account configuration", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads a view with nothing active as data, not as a failure", async () => {
    stubFetch({ [`GET /v1/accounts/${ACCOUNT_ID}/config/sla_policy`]: () => json(aNothingActiveConfig()) });
    const store = makeStore();
    const view = await store
      .dispatch(adminApi.endpoints.getAccountConfig.initiate({ accountId: ACCOUNT_ID, kind: "sla_policy" }))
      .unwrap();
    expect(view).toEqual({ effective: null, default: null, overrides: [] });
  });

  it("reads the account view, with the scope only where the kind takes one", async () => {
    const calls = stubFetch({
      [`GET /v1/accounts/${ACCOUNT_ID}/config/sla_policy`]: () => json(anAccountConfig()),
      [`GET /v1/accounts/${ACCOUNT_ID}/config/state_machine`]: () =>
        json(anAccountConfig({ default: aConfigVersion({ kind: "state_machine", scope_key: "incident" }) })),
    });
    const store = makeStore();
    const view = await store
      .dispatch(adminApi.endpoints.getAccountConfig.initiate({ accountId: ACCOUNT_ID, kind: "sla_policy" }))
      .unwrap();
    await store
      .dispatch(
        adminApi.endpoints.getAccountConfig.initiate({
          accountId: ACCOUNT_ID,
          kind: "state_machine",
          scope: "incident",
        }),
      )
      .unwrap();
    expect(calls.map((call) => `${call.key}${call.search}`)).toEqual([
      `GET /v1/accounts/${ACCOUNT_ID}/config/sla_policy`,
      `GET /v1/accounts/${ACCOUNT_ID}/config/state_machine?scope=incident`,
    ]);
    expect(view.effective?.source).toBe("default");
  });

  it("wraps the override body as { body } on PUT and sends DELETE with the scope", async () => {
    const calls = stubFetch({
      [`PUT /v1/accounts/${ACCOUNT_ID}/config/sla_policy/override`]: () => json(anOverride()),
      [`DELETE /v1/accounts/${ACCOUNT_ID}/config/state_machine/override`]: () => json({ removed: "cfg-override-1" }),
    });
    const store = makeStore();
    const body = { calendar: "24x7", targets: {} };
    await store
      .dispatch(adminApi.endpoints.setAccountOverride.initiate({ accountId: ACCOUNT_ID, kind: "sla_policy", body }))
      .unwrap();
    await store
      .dispatch(
        adminApi.endpoints.removeAccountOverride.initiate({
          accountId: ACCOUNT_ID,
          kind: "state_machine",
          scope: "incident",
        }),
      )
      .unwrap();
    expect(calls.map((call) => [`${call.key}${call.search}`, call.body])).toEqual([
      [`PUT /v1/accounts/${ACCOUNT_ID}/config/sla_policy/override`, { body }],
      [`DELETE /v1/accounts/${ACCOUNT_ID}/config/state_machine/override?scope=incident`, undefined],
    ]);
  });

  it("refetches the account view after an override is set", async () => {
    let reads = 0;
    stubFetch({
      [`GET /v1/accounts/${ACCOUNT_ID}/config/sla_policy`]: () => {
        reads += 1;
        return json(reads > 1 ? anOverriddenConfig() : anAccountConfig());
      },
      [`PUT /v1/accounts/${ACCOUNT_ID}/config/sla_policy/override`]: () => json(anOverride()),
    });
    const store = makeStore();
    const subscription = store.dispatch(
      adminApi.endpoints.getAccountConfig.initiate({ accountId: ACCOUNT_ID, kind: "sla_policy" }),
    );
    await subscription.unwrap();
    await store
      .dispatch(adminApi.endpoints.setAccountOverride.initiate({ accountId: ACCOUNT_ID, kind: "sla_policy", body: {} }))
      .unwrap();
    await vi.waitFor(() => expect(reads).toBe(2));
    subscription.unsubscribe();
  });
});

describe("configuration errors and the catalog", () => {
  it("surfaces invalid_config with the server's problems, and the other typed bodies", () => {
    const invalid = configError({
      status: 400,
      data: { code: "invalid_config", problems: ["initial state x is not declared", "no terminal state"] },
    });
    expect(invalid.problems).toEqual(["initial state x is not declared", "no terminal state"]);
    expect(describeConfigError(invalid)).toBe(
      "The body was refused: initial state x is not declared; no terminal state.",
    );
    expect(describeConfigError(configError({ status: 400, data: { code: "invalid_config" } }))).toBe(
      "The body was refused by the server's validation.",
    );
    expect(
      describeConfigError(configError({ status: 404, data: { code: "not_found", entity: "config_override" } })),
    ).toBe("There is no override to remove; the default already applies.");
    expect(
      describeConfigError(configError({ status: 400, data: { code: "unknown_config_kind", kind: "forms" } })),
    ).toBe("forms is not a configuration kind.");
    expect(describeConfigError(configError({ status: 404, data: { code: "config_missing" } }))).toContain("seed");
  });

  it("scopes only the state machine, and parses the editor text as an object", () => {
    expect(CATALOG_KINDS.map((kind) => kind.key)).toEqual([
      "state_machine",
      "priority_matrix",
      "sla_policy",
      "activity_types",
      "billable_classes",
      "resolution_codes",
    ]);
    expect(isScoped("state_machine")).toBe(true);
    expect(isScoped("sla_policy")).toBe(false);
    expect(defaultScope("state_machine")).toBe("incident");
    expect(defaultScope("priority_matrix")).toBeUndefined();
    expect(parseBody('{"a": 1}')).toEqual({ ok: true, body: { a: 1 } });
    expect(parseBody("[1]")).toEqual({ ok: false, problem: "The body must be a JSON object." });
    const broken = parseBody("{ nope");
    expect(broken.ok).toBe(false);
    if (!broken.ok) expect(broken.problem).toMatch(/^Not valid JSON/);
    expect(formatBody({ a: 1 })).toBe('{\n  "a": 1\n}');
  });
});
