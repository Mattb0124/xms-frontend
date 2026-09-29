import { xmsApi } from "@/redux/api";

/**
 * The Axel adapter endpoints (AI functionality technical spec section 4):
 * suggestions and their decisions, feedback, the panel's thread list, the
 * per-account AI settings, the accuracy report and the operator defaults.
 * The interactive turn is not here; it streams through lib/axel/sse.ts.
 */
export const AI_CAPABILITIES = [
  "classify",
  "prioritise",
  "duplicate",
  "summarise",
  "draft_reply",
  "wsr_narrative",
  "time_entry",
  "burn_anomaly",
] as const;
export type AiCapability = (typeof AI_CAPABILITIES)[number];

/** The capabilities the desk can request today; the rest are catalogued and off. */
export const CUT_CAPABILITIES = ["classify", "prioritise", "duplicate", "summarise", "draft_reply"] as const;
export type CutCapability = (typeof CUT_CAPABILITIES)[number];

export const WITHHELD_REASONS = [
  "below_threshold",
  "switch_off",
  "capability_off",
  "residency",
  "redaction_refused",
  "unavailable",
  "no_content",
  "schema_error",
] as const;
export type WithheldReason = (typeof WITHHELD_REASONS)[number];

export type AiDecisionKind = "accepted" | "edited_accepted" | "rejected" | "expired" | "auto_applied";
export type UserDecision = "accepted" | "edited_accepted" | "rejected";

export const REJECT_REASONS = ["wrong", "unnecessary", "already_done", "unclear", "other"] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

export type Level = "high" | "medium" | "low";

export interface ClassifyPayload {
  category: string;
  ticket_type?: "incident" | "service_request" | "change" | "problem" | "project_task";
  ci_ids: string[];
  reasons: Record<string, string>;
  confidence: number;
  field_confidence?: Record<string, number>;
}

export interface PrioritisePayload {
  impact: Level;
  urgency: Level;
  priority?: "p1" | "p2" | "p3" | "p4";
  reason: string;
  confidence: number;
}

export interface DuplicateCandidate {
  ticket_id: string;
  similarity: number;
  reason: string;
}

export interface DuplicatePayload {
  candidates: DuplicateCandidate[];
  merge_into: string | null;
  confidence: number;
}

export interface SummarisePayload {
  situation: string;
  done: string;
  waiting_on: string;
  next_step: string;
  risks: string;
  sources: { comments: number; work_notes: number; events: number };
}

export interface DraftReplyPayload {
  text: string;
  citations: Array<{ article_version_id: string }>;
  tone: "plain" | "formal";
}

export interface DecisionRow {
  id: string;
  account_id: string;
  suggestion_id: string;
  decision: AiDecisionKind;
  decided_by_kind: "user" | "system";
  decided_by_id: string;
  applied_payload: Record<string, unknown> | null;
  edit_distance: number | null;
  reject_reason: string | null;
  audit_event_id: string | null;
  policy_version: string | null;
  created_at: string;
}

export interface SuggestionView {
  id: string;
  capability: AiCapability;
  target_kind: "ticket" | "report_run" | "person_day" | "contract_period" | "queue_query";
  target_id: string;
  status: "offered" | "withheld";
  withheld_reason: WithheldReason | null;
  payload: Record<string, unknown>;
  confidence: number | null;
  agent_id: string;
  prompt_version: string;
  model_id: string;
  thread_id: string | null;
  expires_at: string | null;
  created_at: string;
  decision?: DecisionRow | null;
  /** The agent's explanation without the proposal block; only on a fresh answer. */
  explanation?: string;
}

export interface SuggestBody {
  capability: CutCapability;
  target_kind: "ticket";
  target_id: string;
  instruction?: string;
}

export interface DecisionBody {
  decision: UserDecision;
  applied_payload?: Record<string, unknown>;
  reject_reason?: RejectReason;
}

export interface DecisionResult {
  suggestion: SuggestionView;
  decision: DecisionRow;
}

export interface FeedbackBody {
  rating: number;
  comment?: string;
}

export interface AxelThread {
  id: string;
  account_id: string;
  ticket_id: string | null;
  user_id: string;
  agent_id: string;
  thread_id: string;
  title: string | null;
  created_at: string;
  last_turn_at: string;
}

export interface CapabilitySetting {
  enabled: boolean;
  /** Confidence below this is withheld; 0 for free-text capabilities. */
  threshold: number;
  auto_apply: boolean;
  auto_min: number;
  expires_minutes: number;
}

export type EffectiveReason = "switch_off" | "residency" | "kill_switch";

export interface AiSettingsView {
  account_id: string;
  enabled: boolean;
  dpa_reference: string | null;
  residency_region: string;
  redaction_profile: "standard" | "strict";
  draft_tone: "plain" | "formal";
  capabilities: Record<AiCapability, CapabilitySetting>;
  auto_apply_approval_ref: string | null;
  version: number;
  /** Why the switch is not effective right now, when it is not. */
  effective: { on: boolean; reason?: EffectiveReason };
}

/** The changed fields plus the version the screen saw. */
export interface AiSettingsPatch {
  enabled?: boolean;
  dpa_reference?: string | null;
  residency_region?: string;
  redaction_profile?: "standard" | "strict";
  draft_tone?: "plain" | "formal";
  capabilities?: Partial<Record<AiCapability, Partial<CapabilitySetting>>>;
  auto_apply_approval_ref?: string | null;
  version: number;
}

export interface AccuracyQuery {
  account?: string;
  capability?: AiCapability;
  from?: string;
  to?: string;
  threshold?: number;
}

export interface AccuracyRow {
  capability: AiCapability;
  offered: number;
  withheld: number;
  accepted: number;
  edited_accepted: number;
  rejected: number;
  auto_applied: number;
  expired: number;
  open: number;
  withheld_reasons: Partial<Record<WithheldReason, number>> | null;
  acceptance_rate: number | null;
  what_if: { withheld: number; acceptance_rate: number | null } | null;
}

export interface AccuracyReport {
  from: string;
  to: string;
  threshold: number | null;
  capabilities: AccuracyRow[];
}

export interface AiDefaultsBody {
  kill_switch: boolean;
  harness_regions: string[];
  agents: Record<AiCapability, string>;
  capabilities: Record<AiCapability, CapabilitySetting>;
}

export interface ConfigVersion<T = unknown> {
  id: string;
  kind: string;
  scope_key: string;
  version: number;
  body: T;
  status: "draft" | "active" | "retired";
  activated_at: string | null;
  activated_by: string | null;
  created_at: string;
}

export interface AiDefaultsView {
  active?: ConfigVersion<AiDefaultsBody>;
  versions: ConfigVersion[];
}

function suggestionTags(targetId: string) {
  return [
    { type: "Suggestions" as const, id: `ticket:${targetId}` },
    { type: "Suggestions" as const, id: `ticket:${targetId}:history` },
  ];
}

function definedParams<T extends Record<string, unknown>>(params: T): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") out[key] = value as string | number;
  }
  return out;
}

export const aiApi = xmsApi.injectEndpoints({
  endpoints: (build) => ({
    /** Open suggestions on a ticket, one per capability. */
    openSuggestions: build.query<SuggestionView[], string>({
      query: (targetId) => ({ url: "/v1/axel/suggestions", params: { target_kind: "ticket", target_id: targetId } }),
      providesTags: (_result, _error, targetId) => [{ type: "Suggestions", id: `ticket:${targetId}` }],
    }),
    /** Every suggestion on a ticket with its decision. */
    suggestionHistory: build.query<SuggestionView[], string>({
      query: (targetId) => ({
        url: "/v1/axel/suggestions",
        params: { target_kind: "ticket", target_id: targetId, history: "true" },
      }),
      providesTags: (_result, _error, targetId) => [{ type: "Suggestions", id: `ticket:${targetId}:history` }],
    }),
    /** A single-shot suggestion on demand; a withheld answer is a 201 too. */
    suggest: build.mutation<SuggestionView, SuggestBody>({
      query: (body) => ({ url: "/v1/axel/suggest", method: "POST", body }),
      invalidatesTags: (_result, _error, { target_id }) => suggestionTags(target_id),
    }),
    decide: build.mutation<DecisionResult, { id: string; targetId: string; ticketKey?: string; body: DecisionBody }>({
      query: ({ id, body }) => ({ url: `/v1/axel/suggestions/${id}/decisions`, method: "POST", body }),
      invalidatesTags: (_result, _error, { targetId, ticketKey }) => [
        ...suggestionTags(targetId),
        ...(ticketKey
          ? [
              { type: "Ticket" as const, id: ticketKey },
              { type: "Ticket" as const, id: `${ticketKey}:timeline` },
              { type: "Ticket" as const, id: `${ticketKey}:links` },
              "Tickets" as const,
            ]
          : []),
      ],
    }),
    feedback: build.mutation<{ id: string }, { id: string; body: FeedbackBody }>({
      query: ({ id, body }) => ({ url: `/v1/axel/suggestions/${id}/feedback`, method: "POST", body }),
    }),
    axelThreads: build.query<AxelThread[], string>({
      query: (ticketId) => ({ url: "/v1/axel/threads", params: { ticket: ticketId } }),
      providesTags: (_result, _error, ticketId) => [{ type: "AiThreads", id: ticketId }],
    }),
    aiSettings: build.query<AiSettingsView, string>({
      query: (accountId) => `/v1/accounts/${accountId}/ai-settings`,
      providesTags: (_result, _error, accountId) => [{ type: "AiSettings", id: accountId }],
    }),
    updateAiSettings: build.mutation<AiSettingsView, { id: string; body: AiSettingsPatch }>({
      query: ({ id, body }) => ({ url: `/v1/accounts/${id}/ai-settings`, method: "PUT", body }),
      invalidatesTags: (_result, _error, { id }) => [{ type: "AiSettings", id }],
    }),
    aiAccuracy: build.query<AccuracyReport, AccuracyQuery>({
      query: (query) => ({ url: "/v1/axel/accuracy", params: definedParams({ ...query }) }),
      providesTags: ["AiAccuracy"],
    }),
    aiDefaults: build.query<AiDefaultsView, void>({
      query: () => "/v1/axel/config/defaults",
      providesTags: ["AiDefaults"],
    }),
    updateAiDefaults: build.mutation<ConfigVersion, AiDefaultsBody>({
      query: (body) => ({ url: "/v1/axel/config/defaults", method: "PUT", body: { body } }),
      invalidatesTags: ["AiDefaults", "AiSettings", "AiAccuracy"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useOpenSuggestionsQuery,
  useSuggestionHistoryQuery,
  useSuggestMutation,
  useDecideMutation,
  useFeedbackMutation,
  useAxelThreadsQuery,
  useAiSettingsQuery,
  useUpdateAiSettingsMutation,
  useAiAccuracyQuery,
  useAiDefaultsQuery,
  useUpdateAiDefaultsMutation,
} = aiApi;
