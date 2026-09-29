import { xmsApi } from "@/redux/api";

/**
 * Solution Knowledge Base endpoints (technical spec section 4) and the
 * desk catalogs, injected into the base API. Articles are keyed by their
 * display key (KB000123) in the cache so a record page and the lists share
 * one tag per article.
 */
export type ArticleStatus = "draft" | "in_review" | "published" | "retired";
export type ArticleKind = "solution" | "workaround" | "known_error" | "procedure" | "reference";
export type SelfService = "none" | "follow" | "request" | "auto";
export type EffortBand = "lt_15m" | "lt_1h" | "lt_4h" | "gt_4h";

export const VERSION_SECTIONS = [
  "problem_statement",
  "environment",
  "symptoms",
  "cause",
  "steps",
  "verification",
  "rollback",
  "client_notes",
] as const;
export type VersionSection = (typeof VERSION_SECTIONS)[number];

export type Sections = Partial<Record<VersionSection, string>>;

export interface Article {
  id: string;
  account_id: string;
  display_key: string;
  kind: ArticleKind;
  status: ArticleStatus;
  is_global: boolean;
  title: string;
  categories: string[];
  self_service: SelfService;
  effort_band: EffortBand | null;
  owner_user_id: string;
  owner_name: string;
  reviewer_name: string | null;
  published_version_id: string | null;
  last_verified_at: string | null;
  retired_at: string | null;
  retired_reason: string | null;
  source_ticket_id: string | null;
  generalized_from_id: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface ArticleVersion extends Record<VersionSection, string> {
  id: string;
  version_no: number;
  authored_name: string;
  published_at: string | null;
  created_at: string;
}

export interface ArticleView extends Article {
  draft: ArticleVersion | null;
  published: ArticleVersion | null;
  versions: {
    id: string;
    version_no: number;
    published_at: string | null;
    authored_name: string;
    created_at: string;
  }[];
  visibility: { visible_account_id: string; granted_by: string; granted_at: string }[];
  feedback: Partial<Record<"useful" | "not_useful" | "out_of_date" | "solved_it", number>>;
}

export interface SearchHit {
  id: string;
  display_key: string;
  title: string;
  kind: ArticleKind;
  status: ArticleStatus;
  is_global: boolean;
  account_id: string;
  categories: string[];
  self_service: SelfService;
  rank: number;
}

export interface SimilarTicket {
  id: string;
  key: string;
  short_description: string;
  resolution_code: string | null;
  article_key: string | null;
  article_title: string | null;
  rank: number;
}

export interface SolutionLink {
  id: string;
  article_id: string;
  article_version_id: string;
  outcome: "resolved_by" | "partially_resolved_by" | "created_from";
  actor_name: string;
  created_at: string;
  display_key: string;
  title: string;
}

export interface SolutionsRail {
  articles: SearchHit[];
  similar_tickets: SimilarTicket[];
  linked: SolutionLink[];
}

export interface Finding {
  section: string;
  kind: string;
  value: string;
}

export interface ArticleListParams {
  status?: string[];
  kind?: string;
  category?: string;
  account_id?: string;
  q?: string;
  limit?: number;
  global?: boolean;
}

export interface CreateArticleBody extends Sections {
  account_id: string;
  title: string;
  kind?: ArticleKind;
  categories?: string[];
  self_service?: SelfService;
  effort_band?: EffortBand;
}

export interface UpdateDraftBody extends Sections {
  version: number;
  title?: string;
  categories?: string[];
  self_service?: SelfService;
  effort_band?: EffortBand;
}

export interface CatalogItem {
  key: string;
  label: string;
}

export interface Catalogs {
  resolution_codes: (CatalogItem & { no_solution: boolean })[];
  activity_types: (CatalogItem & { billable_class: string })[];
  billable_classes: (CatalogItem & { consumes_contract: boolean })[];
}

function articleTag(key: string) {
  return { type: "Article" as const, id: key };
}

function solutionsTag(ticketKey: string) {
  return { type: "Solutions" as const, id: ticketKey };
}

function listQuery(params: ArticleListParams): Record<string, string> {
  const query: Record<string, string> = {};
  if (params.status?.length) query.status = params.status.join(",");
  if (params.kind) query.kind = params.kind;
  if (params.category) query.category = params.category;
  if (params.account_id) query.account_id = params.account_id;
  if (params.q) query.q = params.q;
  if (params.limit) query.limit = String(params.limit);
  return query;
}

export const knowledgeApi = xmsApi.injectEndpoints({
  endpoints: (build) => ({
    listArticles: build.query<Article[], ArticleListParams>({
      query: (params) => ({ url: "/v1/articles", params: listQuery(params) }),
      providesTags: (result) => ["Articles", ...(result ?? []).map((article) => articleTag(article.display_key))],
    }),
    getArticle: build.query<ArticleView, string>({
      query: (key) => `/v1/articles/${key}`,
      providesTags: (_result, _error, key) => [articleTag(key)],
    }),
    createArticle: build.mutation<ArticleView, CreateArticleBody>({
      query: (body) => ({ url: "/v1/articles", method: "POST", body }),
      invalidatesTags: ["Articles"],
    }),
    updateDraft: build.mutation<ArticleView, { key: string; body: UpdateDraftBody }>({
      query: ({ key, body }) => ({ url: `/v1/articles/${key}/draft`, method: "PUT", body }),
      invalidatesTags: (_result, _error, { key }) => [articleTag(key), "Articles"],
    }),
    submitArticle: build.mutation<ArticleView, { key: string; version: number }>({
      query: ({ key, version }) => ({ url: `/v1/articles/${key}/submit`, method: "POST", body: { version } }),
      invalidatesTags: (_result, _error, { key }) => [articleTag(key), "Articles"],
    }),
    publishArticle: build.mutation<ArticleView, { key: string; version: number }>({
      query: ({ key, version }) => ({ url: `/v1/articles/${key}/publish`, method: "POST", body: { version } }),
      invalidatesTags: (_result, _error, { key }) => [articleTag(key), "Articles"],
    }),
    retireArticle: build.mutation<ArticleView, { key: string; version: number; reason: string }>({
      query: ({ key, version, reason }) => ({
        url: `/v1/articles/${key}/retire`,
        method: "POST",
        body: { version, reason },
      }),
      invalidatesTags: (_result, _error, { key }) => [articleTag(key), "Articles"],
    }),
    generalizeArticle: build.mutation<ArticleView | { findings: Finding[] }, { key: string; sections?: Sections }>({
      query: ({ key, sections }) => ({ url: `/v1/articles/${key}/generalize`, method: "POST", body: sections ?? {} }),
      invalidatesTags: ["Articles"],
    }),
    replaceVisibility: build.mutation<ArticleView, { key: string; account_ids: string[] }>({
      query: ({ key, account_ids }) => ({
        url: `/v1/articles/${key}/visibility`,
        method: "PUT",
        body: { account_ids },
      }),
      invalidatesTags: (_result, _error, { key }) => [articleTag(key)],
    }),
    articleFeedback: build.mutation<
      { id: string },
      {
        key: string;
        verdict: "useful" | "not_useful" | "out_of_date";
        comment?: string;
        context?: string;
        context_ref?: string;
      }
    >({
      query: ({ key, ...body }) => ({ url: `/v1/articles/${key}/feedback`, method: "POST", body }),
      invalidatesTags: (_result, _error, { key }) => [articleTag(key)],
    }),
    searchSolutions: build.query<SearchHit[], { q: string; limit?: number }>({
      query: ({ q, limit }) => ({
        url: "/v1/search/solutions",
        params: { q, ...(limit ? { limit: String(limit) } : {}) },
      }),
    }),
    ticketSolutions: build.query<SolutionsRail, string>({
      query: (ticketKey) => `/v1/tickets/${ticketKey}/solutions`,
      providesTags: (_result, _error, ticketKey) => [solutionsTag(ticketKey)],
    }),
    linkSolution: build.mutation<
      { id: string; article: { id: string; key: string; title: string } },
      { ticketKey: string; article_id: string; outcome?: "resolved_by" | "partially_resolved_by" }
    >({
      query: ({ ticketKey, ...body }) => ({ url: `/v1/tickets/${ticketKey}/solutions`, method: "POST", body }),
      invalidatesTags: (_result, _error, { ticketKey }) => [solutionsTag(ticketKey), { type: "Ticket", id: ticketKey }],
    }),
    articleCandidate: build.mutation<ArticleView, { ticketKey: string; title?: string; include_work_notes?: boolean }>({
      query: ({ ticketKey, ...body }) => ({ url: `/v1/tickets/${ticketKey}/article-candidate`, method: "POST", body }),
      invalidatesTags: (_result, _error, { ticketKey }) => [solutionsTag(ticketKey), "Articles"],
    }),
    catalogs: build.query<Catalogs, string | void>({
      query: (accountId) => ({ url: "/v1/catalogs", params: accountId ? { account_id: accountId } : {} }),
      providesTags: (_result, _error, accountId) => [{ type: "Catalogs", id: accountId || "default" }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListArticlesQuery,
  useGetArticleQuery,
  useCreateArticleMutation,
  useUpdateDraftMutation,
  useSubmitArticleMutation,
  usePublishArticleMutation,
  useRetireArticleMutation,
  useGeneralizeArticleMutation,
  useReplaceVisibilityMutation,
  useArticleFeedbackMutation,
  useSearchSolutionsQuery,
  useLazySearchSolutionsQuery,
  useTicketSolutionsQuery,
  useLinkSolutionMutation,
  useArticleCandidateMutation,
  useCatalogsQuery,
} = knowledgeApi;
