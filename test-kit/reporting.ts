import type {
  AccountCsat,
  AccountDashboard,
  AuditEvent,
  CsatQuarterly,
  CsatResponse,
  DeliveryOutcome,
  Measures,
  Notable,
  OperationsDashboard,
  ReportRun,
  ReportSchedule,
  ScheduleRun,
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
