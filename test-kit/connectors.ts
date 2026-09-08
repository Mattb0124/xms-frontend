import type { ConflictOutcome, SyncCardOutbound } from "@/lib/connectors/outbound";
import type {
  ConnectorHealthRow,
  ConnectorInstance,
  DeadLetter,
  FieldMapRow,
  OutboundRow,
  SyncRun,
  TicketSyncLink,
} from "@/redux/connectorsApi";

/** Constructed connector fixtures, shared by every test that reads one. */

/** Constructed connector fixtures shared by the connector tests. */
export function anInstance(overrides: Partial<ConnectorInstance> = {}): ConnectorInstance {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    account_id: "acct-1",
    type: "servicenow",
    name: "Brookfield CSM",
    base_url: "https://brookfield.service-now.com",
    auth_kind: "basic",
    credential_state: "valid",
    table_name: "sn_customerservice_case",
    profile: "csm",
    mode: "ingest_only",
    kill_switch: "armed",
    trip_reason: null,
    tripped_at: null,
    tripped_by: null,
    poll_interval_seconds: 60,
    next_poll_at: "2026-09-07T10:01:00Z",
    inbound_watermark: "2026-09-07T10:00:00Z",
    active_field_map_id: "map-1",
    active_state_map_id: null,
    journal_public: "comments",
    sync_work_notes: false,
    attachment_limit_bytes: 10 * 1024 * 1024,
    attachment_over_limit: "link",
    error_trip_threshold: { ratio: 0.5, window_minutes: 15, min_attempts: 10 },
    health: "healthy",
    last_success_at: "2026-09-07T10:00:00Z",
    last_error_at: null,
    last_error: null,
    version: 3,
    has_credential: true,
    ...overrides,
  };
}

/** What the health route answers today: both halves of the queue on every row. */
export function aHealthRow(overrides: Partial<ConnectorHealthRow> = {}): ConnectorHealthRow {
  return {
    ...anInstance(),
    pending_inbox: 0,
    open_dead_letters: 0,
    inbound_lag_seconds: 45,
    pending_outbound: 0,
    dead_lettered_outbound: 0,
    ...overrides,
  };
}

export function aFieldMap(overrides: Partial<FieldMapRow> = {}): FieldMapRow {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    account_id: "acct-1",
    instance_id: anInstance().id,
    version: 1,
    state: "draft",
    entries: [
      { external: "short_description", xms: "short_description", direction: "both" },
      { external: "contact.email", xms: "requester_email", direction: "in" },
    ],
    validation_report: null,
    samples: null,
    created_by: "user-1",
    created_at: "2026-09-07T09:00:00Z",
    activated_at: null,
    activated_by: null,
    ...overrides,
  };
}

export function aRun(overrides: Partial<SyncRun> = {}): SyncRun {
  return {
    id: "run-1",
    direction: "in",
    ticket_id: "33333333-3333-4333-8333-333333333333",
    external_sys_id: "sys-1",
    inbox_id: null,
    attempt: 1,
    outcome: "success",
    error_class: null,
    error_text: null,
    duration_ms: 240,
    detail: null,
    created_at: "2026-09-07T10:00:00Z",
    ...overrides,
  };
}

export function aDeadLetter(overrides: Partial<DeadLetter> = {}): DeadLetter {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    queue: "inbox",
    error: "state map has no inbound mapping for 18",
    attempts: 5,
    first_failed_at: "2026-09-07T08:00:00Z",
    last_failed_at: "2026-09-07T09:30:00Z",
    resolution: "open",
    resolved_by: null,
    resolved_at: null,
    resolution_reason: null,
    payload: { instance_id: anInstance().id, inbox_id: "inbox-1" },
    ...overrides,
  };
}

/** The conflict outcome the worker settles a contested row with (SN-04). */
export function aConflictOutcome(overrides: Partial<ConflictOutcome> = {}): ConflictOutcome {
  return {
    external_changed: true,
    kept: ["short_description"],
    dropped: [{ field: "client_notes", policy: "external", reason: "external_owned" }],
    external_sys_updated_on: "2026-09-07T09:55:00Z",
    ...overrides,
  };
}

export function anOutboundRow(overrides: Partial<OutboundRow> = {}): OutboundRow {
  return {
    id: "55555555-5555-4555-8555-555555555551",
    account_id: "acct-1",
    instance_id: anInstance().id,
    ticket_id: "33333333-3333-4333-8333-333333333333",
    ticket_key: "CS0000042",
    link_id: "66666666-6666-4666-8666-666666666661",
    event: "ticket.updated",
    outbox_id: "9012",
    payload: { fields: ["short_description"] },
    origin: "user",
    correlation_id: null,
    status: "pending",
    attempts: 0,
    next_attempt_at: "2026-09-07T10:05:00Z",
    last_error: null,
    conflict: null,
    sent_at: null,
    created_at: "2026-09-07T10:00:00Z",
    updated_at: "2026-09-07T10:00:00Z",
    ...overrides,
  };
}

/** The Sync card's outbound half, as the API answers it per link. */
export function aSyncCardOutbound(overrides: Partial<SyncCardOutbound> = {}): SyncCardOutbound {
  return { last_pushed_at: "2026-09-07T09:40:00Z", pending: 0, failed: 0, last_error: null, ...overrides };
}

export function aLink(overrides: Partial<TicketSyncLink> = {}): TicketSyncLink {
  return {
    external_number: "CS0012345",
    external_sys_id: "abc123",
    state: "linked",
    last_inbound_at: "2026-09-07T09:12:00Z",
    last_outbound_at: null,
    last_conflict: null,
    outbound: aSyncCardOutbound(),
    instance_name: "Brookfield CSM",
    base_url: "https://brookfield.service-now.com",
    table_name: "sn_customerservice_case",
    mode: "ingest_only",
    health: "healthy",
    ...overrides,
  };
}
