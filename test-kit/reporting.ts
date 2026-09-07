import type {
  AccountDashboard,
  AuditEvent,
  Measures,
  Notable,
  OperationsDashboard,
  ReportRun,
} from "@/redux/reportingApi";

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
