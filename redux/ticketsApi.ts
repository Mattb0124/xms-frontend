import type { Priority } from "@/components/xms/priority-pill";
import type { TicketType } from "@/components/xms/type-bar";
import { paramsToQuery, type TicketListParams } from "@/lib/tickets/queue-views";
import type { TicketSla } from "@/lib/tickets/sla";
import type { Level, PauseReason } from "@/lib/tickets/vocab";
import { xmsApi } from "@/redux/api";

/**
 * Ticket Management endpoints (technical spec section 4) and the
 * notification feed, injected into the base API. The transition mutation is
 * optimistic on the record and on every cached list, undone on any error
 * (the POC pattern with the error handling the audit found missing).
 */
export interface TicketRequester {
  id: string;
  email: string;
  display_name: string;
}

export interface TicketResolution {
  code: string | null;
  notes: string | null;
  solution_article_id: string | null;
  solution_candidate: boolean;
  time_exemption_reason: string | null;
}

export interface TicketView {
  id: string;
  key: string;
  account_id: string;
  type: TicketType;
  state: string;
  state_label: string;
  short_description: string;
  description: string | null;
  category: string | null;
  impact: Level | null;
  urgency: Level | null;
  priority: Priority;
  priority_overridden: boolean;
  source: string;
  requester: TicketRequester | null;
  group_id: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  contract_id: string;
  resolution: TicketResolution;
  external_refs: Record<string, unknown>;
  reopen_count: number;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  cancelled_at: string | null;
  sla: TicketSla;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface TicketStats {
  open: number;
  unassigned: number;
  breached: number;
  p1: number;
}

export interface TicketList {
  items: TicketView[];
  next_cursor: string | null;
  stats: TicketStats;
}

export interface CreateTicketBody {
  account_id: string;
  type: TicketType;
  short_description: string;
  description?: string;
  category?: string;
  impact?: Level;
  urgency?: Level;
  group_id?: string;
  assignee_id?: string;
  contract_id?: string;
  requester_email?: string;
  requester_name?: string;
}

export interface PatchTicketBody {
  version: number;
  short_description?: string;
  description?: string | null;
  category?: string | null;
  impact?: Level | null;
  urgency?: Level | null;
  priority?: Priority;
  group_id?: string | null;
  assignee_id?: string | null;
  contract_id?: string;
  external_refs?: Record<string, string>;
}

export interface ResolutionBody {
  code?: string;
  notes?: string;
  solution_article_id?: string;
  solution_candidate?: boolean;
  time_exemption_reason?: string;
}

export interface TransitionBody {
  version: number;
  to: string;
  pause_reason?: PauseReason;
  note?: string;
  resolution?: ResolutionBody;
}

export interface AllowedTransition {
  to: string;
  label: string;
  requires: string[];
  reopen: boolean;
}

export interface TransitionsResponse {
  from: string;
  transitions: AllowedTransition[];
}

export interface Message {
  id: string;
  ticket_id: string;
  author_kind: string;
  author_id: string;
  author_name: string;
  body: string;
  source: string;
  is_first_response?: boolean;
  created_at: string;
}

export interface TimelineItem {
  kind: "comment" | "work_note" | "audit" | "pause";
  id: string;
  actor_name: string | null;
  actor_kind?: string;
  body?: string;
  source?: string;
  is_first_response?: boolean;
  event_type?: string;
  field?: string | null;
  old_value?: unknown;
  new_value?: unknown;
  reason?: string;
  note?: string | null;
  started_at?: string;
  ended_at?: string | null;
  excluded_minutes?: number | null;
  created_at: string;
}

export interface TicketLink {
  id: string;
  type: "parent" | "related" | "duplicate" | "blocks";
  direction: "in" | "out";
  ticket: { id: string; key: string; short_description: string; state: string; priority: Priority };
}

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  target_kind: string;
  target_id: string;
  link: string | null;
  count: number;
  read_at: string | null;
  updated_at: string;
}

export interface GrantedAccount {
  id: string;
  key: string;
  name: string;
  status: string;
}

export interface DirectoryGroup {
  id: string;
  name: string;
  status?: string;
}

export interface Contract {
  id: string;
  key: string;
  name: string;
  model: string;
  status: string;
}

function ticketTag(key: string) {
  return { type: "Ticket" as const, id: key };
}

export const ticketsApi = xmsApi.injectEndpoints({
  endpoints: (build) => ({
    listTickets: build.query<TicketList, TicketListParams>({
      query: (params) => ({ url: "/v1/tickets", params: paramsToQuery(params) }),
      providesTags: (result) => ["Tickets", ...(result?.items ?? []).map((ticket) => ticketTag(ticket.key))],
    }),
    getTicket: build.query<TicketView, string>({
      query: (key) => `/v1/tickets/${key}`,
      providesTags: (_result, _error, key) => [ticketTag(key)],
    }),
    getTransitions: build.query<TransitionsResponse, string>({
      query: (key) => `/v1/tickets/${key}/transitions`,
      providesTags: (_result, _error, key) => [ticketTag(`${key}:transitions`)],
    }),
    createTicket: build.mutation<TicketView, CreateTicketBody>({
      query: (body) => ({ url: "/v1/tickets", method: "POST", body }),
      invalidatesTags: ["Tickets"],
    }),
    patchTicket: build.mutation<TicketView, { key: string; body: PatchTicketBody }>({
      query: ({ key, body }) => ({ url: `/v1/tickets/${key}`, method: "PATCH", body }),
      invalidatesTags: (_result, _error, { key }) => [ticketTag(key), ticketTag(`${key}:timeline`), "Tickets"],
    }),
    transitionTicket: build.mutation<TicketView, { key: string; body: TransitionBody; label?: string }>({
      query: ({ key, body }) => ({ url: `/v1/tickets/${key}/transitions`, method: "POST", body }),
      async onQueryStarted({ key, body, label }, { dispatch, queryFulfilled, getState }) {
        const patches = [
          dispatch(
            ticketsApi.util.updateQueryData("getTicket", key, (draft) => {
              draft.state = body.to;
              draft.state_label = label ?? draft.state_label;
            }),
          ),
        ];
        for (const args of ticketsApi.util.selectCachedArgsForQuery(getState(), "listTickets")) {
          patches.push(
            dispatch(
              ticketsApi.util.updateQueryData("listTickets", args, (draft) => {
                const row = draft.items.find((item) => item.key === key);
                if (row) {
                  row.state = body.to;
                  row.state_label = label ?? row.state_label;
                }
              }),
            ),
          );
        }
        try {
          await queryFulfilled;
        } catch {
          patches.forEach((patch) => patch.undo());
        }
      },
      invalidatesTags: (_result, _error, { key }) => [
        ticketTag(key),
        ticketTag(`${key}:transitions`),
        ticketTag(`${key}:timeline`),
        "Tickets",
      ],
    }),
    listComments: build.query<Message[], string>({
      query: (key) => `/v1/tickets/${key}/comments`,
      providesTags: (_result, _error, key) => [ticketTag(`${key}:timeline`)],
    }),
    addComment: build.mutation<Message, { key: string; body: string }>({
      query: ({ key, body }) => ({ url: `/v1/tickets/${key}/comments`, method: "POST", body: { body } }),
      invalidatesTags: (_result, _error, { key }) => [ticketTag(key), ticketTag(`${key}:timeline`)],
    }),
    addWorkNote: build.mutation<Message, { key: string; body: string }>({
      query: ({ key, body }) => ({ url: `/v1/tickets/${key}/work-notes`, method: "POST", body: { body } }),
      invalidatesTags: (_result, _error, { key }) => [ticketTag(`${key}:timeline`)],
    }),
    getTimeline: build.query<TimelineItem[], string>({
      query: (key) => `/v1/tickets/${key}/timeline`,
      providesTags: (_result, _error, key) => [ticketTag(`${key}:timeline`)],
    }),
    listLinks: build.query<TicketLink[], string>({
      query: (key) => `/v1/tickets/${key}/links`,
      providesTags: (_result, _error, key) => [ticketTag(`${key}:links`)],
    }),
    addLink: build.mutation<TicketLink[], { key: string; to_ticket_id: string; type: TicketLink["type"] }>({
      query: ({ key, to_ticket_id, type }) => ({
        url: `/v1/tickets/${key}/links`,
        method: "POST",
        body: { to_ticket_id, type },
      }),
      invalidatesTags: (_result, _error, { key }) => [ticketTag(`${key}:links`), ticketTag(`${key}:timeline`)],
    }),
    removeLink: build.mutation<void, { key: string; linkId: string }>({
      query: ({ key, linkId }) => ({ url: `/v1/tickets/${key}/links/${linkId}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, { key }) => [ticketTag(`${key}:links`), ticketTag(`${key}:timeline`)],
    }),
    watchTicket: build.mutation<{ muted: boolean }, { key: string; muted: boolean }>({
      query: ({ key, muted }) => ({ url: `/v1/tickets/${key}/watchers/me`, method: "PUT", body: { muted } }),
    }),

    listNotifications: build.query<NotificationRow[], { limit?: number } | void>({
      query: (params) => ({ url: "/v1/notifications", params: { limit: params?.limit ?? 20 } }),
      providesTags: ["Notifications"],
    }),
    unreadCount: build.query<{ count: number }, void>({
      query: () => "/v1/notifications/unread-count",
      providesTags: ["Notifications"],
    }),
    markNotificationRead: build.mutation<NotificationRow, string>({
      query: (id) => ({ url: `/v1/notifications/${id}/read`, method: "PATCH" }),
      invalidatesTags: ["Notifications"],
    }),
    markAllNotificationsRead: build.mutation<{ updated: number }, void>({
      query: () => ({ url: "/v1/notifications/read-all", method: "POST" }),
      invalidatesTags: ["Notifications"],
    }),

    listGrantedAccounts: build.query<GrantedAccount[], void>({
      query: () => "/v1/accounts",
      providesTags: [{ type: "Accounts", id: "granted" }],
    }),
    listDirectoryGroups: build.query<DirectoryGroup[], void>({
      query: () => "/v1/groups",
      providesTags: ["Groups"],
    }),
    listAccountContracts: build.query<Contract[], string>({
      query: (accountId) => `/v1/accounts/${accountId}/contracts`,
      providesTags: (_result, _error, accountId) => [{ type: "Account", id: `${accountId}:contracts` }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListTicketsQuery,
  useLazyListTicketsQuery,
  useGetTicketQuery,
  useGetTransitionsQuery,
  useCreateTicketMutation,
  usePatchTicketMutation,
  useTransitionTicketMutation,
  useListCommentsQuery,
  useAddCommentMutation,
  useAddWorkNoteMutation,
  useGetTimelineQuery,
  useListLinksQuery,
  useAddLinkMutation,
  useRemoveLinkMutation,
  useWatchTicketMutation,
  useListNotificationsQuery,
  useUnreadCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useListGrantedAccountsQuery,
  useListDirectoryGroupsQuery,
  useListAccountContractsQuery,
} = ticketsApi;
