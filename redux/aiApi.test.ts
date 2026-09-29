import { afterEach, describe, expect, it, vi } from "vitest";
import { aiApi } from "@/redux/aiApi";
import { makeStore } from "@/redux/store";
import { json, stubFetch } from "@/test-kit/portal";
import { aSuggestion } from "@/test-kit/axel";

/** The AI slice sends the request shapes the Axel adapter contract expects and refetches after a decision. */
describe("aiApi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads open and history suggestions, threads, settings, accuracy and defaults with the right queries", async () => {
    const calls = stubFetch({
      "GET /v1/axel/suggestions": () => json([aSuggestion()]),
      "GET /v1/axel/threads": () => json([]),
      "GET /v1/accounts/acct-1/ai-settings": () => json({ account_id: "acct-1", version: 1 }),
      "GET /v1/axel/accuracy": () => json({ from: "", to: "", threshold: 0.8, capabilities: [] }),
      "GET /v1/axel/config/defaults": () => json({ versions: [] }),
    });
    const store = makeStore();
    await store.dispatch(aiApi.endpoints.openSuggestions.initiate("t-1")).unwrap();
    await store.dispatch(aiApi.endpoints.suggestionHistory.initiate("t-1")).unwrap();
    await store.dispatch(aiApi.endpoints.axelThreads.initiate("t-1")).unwrap();
    await store.dispatch(aiApi.endpoints.aiSettings.initiate("acct-1")).unwrap();
    await store
      .dispatch(aiApi.endpoints.aiAccuracy.initiate({ capability: "classify", threshold: 0.8, account: undefined }))
      .unwrap();
    await store.dispatch(aiApi.endpoints.aiDefaults.initiate()).unwrap();
    expect(calls.map((call) => `${call.key}${call.search}`)).toEqual([
      "GET /v1/axel/suggestions?target_kind=ticket&target_id=t-1",
      "GET /v1/axel/suggestions?target_kind=ticket&target_id=t-1&history=true",
      "GET /v1/axel/threads?ticket=t-1",
      "GET /v1/accounts/acct-1/ai-settings",
      "GET /v1/axel/accuracy?capability=classify&threshold=0.8",
      "GET /v1/axel/config/defaults",
    ]);
  });

  it("posts suggest, decisions and feedback, and a decision refetches the open suggestions", async () => {
    const calls = stubFetch({
      "GET /v1/axel/suggestions": () => json([aSuggestion()]),
      "POST /v1/axel/suggest": () => json(aSuggestion({ capability: "summarise" }), 201),
      "POST /v1/axel/suggestions/sg-1/decisions": () => json({ suggestion: aSuggestion(), decision: {} }, 201),
      "POST /v1/axel/suggestions/sg-1/feedback": () => json({ id: "fb-1" }, 201),
    });
    const store = makeStore();
    await store.dispatch(aiApi.endpoints.openSuggestions.initiate("t-1")).unwrap();
    await store
      .dispatch(aiApi.endpoints.suggest.initiate({ capability: "summarise", target_kind: "ticket", target_id: "t-1" }))
      .unwrap();
    await store
      .dispatch(
        aiApi.endpoints.decide.initiate({
          id: "sg-1",
          targetId: "t-1",
          body: { decision: "rejected", reject_reason: "wrong" },
        }),
      )
      .unwrap();
    await store.dispatch(aiApi.endpoints.feedback.initiate({ id: "sg-1", body: { rating: 4 } })).unwrap();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const keys = calls.map((call) => call.key);
    expect(keys.slice(0, 2)).toEqual(["GET /v1/axel/suggestions", "POST /v1/axel/suggest"]);
    expect(keys.filter((key) => key === "GET /v1/axel/suggestions").length).toBeGreaterThanOrEqual(3);
    expect(calls.find((call) => call.key === "POST /v1/axel/suggestions/sg-1/decisions")?.body).toEqual({
      decision: "rejected",
      reject_reason: "wrong",
    });
    expect(calls.find((call) => call.key === "POST /v1/axel/suggestions/sg-1/feedback")?.body).toEqual({ rating: 4 });
  });

  it("puts the settings patch with its version and the defaults wrapped in body", async () => {
    const calls = stubFetch({
      "PUT /v1/accounts/acct-1/ai-settings": () => json({ account_id: "acct-1", version: 2 }),
      "PUT /v1/axel/config/defaults": () => json({ id: "v-2", version: 2 }),
    });
    const store = makeStore();
    await store
      .dispatch(
        aiApi.endpoints.updateAiSettings.initiate({
          id: "acct-1",
          body: { enabled: true, dpa_reference: "DPA-7", version: 1 },
        }),
      )
      .unwrap();
    const defaults = {
      kill_switch: false,
      harness_regions: ["us"],
      agents: {} as never,
      capabilities: {} as never,
    };
    await store.dispatch(aiApi.endpoints.updateAiDefaults.initiate(defaults)).unwrap();
    expect(calls.map((call) => [call.key, call.body])).toEqual([
      ["PUT /v1/accounts/acct-1/ai-settings", { enabled: true, dpa_reference: "DPA-7", version: 1 }],
      ["PUT /v1/axel/config/defaults", { body: defaults }],
    ]);
  });
});
