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
  /** Whether the reader follows this ticket (unmuted watcher); record reads only. */
  watching?: boolean;
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

/** How a contract handles a non-standard after-hours class (TB-13): a premium multiplier, comp time, or nothing. */
export type AfterHoursHandling = "premium_rate" | "comp_time" | "none";

/** What happens when an entry would take the period past its budget (Time & Budget 5.4, TB-11). */
export type OverageRule = "block" | "allow_flag" | "allow_rate";

/** What happens to unused hours at period end (Time & Budget 5.4). */
export type RolloverRule = "none" | "carry_month" | "carry_term" | "cap";

/**
 * The commercial envelope a contract sits inside (Time, Contracts & Budget
 * technical 2.1): active until the renewal date is inside the widest lead
 * window, expiring inside it, ended once it has passed. The server decides
 * the status and fires the renewal alerts; the browser renders them.
 */
export type EngagementStatus = "active" | "expiring" | "ended";

export interface Engagement {
  id: string;
  account_id: string;
  name: string;
  owner_user_id: string | null;
  /** ISO date, or null when the engagement has no renewal to plan for. */
  renewal_date: string | null;
  /** Days before the renewal date by which a decision must already be made. */
  notice_period_days: number | null;
  status: EngagementStatus;
  /** The lead times already alerted on (90, 60, 30) and 0 for the notice boundary. */
  renewal_alerts_fired: number[];
  created_at: string;
  updated_at: string;
  version: number;
}

export interface CreateEngagementBody {
  name: string;
  owner_user_id?: string | null;
  renewal_date?: string | null;
  notice_period_days?: number | null;
}

/** PATCH body: the version the screen holds plus the fields to change (contracts:manage). */
export interface PatchEngagementBody extends CreateEngagementBody {
  version: number;
  /** Sent only when a person sets it by hand; otherwise a moved renewal date decides it. */
  status?: EngagementStatus;
}

export interface Contract {
  id: string;
  key: string;
  name: string;
  model: string;
  status: string;
  currency: string;
  /** The engagement this contract is filed under (technical 2.1); null until one is chosen. */
  engagement_id: string | null;
  after_hours_handling: AfterHoursHandling;
  /** Numeric as a string ("1.500") under premium_rate; null otherwise. */
  after_hours_multiplier: string | null;
  /** Budget rules (Time & Budget 5.4 to 5.6): thresholds in percent, overage, rollover and the forecast window. */
  threshold_percents: number[];
  threshold_notify_client: boolean;
  overage_rule: OverageRule;
  /** Numeric as a string under allow_rate; null otherwise. */
  overage_multiplier: string | null;
  rollover_rule: RolloverRule;
  /** Numeric as a string under cap; null otherwise. */
  rollover_cap_hours: string | null;
  /** Business days of run rate behind the forecast (default 10). */
  forecast_window_days: number;
  /** Skill codes the contract requires (CAP-07): the account lens of the skills matrix reads them. */
  technology_codes: string[];
  version: number;
}

/** PATCH body: the version the screen holds plus the rule fields to change (contracts:manage). */
export interface PatchContractBody {
  version: number;
  /** The engagement on this account the contract is filed under; null files it under none. */
  engagement_id?: string | null;
  after_hours_handling?: AfterHoursHandling;
  after_hours_multiplier?: number | null;
  threshold_percents?: number[];
  threshold_notify_client?: boolean;
  overage_rule?: OverageRule;
  overage_multiplier?: number | null;
  rollover_rule?: RolloverRule;
  rollover_cap_hours?: number | null;
  forecast_window_days?: number;
  /** Lower-case codes matching ^[a-z0-9][a-z0-9_.-]{0,59}$, up to 50; the server deduplicates. */
  technology_codes?: string[];
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
    /** Engagements on one account (contracts:view to read, contracts:manage to write). */
    listEngagements: build.query<Engagement[], string>({
      query: (accountId) => `/v1/accounts/${accountId}/engagements`,
      providesTags: (_result, _error, accountId) => [{ type: "Account", id: `${accountId}:engagements` }],
    }),
    createEngagement: build.mutation<Engagement, { accountId: string; body: CreateEngagementBody }>({
      query: ({ accountId, body }) => ({ url: `/v1/accounts/${accountId}/engagements`, method: "POST", body }),
      invalidatesTags: (_result, error, { accountId }) =>
        error ? [] : [{ type: "Account", id: `${accountId}:engagements` }],
    }),
    /**
     * A refused patch reloads the list too, so a stale version shows the row
     * as it now stands rather than leaving the screen holding the old one.
     */
    patchEngagement: build.mutation<Engagement, { accountId: string; engagementId: string; body: PatchEngagementBody }>(
      {
        query: ({ accountId, engagementId, body }) => ({
          url: `/v1/accounts/${accountId}/engagements/${engagementId}`,
          method: "PATCH",
          body,
        }),
        invalidatesTags: (_result, _error, { accountId }) => [{ type: "Account", id: `${accountId}:engagements` }],
      },
    ),
    patchContract: build.mutation<Contract, { accountId: string; contractId: string; body: PatchContractBody }>({
      query: ({ accountId, contractId, body }) => ({
        url: `/v1/accounts/${accountId}/contracts/${contractId}`,
        method: "PATCH",
        body,
      }),
      // Only a saved change refreshes the list; a refused one leaves the screen to reload on stale_version.
      invalidatesTags: (_result, error, { accountId, contractId }) =>
        error
          ? []
          : [
              { type: "Account", id: `${accountId}:contracts` },
              { type: "Position", id: contractId },
              { type: "Budget", id: accountId },
              // The required technologies feed the account lens of the skills matrix.
              "SkillsMatrix",
            ],
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
  usePatchContractMutation,
  useListEngagementsQuery,
  useCreateEngagementMutation,
  usePatchEngagementMutation,
} = ticketsApi;
