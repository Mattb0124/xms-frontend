import type { ConflictOutcome, OutboundEvent, OutboundStatus, SyncCardOutbound } from "@/lib/connectors/outbound";
import type {
  ConnectorHealth,
  ConnectorMode,
  Direction,
  KillSwitchState,
  LinkState,
  MapState,
  RunDirection,
  RunOutcome,
  SystemOfRecord,
  XmsField,
} from "@/lib/connectors/vocab";
import { xmsApi } from "@/redux/api";

/**
 * Connector administration and the ticket Sync card (ServiceNow Sync
 * technical section 4; P2.21.4). Instances come from two routes: the account
 * list and the cross-account health list; there is no single-instance read,
 * so the record screen selects its instance out of the health list and every
 * instance mutation invalidates `Connectors`. Maps, runs and dead letters
 * carry the instance id in their tag so one instance refreshes at a time, and
 * so does the outbound queue. The credential is sent once on create and never
 * returned.
 */
export interface ErrorTripThreshold {
  ratio: number;
  window_minutes: number;
  min_attempts: number;
}

export interface ConnectorInstance {
  id: string;
  account_id: string;
  type: string;
  name: string;
  base_url: string;
  auth_kind: "basic" | "oauth_client_credentials";
  credential_state: "unknown" | "valid" | "invalid";
  table_name: string;
  profile: "csm" | "itsm";
  mode: ConnectorMode;
  kill_switch: KillSwitchState;
  trip_reason: string | null;
  tripped_at: string | null;
  tripped_by: string | null;
  poll_interval_seconds: number;
  next_poll_at: string;
  inbound_watermark: string;
  active_field_map_id: string | null;
  active_state_map_id: string | null;
  journal_public: string;
  sync_work_notes: boolean;
  attachment_limit_bytes: number;
  attachment_over_limit: "link" | "skip";
  error_trip_threshold: ErrorTripThreshold;
  health: ConnectorHealth;
  last_success_at: string | null;
  last_error_at: string | null;
  last_error: string | null;
  version: number;
  has_credential: boolean;
}

export interface ConnectorHealthRow extends ConnectorInstance {
  pending_inbox: number;
  open_dead_letters: number;
  inbound_lag_seconds: number;
  /**
   * The outbound backlog beside the ingest figures (functional 5.4). The
   * health route and the instance route both answer them now, so the health
   * list draws the columns unconditionally. They stay optional in the type
   * for the older API a rolling deploy can still be talking to, and the list
   * prints a blank in that case rather than a zero it did not read.
   */
  pending_outbound?: number;
  dead_lettered_outbound?: number;
}

export interface CreateServiceNowBody {
  name: string;
  base_url: string;
  auth_kind: "basic" | "oauth_client_credentials";
  credential: { username?: string; password?: string; client_id?: string; client_secret?: string };
  table_name?: string;
  profile?: "csm" | "itsm";
  poll_interval_seconds?: number;
}

export interface UpdateConnectorBody {
  version: number;
  name?: string;
  mode?: ConnectorMode;
  poll_interval_seconds?: number;
  journal_public?: string;
  sync_work_notes?: boolean;
  attachment_limit_bytes?: number;
  attachment_over_limit?: "link" | "skip";
  error_trip_threshold?: ErrorTripThreshold;
  table_name?: string;
}

export interface TestConnectionResult {
  ok: boolean;
  fields?: number;
  error?: string;
  latency_ms: number;
}

export interface DictionaryField {
  name: string;
  mandatory?: boolean;
  type?: string;
  label?: string;
}

export interface SamplesResult {
  records: Record<string, unknown>[];
  dictionary: DictionaryField[];
}

export type Transform =
  | { kind: "none" }
  | { kind: "lookup"; values: Record<string, string>; fallback?: string }
  | { kind: "template"; template: string }
  | { kind: "truncate"; length: number };

export interface FieldMapEntry {
  external: string;
  xms: XmsField;
  direction: Direction;
  transform?: Transform;
  sor?: SystemOfRecord;
}

export interface StateMapForType {
  inbound: Record<string, string>;
  outbound: Record<string, string>;
  accept_inbound?: string[];
  fallback?: Record<string, string>;
}

export type StateMapEntries = Record<string, StateMapForType>;

export interface ValidationReport {
  ok: boolean;
  problems: string[];
  warnings: string[];
  checked_samples: number;
}

export interface MapRow<Entries> {
  id: string;
  account_id: string;
  instance_id: string;
  version: number;
  state: MapState;
  entries: Entries;
  validation_report: ValidationReport | null;
  samples?: Record<string, unknown>[] | null;
  created_by: string;
  created_at: string;
  activated_at: string | null;
  activated_by: string | null;
}

export type FieldMapRow = MapRow<FieldMapEntry[]>;
export type StateMapRow = MapRow<StateMapEntries>;
export type MapKind = "field" | "state";

export interface WatermarkResult {
  preview: boolean;
  to: string;
  records: number;
}

export interface SyncRun {
  id: string;
  direction: RunDirection;
  ticket_id: string | null;
  external_sys_id: string | null;
  inbox_id: string | null;
  attempt: number;
  outcome: RunOutcome;
  error_class: "retryable" | "terminal" | null;
  error_text: string | null;
  duration_ms: number | null;
  detail: Record<string, unknown> | null;
  created_at: string;
}

export interface RunsFilter {
  id: string;
  direction?: RunDirection;
  outcome?: RunOutcome;
  from?: string;
  to?: string;
  limit?: number;
}

export type DeadLetterResolution = "open" | "replayed" | "discarded";

export interface DeadLetter {
  id: string;
  queue: string;
  error: string;
  attempts: number;
  first_failed_at: string;
  last_failed_at: string;
  resolution: DeadLetterResolution;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_reason: string | null;
  payload: Record<string, unknown>;
}

export interface DeadLetterActionResult {
  results: { id: string; outcome: string }[];
}

/**
 * One row of `acct.sync_outbound`: an XMS change on its way to one instance,
 * with the attempts, the backoff and the conflict outcome the worker settled
 * it with. `ticket_key` is the list route's join, null while the ticket is
 * gone.
 */
export interface OutboundRow {
  id: string;
  account_id: string;
  instance_id: string;
  ticket_id: string;
  ticket_key: string | null;
  link_id: string;
  event: OutboundEvent;
  outbox_id: string | null;
  payload: Record<string, unknown>;
  origin: string;
  correlation_id: string | null;
  status: OutboundStatus;
  attempts: number;
  next_attempt_at: string;
  last_error: string | null;
  conflict: ConflictOutcome | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RetryOutboundResult {
  id: string;
  outcome: "requeued" | "already_pending";
}

export interface SyncConflict {
  fields?: string[];
  at?: string;
  sys_updated_on?: string;
  [key: string]: unknown;
}

export interface TicketSyncLink {
  id?: string;
  external_number: string;
  external_sys_id: string;
  state: LinkState;
  last_inbound_at: string | null;
  last_outbound_at?: string | null;
  last_conflict: SyncConflict | null;
  /** What has and has not reached this instance for this ticket (functional 5.3). */
  outbound?: SyncCardOutbound;
  instance_name: string;
  base_url: string;
  table_name: string;
  mode: ConnectorMode;
  health: ConnectorHealth;
}

export interface TicketSync {
  links: TicketSyncLink[];
  runs: SyncRun[];
}

const mapsPath = (kind: MapKind) => (kind === "field" ? "field-maps" : "state-maps");

export const connectorsApi = xmsApi.injectEndpoints({
  endpoints: (build) => ({
    listConnectors: build.query<ConnectorInstance[], string>({
      query: (accountId) => `/v1/accounts/${accountId}/connectors`,
      providesTags: (result, _error, accountId) => [
        { type: "Connectors", id: `account:${accountId}` },
        ...(result ?? []).map((row) => ({ type: "Connectors" as const, id: row.id })),
      ],
    }),
    createServiceNowInstance: build.mutation<ConnectorInstance, { accountId: string; body: CreateServiceNowBody }>({
      query: ({ accountId, body }) => ({
        url: `/v1/accounts/${accountId}/connectors/servicenow`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { accountId }) => [
        { type: "Connectors", id: `account:${accountId}` },
        { type: "Connectors", id: "health" },
      ],
    }),
    connectorHealth: build.query<ConnectorHealthRow[], void>({
      query: () => "/v1/connectors/health",
      providesTags: (result) => [
        { type: "Connectors", id: "health" },
        ...(result ?? []).map((row) => ({ type: "Connectors" as const, id: row.id })),
      ],
    }),
    updateConnector: build.mutation<ConnectorInstance, { id: string; body: UpdateConnectorBody }>({
      query: ({ id, body }) => ({ url: `/v1/connectors/${id}`, method: "PATCH", body }),
      invalidatesTags: (_result, _error, { id }) => [{ type: "Connectors", id }],
    }),
    testConnection: build.mutation<TestConnectionResult, string>({
      query: (id) => ({ url: `/v1/connectors/${id}/test-connection`, method: "POST" }),
      invalidatesTags: (_result, _error, id) => [{ type: "Connectors", id }],
    }),
    loadSamples: build.mutation<SamplesResult, { id: string; map_id?: string }>({
      query: ({ id, map_id }) => ({
        url: `/v1/connectors/${id}/samples`,
        method: "POST",
        body: map_id ? { map_id } : {},
      }),
      invalidatesTags: (_result, _error, { id, map_id }) =>
        map_id ? [{ type: "ConnectorMaps", id: `${id}:field` }] : [],
    }),
    listFieldMaps: build.query<FieldMapRow[], string>({
      query: (id) => `/v1/connectors/${id}/field-maps`,
      providesTags: (_result, _error, id) => [{ type: "ConnectorMaps", id: `${id}:field` }],
    }),
    listStateMaps: build.query<StateMapRow[], string>({
      query: (id) => `/v1/connectors/${id}/state-maps`,
      providesTags: (_result, _error, id) => [{ type: "ConnectorMaps", id: `${id}:state` }],
    }),
    createMap: build.mutation<MapRow<unknown>, { id: string; kind: MapKind; entries: unknown }>({
      query: ({ id, kind, entries }) => ({
        url: `/v1/connectors/${id}/${mapsPath(kind)}`,
        method: "POST",
        body: { entries },
      }),
      invalidatesTags: (_result, _error, { id, kind }) => [{ type: "ConnectorMaps", id: `${id}:${kind}` }],
    }),
    updateMap: build.mutation<MapRow<unknown>, { id: string; kind: MapKind; mapId: string; entries: unknown }>({
      query: ({ id, kind, mapId, entries }) => ({
        url: `/v1/connectors/${id}/${mapsPath(kind)}/${mapId}`,
        method: "PUT",
        body: { entries },
      }),
      invalidatesTags: (_result, _error, { id, kind }) => [{ type: "ConnectorMaps", id: `${id}:${kind}` }],
    }),
    validateMap: build.mutation<ValidationReport, { id: string; kind: MapKind; mapId: string }>({
      query: ({ id, kind, mapId }) => ({
        url: `/v1/connectors/${id}/${mapsPath(kind)}/${mapId}/validate`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, { id, kind }) => [{ type: "ConnectorMaps", id: `${id}:${kind}` }],
    }),
    activateMap: build.mutation<MapRow<unknown>, { id: string; kind: MapKind; mapId: string }>({
      query: ({ id, kind, mapId }) => ({
        url: `/v1/connectors/${id}/${mapsPath(kind)}/${mapId}/activate`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, { id, kind }) => [
        { type: "ConnectorMaps", id: `${id}:${kind}` },
        { type: "Connectors", id },
      ],
    }),
    killSwitch: build.mutation<ConnectorInstance, { id: string; action: "trip" | "arm"; reason: string }>({
      query: ({ id, action, reason }) => ({
        url: `/v1/connectors/${id}/kill-switch`,
        method: "POST",
        body: { action, reason },
      }),
      invalidatesTags: (_result, _error, { id }) => [{ type: "Connectors", id }],
    }),
    rewindWatermark: build.mutation<WatermarkResult, { id: string; to: string; preview?: boolean }>({
      query: ({ id, to, preview }) => ({
        url: `/v1/connectors/${id}/watermark`,
        method: "POST",
        body: preview ? { to, preview: true } : { to },
      }),
      invalidatesTags: (_result, _error, { id, preview }) => (preview ? [] : [{ type: "Connectors", id }]),
    }),
    listRuns: build.query<SyncRun[], RunsFilter>({
      query: ({ id, ...filter }) => ({
        url: `/v1/connectors/${id}/runs`,
        params: Object.fromEntries(Object.entries(filter).filter(([, value]) => value !== undefined && value !== "")),
      }),
      providesTags: (_result, _error, { id }) => [{ type: "ConnectorRuns", id }],
    }),
    listDeadLetters: build.query<DeadLetter[], { id: string; resolution?: DeadLetterResolution }>({
      query: ({ id, resolution }) => ({
        url: `/v1/connectors/${id}/dead-letters`,
        params: resolution ? { resolution } : undefined,
      }),
      providesTags: (_result, _error, { id }) => [{ type: "ConnectorDeadLetters", id }],
    }),
    replayDeadLetters: build.mutation<DeadLetterActionResult, { id: string; ids: string[]; reason?: string }>({
      query: ({ id, ids, reason }) => ({
        url: `/v1/connectors/${id}/dead-letters/replay`,
        method: "POST",
        body: reason ? { ids, reason } : { ids },
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "ConnectorDeadLetters", id },
        { type: "ConnectorRuns", id },
        { type: "Connectors", id },
      ],
    }),
    discardDeadLetters: build.mutation<DeadLetterActionResult, { id: string; ids: string[]; reason?: string }>({
      query: ({ id, ids, reason }) => ({
        url: `/v1/connectors/${id}/dead-letters/discard`,
        method: "POST",
        body: reason ? { ids, reason } : { ids },
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "ConnectorDeadLetters", id },
        { type: "Connectors", id },
      ],
    }),
    listOutbound: build.query<OutboundRow[], { id: string; status?: OutboundStatus }>({
      query: ({ id, status }) => ({
        url: `/v1/connectors/${id}/outbound`,
        params: status ? { status } : undefined,
      }),
      providesTags: (_result, _error, { id }) => [{ type: "ConnectorOutbound", id }],
    }),
    retryOutbound: build.mutation<RetryOutboundResult, { id: string; outboundId: string }>({
      query: ({ id, outboundId }) => ({
        url: `/v1/connectors/${id}/outbound/${outboundId}/retry`,
        method: "POST",
      }),
      // The row moves back to pending and the instance's figures move with it.
      invalidatesTags: (_result, _error, { id }) => [
        { type: "ConnectorOutbound", id },
        { type: "ConnectorRuns", id },
        { type: "Connectors", id },
      ],
    }),
    ticketSync: build.query<TicketSync, string>({
      query: (ticketId) => `/v1/tickets/${ticketId}/sync`,
      providesTags: (_result, _error, ticketId) => [{ type: "TicketSync", id: ticketId }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListConnectorsQuery,
  useCreateServiceNowInstanceMutation,
  useConnectorHealthQuery,
  useUpdateConnectorMutation,
  useTestConnectionMutation,
  useLoadSamplesMutation,
  useListFieldMapsQuery,
  useListStateMapsQuery,
  useCreateMapMutation,
  useUpdateMapMutation,
  useValidateMapMutation,
  useActivateMapMutation,
  useKillSwitchMutation,
  useRewindWatermarkMutation,
  useListRunsQuery,
  useListDeadLettersQuery,
  useReplayDeadLettersMutation,
  useDiscardDeadLettersMutation,
  useListOutboundQuery,
  useRetryOutboundMutation,
  useTicketSyncQuery,
} = connectorsApi;

/** The record screen's instance: selected out of the health list (no single-instance route exists). */
export function useConnectorInstance(id: string) {
  return useConnectorHealthQuery(undefined, {
    selectFromResult: ({ data, isLoading, isError }) => ({
      instance: data?.find((row) => row.id === id),
      isLoading,
      isError,
    }),
  });
}
