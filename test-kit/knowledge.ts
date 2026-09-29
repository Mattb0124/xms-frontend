import type { ArticleView } from "@/redux/knowledgeApi";

/** Constructed knowledge article fixtures, shared by every test that reads one. */

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
