import { xmsApi } from "@/redux/api";

/**
 * Client portal endpoints (Client Portal technical spec section 4, the
 * /v1/portal mirror). The portal view model deliberately carries no
 * assignee, SLA, contract or work note; nothing here may widen it.
 */
export type PortalTicketType = "incident" | "service_request";
export type PortalLevel = "high" | "medium" | "low";

export interface PortalTicket {
  id: string;
  key: string;
  type: PortalTicketType | "change" | "problem" | "project_task";
  state: string;
  state_label: string;
  short_description: string;
  description: string | null;
  category: string | null;
  priority: "p1" | "p2" | "p3" | "p4";
  requester: { display_name: string } | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  closed_at: string | null;
  version: number;
}

export interface PortalMe {
  principal: {
    kind: "portal";
    userId: string;
    email: string;
    displayName: string;
    permissions: string[];
  };
  account: { id: string; key: string; name: string; branding: Record<string, unknown> } | null;
}

export interface PortalTimelineItem {
  kind: "comment" | "attachment" | "state_change";
  item_id: string;
  actor_name: string | null;
  body: string | null;
  file_name: string | null;
  from_state: string | null;
  to_state: string | null;
  created_at: string;
}

export interface PortalTransition {
  to: string;
  label: string;
  requires: string[];
  reopen: boolean;
}

export interface PortalListParams {
  scope?: "open" | "all" | "mine";
  q?: string;
}

export interface CreatePortalTicketBody {
  type: PortalTicketType;
  short_description: string;
  description?: string;
  category?: string;
  impact?: PortalLevel;
  urgency?: PortalLevel;
}

export interface PortalComment {
  id: string;
  body: string;
  author_name: string;
  source: string;
  created_at: string;
}

/** Placeholder until the knowledge base ships: the screens are wired, the list is empty. */
export interface PortalArticle {
  id: string;
  title: string;
  summary: string;
}

function listQuery(params: PortalListParams): string {
  const search = new URLSearchParams();
  if (params.scope) search.set("scope", params.scope);
  if (params.q) search.set("q", params.q);
  const query = search.toString();
  return `/v1/portal/tickets${query ? `?${query}` : ""}`;
}

export const portalApi = xmsApi.injectEndpoints({
  endpoints: (build) => ({
    portalMe: build.query<PortalMe, void>({
      query: () => "/v1/portal/me",
      providesTags: ["PortalMe"],
    }),
    portalTickets: build.query<{ items: PortalTicket[]; next_cursor: string | null }, PortalListParams>({
      query: (params) => listQuery(params),
      providesTags: (result) => [
        "PortalTickets",
        ...(result?.items.map((item) => ({ type: "PortalTicket" as const, id: item.key })) ?? []),
      ],
    }),
    portalTicket: build.query<PortalTicket, string>({
      query: (key) => `/v1/portal/tickets/${encodeURIComponent(key)}`,
      providesTags: (_result, _error, key) => [{ type: "PortalTicket", id: key }],
    }),
    portalTimeline: build.query<PortalTimelineItem[], string>({
      query: (key) => `/v1/portal/tickets/${encodeURIComponent(key)}/timeline`,
      providesTags: (_result, _error, key) => [{ type: "PortalTimeline", id: key }],
    }),
    portalTransitions: build.query<{ from: string; transitions: PortalTransition[] }, string>({
      query: (key) => `/v1/portal/tickets/${encodeURIComponent(key)}/transitions`,
      providesTags: (_result, _error, key) => [{ type: "PortalTicket", id: key }],
    }),
    createPortalTicket: build.mutation<PortalTicket, CreatePortalTicketBody>({
      query: (body) => ({ url: "/v1/portal/tickets", method: "POST", body }),
      invalidatesTags: ["PortalTickets"],
    }),
    addPortalComment: build.mutation<PortalComment, { key: string; body: string }>({
      query: ({ key, body }) => ({
        url: `/v1/portal/tickets/${encodeURIComponent(key)}/comments`,
        method: "POST",
        body: { body },
      }),
      invalidatesTags: (_result, _error, { key }) => [
        { type: "PortalTimeline", id: key },
        { type: "PortalTicket", id: key },
      ],
    }),
    portalTransition: build.mutation<PortalTicket, { key: string; version: number; to: string }>({
      query: ({ key, version, to }) => ({
        url: `/v1/portal/tickets/${encodeURIComponent(key)}/transitions`,
        method: "POST",
        body: { version, to },
      }),
      invalidatesTags: (_result, _error, { key }) => [
        { type: "PortalTicket", id: key },
        { type: "PortalTimeline", id: key },
        "PortalTickets",
      ],
    }),
    /** GET /v1/portal/knowledge?q= lands with the knowledge base; until then the list is empty. */
    searchArticles: build.query<PortalArticle[], string>({
      queryFn: async () => ({ data: [] }),
    }),
  }),
});

export const {
  usePortalMeQuery,
  usePortalTicketsQuery,
  usePortalTicketQuery,
  usePortalTimelineQuery,
  usePortalTransitionsQuery,
  useCreatePortalTicketMutation,
  useAddPortalCommentMutation,
  usePortalTransitionMutation,
  useSearchArticlesQuery,
} = portalApi;
