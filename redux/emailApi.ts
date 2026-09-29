import { xmsApi } from "@/redux/api";

/**
 * Email intake and outbound (Email Intake & Outbound technical 4): the per
 * ticket thread, the raw message download, the quarantine queue and the
 * account aliases. Bodies never reach the browser except the stripped text
 * of a quarantined message the reviewer must judge.
 */
export type Disposition = "created" | "appended" | "quarantined" | "suppressed" | "rejected";
export type MatchedBy = "plus_token" | "in_reply_to" | "references" | "subject_key";
export type DeliveryState = "queued" | "sent" | "delivered" | "bounced" | "complained" | "failed";

export interface InboundMessage {
  id: string;
  message_id: string;
  from_address: string;
  from_name: string;
  subject: string;
  received_at: string;
  sender_resolution: "known_contact" | "known_internal" | "portal_user" | "unknown";
  disposition: Disposition;
  matched_by: MatchedBy | null;
  loop_score: number;
  loop_signals: string[];
  attachment_count: number;
  comment_id: string | null;
}

export interface OutboundMessage {
  id: string;
  kind: string;
  message_id: string;
  from_address: string;
  to_addresses: string[];
  subject: string;
  created_at: string;
  state: DeliveryState | null;
}

export interface TicketEmail {
  inbound: InboundMessage[];
  outbound: OutboundMessage[];
}

export type QuarantineReason = "unknown_sender" | "suspicious_content" | "scan_quarantined" | "unsupported_content";
export type QuarantineDecision = "create_contact_and_ticket" | "create_ticket_once" | "discard" | "mark_spam";

export interface QuarantineItem {
  id: string;
  reason: QuarantineReason;
  state: "open" | "decided" | "expired";
  decision: QuarantineDecision | null;
  from_address: string;
  from_name: string;
  subject: string;
  received_at: string;
  stripped_body_text: string;
  created_at: string;
  resulting_ticket_id: string | null;
}

export type AliasState = "active" | "disabled_by_admin" | "disabled_by_loop_guard";

export interface InboundAlias {
  id: string;
  address: string;
  kind: "canonical" | "alias";
  default_ticket_type: string | null;
  state: AliasState;
  disabled_reason: string | null;
  disabled_at: string | null;
}

export interface CreateAliasBody {
  address: string;
  kind?: "canonical" | "alias";
  default_ticket_type?: string;
}

const emailTag = (key: string) => ({ type: "Email" as const, id: key });
const aliasesTag = (accountId: string) => ({ type: "Aliases" as const, id: accountId });

export const emailApi = xmsApi.injectEndpoints({
  endpoints: (build) => ({
    getTicketEmail: build.query<TicketEmail, string>({
      query: (key) => `/v1/tickets/${key}/email`,
      providesTags: (_result, _error, key) => [emailTag(key)],
    }),
    getInboundRaw: build.query<{ url: string }, string>({
      query: (id) => `/v1/email/inbound/${id}/raw`,
      keepUnusedDataFor: 0,
    }),
    listQuarantine: build.query<QuarantineItem[], { state: "open" | "decided" }>({
      query: ({ state }) => `/v1/quarantine?state=${state}`,
      providesTags: ["Quarantine"],
    }),
    decideQuarantine: build.mutation<
      QuarantineItem & { ticket_key: string | null },
      { id: string; decision: QuarantineDecision }
    >({
      query: ({ id, decision }) => ({ url: `/v1/quarantine/${id}/decide`, method: "POST", body: { decision } }),
      invalidatesTags: ["Quarantine", "Tickets"],
    }),
    listAliases: build.query<InboundAlias[], string>({
      query: (accountId) => `/v1/admin/accounts/${accountId}/aliases`,
      providesTags: (_result, _error, accountId) => [aliasesTag(accountId)],
    }),
    createAlias: build.mutation<InboundAlias, { accountId: string; body: CreateAliasBody }>({
      query: ({ accountId, body }) => ({ url: `/v1/admin/accounts/${accountId}/aliases`, method: "POST", body }),
      invalidatesTags: (_result, _error, { accountId }) => [aliasesTag(accountId)],
    }),
    setAliasState: build.mutation<InboundAlias, { accountId: string; id: string; enable: boolean }>({
      query: ({ id, enable }) => ({ url: `/v1/admin/aliases/${id}/${enable ? "enable" : "disable"}`, method: "POST" }),
      invalidatesTags: (_result, _error, { accountId }) => [aliasesTag(accountId)],
    }),
  }),
});

export const {
  useGetTicketEmailQuery,
  useLazyGetInboundRawQuery,
  useListQuarantineQuery,
  useDecideQuarantineMutation,
  useListAliasesQuery,
  useCreateAliasMutation,
  useSetAliasStateMutation,
} = emailApi;
