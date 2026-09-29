import { afterEach, describe, expect, it, vi } from "vitest";
import { knowledgeApi } from "@/redux/knowledgeApi";
import { makeStore } from "@/redux/store";
import { json, stubFetch } from "@/test-kit/portal";
import { anArticle } from "@/test-kit/knowledge";

/** The knowledge slice sends the request shapes the /v1/articles contract expects. */
describe("knowledgeApi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists with comma-joined statuses, reads by key, and searches", async () => {
    const calls = stubFetch({
      "GET /v1/articles": () => json([anArticle()]),
      "GET /v1/articles/KB100001": () => json(anArticle()),
      "GET /v1/search/solutions": () => json([]),
      "GET /v1/catalogs": () => json({ resolution_codes: [], activity_types: [], billable_classes: [] }),
    });
    const store = makeStore();
    await store
      .dispatch(knowledgeApi.endpoints.listArticles.initiate({ status: ["draft", "published"], q: "cube", limit: 50 }))
      .unwrap();
    await store.dispatch(knowledgeApi.endpoints.getArticle.initiate("KB100001")).unwrap();
    await store.dispatch(knowledgeApi.endpoints.searchSolutions.initiate({ q: "report", limit: 8 })).unwrap();
    await store.dispatch(knowledgeApi.endpoints.catalogs.initiate("acct-1")).unwrap();
    expect(calls.map((call) => `${call.key}${call.search}`)).toEqual([
      "GET /v1/articles?status=draft%2Cpublished&q=cube&limit=50",
      "GET /v1/articles/KB100001",
      "GET /v1/search/solutions?q=report&limit=8",
      "GET /v1/catalogs?account_id=acct-1",
    ]);
  });

  it("puts the draft with the version, posts publish, generalize and the resolution link", async () => {
    const calls = stubFetch({
      "PUT /v1/articles/KB100001/draft": () => json(anArticle({ version: 2 })),
      "POST /v1/articles/KB100001/publish": () => json(anArticle({ status: "published" }), 201),
      "POST /v1/articles/KB100001/generalize": () =>
        json({ findings: [{ section: "steps", kind: "account_name", value: "Brookfield" }] }, 201),
      "POST /v1/tickets/CS0001001/solutions": () =>
        json({ id: "s-1", article: { id: "a-1", key: "KB100001", title: "x" } }, 201),
      "POST /v1/tickets/CS0001001/article-candidate": () => json(anArticle(), 201),
    });
    const store = makeStore();
    await store
      .dispatch(knowledgeApi.endpoints.updateDraft.initiate({ key: "KB100001", body: { version: 1, steps: "Renew" } }))
      .unwrap();
    await store.dispatch(knowledgeApi.endpoints.publishArticle.initiate({ key: "KB100001", version: 2 })).unwrap();
    const generalized = await store
      .dispatch(knowledgeApi.endpoints.generalizeArticle.initiate({ key: "KB100001" }))
      .unwrap();
    expect("findings" in generalized && generalized.findings[0].value).toBe("Brookfield");
    await store
      .dispatch(knowledgeApi.endpoints.linkSolution.initiate({ ticketKey: "CS0001001", article_id: "a-1" }))
      .unwrap();
    await store
      .dispatch(knowledgeApi.endpoints.articleCandidate.initiate({ ticketKey: "CS0001001", include_work_notes: true }))
      .unwrap();
    expect(calls.map((call) => [call.key, call.body])).toEqual([
      ["PUT /v1/articles/KB100001/draft", { version: 1, steps: "Renew" }],
      ["POST /v1/articles/KB100001/publish", { version: 2 }],
      ["POST /v1/articles/KB100001/generalize", {}],
      ["POST /v1/tickets/CS0001001/solutions", { article_id: "a-1" }],
      ["POST /v1/tickets/CS0001001/article-candidate", { include_work_notes: true }],
    ]);
  });
});
