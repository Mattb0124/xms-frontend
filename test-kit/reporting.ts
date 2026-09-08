import type {
  AccountCsat,
  AccountDashboard,
  AuditEvent,
  AuditSavedQuery,
  CsatQuarterly,
  CsatResponse,
  DeliveryOutcome,
  HeldPack,
  Measures,
  NarrativeEditResult,
  Notable,
  OperationsDashboard,
  RegenerateResult,
  ReportRun,
  ReportSchedule,
  ReviewRun,
  SavedQueryPage,
  ScheduleRun,
  SecurityDashboard as SecurityData,
  UsageAccountRow,
  UsageDashboard as UsageData,
} from "@/redux/reportingApi";

export const SCHEDULE_ID = "33333333-3333-4333-8333-333333333333";
export const INTERNAL_USER_ID = "44444444-4444-4444-8444-444444444444";

/** Two responses in the range: one satisfied, one low with a comment. */
export function aCsatSummary(overrides: Partial<AccountCsat> = {}): AccountCsat {
  const responses: CsatResponse[] = [
    {
      id: "r-1",
      survey_id: "s-1",
      ticket_key: "CS0001001",
      score: 5,
      comment: null,
      contact_name: "Pat Client",
      contact_email: "pat@client.test",
      created_at: "2026-09-06T09:00:00Z",
    },
    {
      id: "r-2",
      survey_id: "s-2",
      ticket_key: "CS0000990",
      score: 2,
      comment: "Took too long to hear back",
      contact_name: null,
      contact_email: null,
      created_at: "2026-09-02T14:30:00Z",
    },
  ];
  return {
    account_id: "acct-1",
    from: "2026-06-09",
    to: "2026-09-07",
    summary: { responses: 2, average: 3.5, distribution: { "1": 0, "2": 1, "3": 0, "4": 0, "5": 1 }, low: 1 },
    surveys: { sent: 4, answered: 2, suppressed: 1 },
    responses,
    ...overrides,
  };
}

/**
 * The quarterly relationship block the API sends beside that summary: the
 * latest period, the mean per question in it, and four periods of trend,
 * oldest first as the server orders them.
 */
export function aCsatQuarterly(overrides: Partial<CsatQuarterly> = {}): CsatQuarterly {
  return {
    latest_period: "2026-Q2",
    responses: 3,
    averages: { responsiveness: 4.33, quality: 4.67, communication: 3.67, value: 3, recommend: 4.33 },
    average: 4,
    trend: [
      { period: "2025-Q3", responses: 2, average: 3.4 },
      { period: "2025-Q4", responses: 2, average: 3.8 },
      { period: "2026-Q1", responses: 4, average: 3.9 },
      { period: "2026-Q2", responses: 3, average: 4 },
    ],
    questions: [
      { key: "responsiveness", text: "How responsive were we this quarter?" },
      { key: "quality", text: "How would you rate the quality of the work delivered?" },
      { key: "communication", text: "How clear and timely was our communication?" },
      { key: "value", text: "How well does the service represent value for money?" },
      { key: "recommend", text: "How likely are you to recommend us to a colleague?" },
    ],
    ...overrides,
  };
}

export function aDelivery(overrides: Partial<DeliveryOutcome> = {}): DeliveryOutcome {
  return { kind: "internal", to: INTERNAL_USER_ID, outcome: "notified", ...overrides };
}

/** A weekly schedule on Monday at 06:00 with one internal recipient and one contact. */
export function aSchedule(overrides: Partial<ReportSchedule> = {}): ReportSchedule {
  return {
    id: SCHEDULE_ID,
    account_id: "acct-1",
    name: "Weekly status report",
    pack_type: "wsr",
    cadence: "weekly",
    run_day: 1,
    run_time: "06:00:00",
    period_kind: "previous_week",
    formats: ["pptx"],
    distribution: [
      { kind: "internal", id: INTERNAL_USER_ID, name: "Cara Lee", email: "cara@example.test" },
      { kind: "contact", email: "pat@client.test", name: "Pat Client" },
    ],
    review_required: false,
    review_grace_hours: 24,
    enabled: true,
    next_run_at: "2026-09-14T06:00:00Z",
    last_run_id: null,
    version: 1,
    ...overrides,
  };
}

export function aRun(overrides: Partial<ScheduleRun> = {}): ScheduleRun {
  return {
    id: "run-10",
    account_id: "acct-1",
    schedule_id: SCHEDULE_ID,
    pack_type: "wsr",
    period_start: "2026-08-31",
    period_end: "2026-09-06",
    status: "sent",
    error: null,
    pack_id: "pack-10",
    pptx_key: "acct-1/reports/pack-10.pptx",
    delivery: [
      aDelivery(),
      aDelivery({ kind: "contact", to: "pat@client.test", outcome: "skipped", reason: "no_sender_identity" }),
    ],
    requested_by: "system",
    created_at: "2026-09-07T06:00:00Z",
    ...overrides,
  };
}

export const REVIEW_RUN_ID = "55555555-5555-4555-8555-555555555555";
export const HELD_PACK_ID = "66666666-6666-4666-8666-666666666666";

/**
 * The pack frozen behind a held run: the same measures the dashboards use,
 * two notable rows and two narrative versions, so a screen that shows the
 * older one is caught. Both rendition keys are set; the presigned links live
 * on the run, not the pack.
 */
export function aHeldPack(overrides: Partial<HeldPack> = {}): HeldPack {
  return {
    id: HELD_PACK_ID,
    period_start: "2026-08-31",
    period_end: "2026-09-06",
    measures: someMeasures({ open_tickets: 120, consumption_minutes: 5_250, time_logged_minutes: 6_000 }),
    notable: someNotable(),
    narrative_versions: [
      { version: 1, text: "First cut of the week.", author_kind: "system", at: "2026-09-07T06:00:00Z" },
      {
        version: 2,
        text: "Volumes held steady and the consolidation cube incident is the only breach this week.",
        author_kind: "system",
        at: "2026-09-07T06:01:00Z",
      },
    ],
    pptx_key: "acct-1/reports/pack-held.pptx",
    pdf_key: "acct-1/reports/pack-held.pdf",
    ...overrides,
  };
}

/**
 * A run held for a reviewer inside its grace period, with the pack and the
 * two presigned links the API mints. Nothing has been delivered: `delivery`
 * is null and no reviewer has decided.
 */
export function aReviewRun(overrides: Partial<ReviewRun> = {}): ReviewRun {
  return {
    id: REVIEW_RUN_ID,
    account_id: "acct-1",
    schedule_id: SCHEDULE_ID,
    pack_type: "wsr",
    period_start: "2026-08-31",
    period_end: "2026-09-06",
    status: "ready_for_review",
    error: null,
    pack_id: HELD_PACK_ID,
    pptx_key: "acct-1/reports/pack-held.pptx",
    delivery: null,
    requested_by: "system",
    created_at: "2026-09-07T06:00:00Z",
    reviewer_id: null,
    reviewed_at: null,
    review_due_at: "2026-09-08T06:00:00Z",
    review_note: null,
    pack: aHeldPack(),
    files: {
      pptx: "https://files.example.test/packs/held.pptx?signature=constructed",
      pdf: "https://files.example.test/packs/held.pdf?signature=constructed",
    },
    // The narrative the pack stands on: templated, rendered into both files,
    // and written by the template because Axel is off for this account.
    narrative: {
      sections: [
        { key: "headline", text: "Volumes held steady and the consolidation cube incident is the only breach." },
        { key: "consumption", text: "Consumption is tracking to plan." },
      ],
    },
    narrative_source: "templated",
    narrative_version: 2,
    narrative_rendered: true,
    ai_enabled: false,
    ...overrides,
  };
}

/**
 * What `PATCH /v1/reporting/runs/:id/narrative` answers: the reviewer's
 * words as one more version on the frozen pack, the source now `edited`, and
 * `narrative_rendered` false until the two files are rebuilt.
 */
export function aNarrativeEdit(overrides: Partial<NarrativeEditResult> = {}): NarrativeEditResult {
  return {
    run_id: REVIEW_RUN_ID,
    pack_id: HELD_PACK_ID,
    status: "ready_for_review",
    narrative: {
      sections: [
        { key: "headline", text: "A quiet week, with one breach on the consolidation cube." },
        { key: "consumption", text: "Consumption is tracking to plan." },
      ],
    },
    narrative_source: "edited",
    narrative_version: 3,
    narrative_rendered: false,
    ...overrides,
  };
}

/** The run as it reads after that edit: the reviewer's words, waiting to be regenerated. */
export function anEditedReviewRun(overrides: Partial<ReviewRun> = {}): ReviewRun {
  const edit = aNarrativeEdit();
  return aReviewRun({
    narrative: edit.narrative,
    narrative_source: "edited",
    narrative_version: edit.narrative_version,
    narrative_rendered: false,
    ...overrides,
  });
}

/** What `POST /v1/reporting/runs/:id/regenerate` answers: fresh links, the run unmoved. */
export function aRegeneratedRun(overrides: Partial<RegenerateResult> = {}): RegenerateResult {
  return {
    run_id: REVIEW_RUN_ID,
    pack_id: HELD_PACK_ID,
    status: "ready_for_review",
    period: { start: "2026-08-31", end: "2026-09-06" },
    files: {
      pptx: "https://files.example.test/packs/held.pptx?signature=rebuilt",
      pdf: "https://files.example.test/packs/held.pdf?signature=rebuilt",
    },
    narrative_source: "edited",
    narrative_version: 3,
    narrative_rendered: true,
    ...overrides,
  };
}

/** Constructed dashboard, audit and report fixtures shared by the reporting tests. */
export function someMeasures(overrides: Partial<Measures> = {}): Measures {
  return {
    open_tickets: 218,
    open_by_priority: { p1: 3, p2: 40, p3: 150, p4: 25 },
    open_by_type: { incident: 120, service_request: 80, change: 18 },
    breached_now: 6,
    at_risk_now: 14,
    unassigned_now: 7,
    backlog_by_age: { "0_1d": 40, "1_3d": 60, "3_7d": 70, "7_14d": 30, "14d_plus": 18 },
    volume_created: 92,
    volume_resolved: 80,
    sla_response_attainment: { numerator: 94, denominator: 100, value: 94 },
    sla_resolution_attainment: { numerator: 45, denominator: 50, value: 90 },
    mttr_minutes: 684,
    reopen_rate: { numerator: 2, denominator: 50, value: 0.04 },
    consumption_minutes: 5250,
    time_logged_minutes: 6000,
    oldest_open_days: 41,
    ...overrides,
  };
}

export function someNotable(): Notable[] {
  return [
    {
      key: "CS0001204",
      title: "Consolidation cube will not load",
      state: "in_progress",
      priority: "p1",
      age_days: 2,
      breached: true,
    },
    {
      key: "CS0001210",
      title: "Month-end close checklist",
      state: "awaiting_client",
      priority: "p2",
      age_days: 5,
      breached: false,
    },
  ];
}

export function anOperationsDashboard(overrides: Partial<OperationsDashboard> = {}): OperationsDashboard {
  return {
    period: { start: "2026-08-31T00:00:00Z", end: "2026-09-07T00:00:00Z" },
    measures: someMeasures(),
    notable: someNotable(),
    per_account: [
      {
        account_id: "acct-1",
        key: "BRK",
        name: "Brookfield",
        measures: {
          open_tickets: 120,
          breached_now: 4,
          at_risk_now: 9,
          unassigned_now: 3,
          volume_created: 50,
          volume_resolved: 44,
        },
      },
      {
        account_id: "acct-2",
        key: "NWH",
        name: "Northwind Health",
        measures: {
          open_tickets: 98,
          breached_now: 2,
          at_risk_now: 5,
          unassigned_now: 4,
          volume_created: 42,
          volume_resolved: 36,
        },
      },
    ],
    ...overrides,
  };
}

export function anAccountDashboard(overrides: Partial<AccountDashboard> = {}): AccountDashboard {
  return {
    period: { start: "2026-08-31T00:00:00Z", end: "2026-09-07T00:00:00Z" },
    measures: someMeasures({ open_tickets: 120 }),
    notable: someNotable(),
    ...overrides,
  };
}

/** What the API returns with as_client=true: the portal subset, no notable list. */
export function aClientDashboard(): AccountDashboard {
  const full = someMeasures({ open_tickets: 120 });
  return {
    period: { start: "2026-08-31T00:00:00Z", end: "2026-09-07T00:00:00Z" },
    measures: {
      open_tickets: full.open_tickets,
      volume_created: full.volume_created,
      volume_resolved: full.volume_resolved,
      sla_response_attainment: full.sla_response_attainment,
      sla_resolution_attainment: full.sla_resolution_attainment,
      mttr_minutes: full.mttr_minutes,
      backlog_by_age: full.backlog_by_age,
    },
  };
}

export function aReportRun(overrides: Partial<ReportRun> = {}): ReportRun {
  return {
    id: "run-1",
    pack_type: "wsr",
    period_start: "2026-08-31",
    period_end: "2026-09-06",
    status: "ready_for_review",
    created_at: "2026-09-07T06:00:00Z",
    pack_id_resolved: "pack-1",
    pptx_key: "acct-1/reports/pack-1.pptx",
    ...overrides,
  };
}

export function anAuditEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: "ev-1",
    stream: "audit",
    occurred_at: "2026-09-07T09:15:00Z",
    event_type: "ticket.transitioned",
    account_id: "acct-1",
    actor_kind: "user",
    actor_id: "user-cara",
    actor_name: "Cara Lee",
    principal_kind: "internal",
    session_id: "sess-1",
    request_id: "req-1",
    correlation_id: "corr-1",
    entity_kind: "ticket",
    entity_id: "t-1",
    outcome: "success",
    attrs: { old: { state: "new" }, new: { state: "assigned" } },
    ...overrides,
  };
}

export const SAVED_QUERY_ID = "88888888-8888-4888-8888-888888888888";
export const QUERY_OWNER_ID = "user-ada";

/**
 * A saved condition set as `/v1/audit/saved-queries` answers it: conditions
 * and nothing else, with the owner the API named and whether it is shared.
 * The default is the reader's own private query; pass `shared` and another
 * `owner_user_id` for the one somebody else put in front of everybody.
 */
export function aSavedQuery(overrides: Partial<AuditSavedQuery> = {}): AuditSavedQuery {
  return {
    id: SAVED_QUERY_ID,
    name: "Brookfield changes",
    description: "Everything audited on Brookfield",
    owner_user_id: QUERY_OWNER_ID,
    owner_name: "Ada Byron",
    shared: false,
    conditions: [
      { field: "stream", op: "eq", value: "audit" },
      { field: "account_id", op: "is_not_null" },
    ],
    created_at: "2026-09-05T08:00:00.000Z",
    updated_at: "2026-09-05T08:00:00.000Z",
    ...overrides,
  };
}

/** The run route's answer: a page of events beside the query that produced it. */
export function aSavedQueryPage(overrides: Partial<SavedQueryPage> = {}): SavedQueryPage {
  return {
    items: [anAuditEvent({ id: "ev-saved-1", event_type: "account.updated" })],
    next_cursor: null,
    saved_query: aSavedQuery(),
    ...overrides,
  };
}

/** The connector instance the tripped row and the dead-letter row both name. */
export const PAUSED_INSTANCE_ID = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
export const PAUSED_SUBSCRIPTION_ID = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";
export const SECURITY_ACCOUNT_ID = "cccccccc-3333-4333-8333-cccccccccccc";

/**
 * The Security dashboard as the API answers it over a seven day window: a
 * denial and a failed sign-in in the stream, two clients the limiter turned
 * away, a paused subscription and a tripped instance each naming its own
 * record, one quarantined file, and two dead-letter queues, one of them a
 * connector queue that names its instance and one a platform queue that
 * names none.
 */
export function aSecurityDashboard(overrides: Partial<SecurityData> = {}): SecurityData {
  return {
    by_type: [
      { event_type: "authz.permission.denied", outcome: "denied", n: 12 },
      { event_type: "auth.signin.failed", outcome: "denied", n: 4 },
      { event_type: "admin.role.updated", outcome: "success", n: 2 },
      { event_type: "data.export.produced", outcome: "success", n: 3 },
      { event_type: "abuse.rate_limited", outcome: "denied", n: 3 },
      { event_type: "abuse.webhook.bad_signature", outcome: "denied", n: 1 },
    ],
    signin_failures: [{ actor_id: "user-ada", ip_hash: "ip-9f2c", n: 4 }],
    isolation_probes: [{ actor_id: "user-eve", n: 2 }],
    abuse_by_kind: [
      { event_type: "abuse.rate_limited", n: 3 },
      { event_type: "abuse.webhook.bad_signature", n: 1 },
    ],
    rate_limited_clients: [
      { actor_id: "client-a", principal_kind: "api_client", n: 2 },
      { actor_id: "client-b", principal_kind: "api_client", n: 1 },
    ],
    paused_integrations: [
      {
        kind: "webhook_subscription",
        id: PAUSED_SUBSCRIPTION_ID,
        account_id: SECURITY_ACCOUNT_ID,
        account_key: "brookfield",
        name: "https://hooks.brookfield.example/xms",
        reason: "continuous_failure",
      },
      {
        kind: "connector_instance",
        id: PAUSED_INSTANCE_ID,
        account_id: SECURITY_ACCOUNT_ID,
        account_key: "brookfield",
        name: "Brookfield ServiceNow",
        reason: "error ratio",
      },
    ],
    paused_integrations_by_reason: [
      { kind: "webhook_subscription", reason: "continuous_failure", n: 1 },
      { kind: "connector_instance", reason: "error ratio", n: 1 },
    ],
    quarantined_attachments: [{ origin: "email", n: 1 }],
    open_dead_letters: [
      {
        queue: "outbound",
        n: 4,
        oldest: "2026-09-01T04:00:00Z",
        account_id: SECURITY_ACCOUNT_ID,
        instance_id: PAUSED_INSTANCE_ID,
        instance_name: "Brookfield ServiceNow",
      },
      {
        queue: "mail",
        n: 1,
        oldest: "2026-09-03T06:00:00Z",
        account_id: null,
        instance_id: null,
        instance_name: null,
      },
    ],
    open_dead_letters_by_queue: [
      { queue: "outbound", n: 5, oldest: "2026-09-01T04:00:00Z" },
      { queue: "mail", n: 1, oldest: "2026-09-03T06:00:00Z" },
    ],
    ...overrides,
  };
}

/**
 * The per-account strip of the Usage dashboard: two accounts over the same
 * window, the busier one second so a screen that does not sort by tickets
 * created is caught.
 */
export function aUsageStrip(overrides: Partial<UsageAccountRow>[] = []): UsageAccountRow[] {
  const strip: UsageAccountRow[] = [
    {
      account_id: "acct-2",
      key: "NWH",
      name: "Northwind Health",
      tickets_created: 4,
      tickets_closed: 2,
      minutes_logged: 90,
      portal_signins: 1,
      api_calls: 0,
      active_users: 2,
    },
    {
      account_id: "acct-1",
      key: "BRK",
      name: "Brookfield",
      tickets_created: 31,
      tickets_closed: 27,
      minutes_logged: 1_320,
      portal_signins: 12,
      api_calls: 480,
      active_users: 9,
    },
  ];
  return strip.map((row, index) => ({ ...row, ...(overrides[index] ?? {}) }));
}

/** The Usage dashboard as the API answers it, strip and all. */
export function aUsageDashboard(overrides: Partial<UsageData> = {}): UsageData {
  return {
    active_users: [
      { key: "internal", n: 11 },
      { key: "portal", n: 4 },
    ],
    actions: [{ key: "ticket.transition", n: 62 }],
    screens: [{ key: "queue", n: 140 }],
    no_result_searches: [{ key: "knowledge", n: 3 }],
    api_errors: [{ key: "GET /v1/tickets", n: 2 }],
    per_account: aUsageStrip(),
    ...overrides,
  };
}

/**
 * An operator-scope row as migration 0033 sends it: the `audit` stream, no
 * account, and `attrs.scope = 'operator'`, because a role has no account of
 * its own.
 */
export function anOperatorAuditRow(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return anAuditEvent({
    id: "ev-op-1",
    event_type: "role.permissions_changed",
    account_id: null,
    entity_kind: "role",
    entity_id: "role-dispatcher",
    attrs: { scope: "operator", old: { permissions: ["tickets:view"] }, new: { permissions: ["tickets:work"] } },
    ...overrides,
  });
}
