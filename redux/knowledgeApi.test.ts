import { afterEach, describe, expect, it, vi } from "vitest";
import { knowledgeApi, type ArticleView } from "@/redux/knowledgeApi";
import { makeStore } from "@/redux/store";
import { json, stubFetch } from "@/test-kit/portal";

export function anArticle(overrides: Partial<ArticleView> = {}): ArticleView {
  return {
    id: "a-1",
    account_id: "acct-1",
    display_key: "KB100001",
    kind: "solution",
    status: "draft",
    is_global: false,
    title: "Consolidation report fails to open",
    categories: ["reporting"],
    self_service: "none",
    effort_band: null,
    owner_user_id: "user-cara",
    owner_name: "Cara Lee",
    reviewer_name: null,
    published_version_id: null,
    last_verified_at: null,
    retired_at: null,
    retired_reason: null,
    source_ticket_id: null,
    generalized_from_id: null,
    created_at: "2026-09-07T08:00:00Z",
    updated_at: "2026-09-07T09:00:00Z",
    version: 1,
    draft: {
      id: "v-1",
      version_no: 1,
      problem_statement: "Error 500",
      environment: "",
      symptoms: "",
      cause: "",
      steps: "Renew the certificate",
      verification: "",
      rollback: "",
      client_notes: "Ask your administrator",
      authored_name: "Cara Lee",
      published_at: null,
      created_at: "2026-09-07T08:00:00Z",
    },
    published: null,
    versions: [
      { id: "v-1", version_no: 1, published_at: null, authored_name: "Cara Lee", created_at: "2026-09-07T08:00:00Z" },
    ],
    visibility: [],
    feedback: {},
    ...overrides,
  };
}

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
