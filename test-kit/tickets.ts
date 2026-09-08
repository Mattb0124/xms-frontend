import type {
  ChangeCalendarWindow,
  Contract,
  Engagement,
  FreezeWindow,
  RoutingRule,
  TicketGroup,
  TicketScope,
  TicketView,
  WindowAt,
} from "@/redux/ticketsApi";

/**
 * Constructed ticket, contract, engagement, scope, group and change window
 * fixtures, shared by every test that reads one.
 */

export const ACCOUNT_ID = "77777777-7777-4777-8777-777777777777";

export const CONTRACT_ID = "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1";

/** A constructed contract row: a retainer with no after-hours handling and the column-default budget rules. */
export function aContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: CONTRACT_ID,
    key: "CT10001",
    name: "Support retainer",
    model: "retainer",
    status: "active",
    currency: "USD",
    engagement_id: null,
    after_hours_handling: "none",
    after_hours_multiplier: null,
    threshold_percents: [50, 75, 90, 100],
    threshold_notify_client: false,
    overage_rule: "allow_flag",
    overage_multiplier: null,
    rollover_rule: "none",
    rollover_cap_hours: null,
    forecast_window_days: 10,
    technology_codes: [],
    version: 1,
    ...overrides,
  };
}

export const ENGAGEMENT_ID = "e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1";

export const OWNER_USER_ID = "0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a";

/**
 * A constructed engagement: active, a renewal a year out, a month of notice
 * and no alert fired yet. Nothing here is copied from a live account.
 */
export function anEngagement(overrides: Partial<Engagement> = {}): Engagement {
  return {
    id: ENGAGEMENT_ID,
    account_id: ACCOUNT_ID,
    name: "Managed services 2026",
    owner_user_id: OWNER_USER_ID,
    renewal_date: "2027-03-31",
    notice_period_days: 30,
    status: "active",
    renewal_alerts_fired: [],
    created_at: "2026-04-01T09:00:00.000Z",
    updated_at: "2026-04-01T09:00:00.000Z",
    version: 1,
    ...overrides,
  };
}

/** The same engagement inside the widest lead window, with two alerts already sent. */
export function anExpiringEngagement(overrides: Partial<Engagement> = {}): Engagement {
  return anEngagement({
    id: "e2e2e2e2-e2e2-4e2e-8e2e-e2e2e2e2e2e2",
    name: "Hosting renewal",
    renewal_date: "2026-10-01",
    status: "expiring",
    renewal_alerts_fired: [90, 60],
    version: 4,
    ...overrides,
  });
}

export const TICKET_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

export const FLAGGER_ID = "u-cara";

export const APPROVER_ID = "u-dana";

/** A ticket nobody has flagged: the four fields present, everything else null. */
export function aScope(overrides: Partial<TicketScope> = {}): TicketScope {
  return {
    out_of_scope: "none",
    reason: null,
    flagged_by: null,
    flagged_by_name: null,
    flagged_at: null,
    decision: null,
    note: null,
    decided_by: null,
    decided_by_name: null,
    decided_at: null,
    overage_allowance_minutes: null,
    ...overrides,
  };
}

/** A flag Cara raised and nobody has decided (TM-11). */
export function aFlaggedScope(overrides: Partial<TicketScope> = {}): TicketScope {
  return aScope({
    out_of_scope: "flagged",
    reason: "A new hierarchy is a project, not support.",
    flagged_by: FLAGGER_ID,
    flagged_by_name: "Cara Lee",
    flagged_at: "2026-09-06T11:00:00Z",
    ...overrides,
  });
}

/** The same flag, approved by someone else with eight hours of extra budget. */
export function anApprovedScope(overrides: Partial<TicketScope> = {}): TicketScope {
  return aFlaggedScope({
    out_of_scope: "approved",
    decision: "approve",
    note: "Agreed with the client.",
    decided_by: APPROVER_ID,
    decided_by_name: "Dana Reid",
    decided_at: "2026-09-07T08:30:00Z",
    overage_allowance_minutes: 480,
    ...overrides,
  });
}

/** A constructed ticket record: an open incident on the retainer, assigned, with both clocks running. */
export function aTicketView(overrides: Partial<TicketView> = {}): TicketView {
  return {
    id: TICKET_ID,
    key: "CS1000199",
    account_id: ACCOUNT_ID,
    type: "incident",
    state: "in_progress",
    state_label: "In progress",
    short_description: "HFM consolidation fails on the September close",
    description: null,
    category: null,
    impact: "high",
    urgency: "high",
    priority: "p2",
    priority_overridden: false,
    source: "portal",
    requester: { id: "u-pat", email: "pat.client@example.test", display_name: "Pat Client" },
    group_id: null,
    assignee_id: "u-ben",
    assignee_name: "Ben Okafor",
    contract_id: CONTRACT_ID,
    resolution: {
      code: null,
      notes: null,
      solution_article_id: null,
      solution_candidate: false,
      time_exemption_reason: null,
    },
    scope: aScope(),
    external_refs: {},
    reopen_count: 0,
    first_response_at: null,
    resolved_at: null,
    closed_at: null,
    cancelled_at: null,
    sla: {},
    created_by: "u-pat",
    created_by_name: "Pat Client",
    created_at: "2026-08-25T09:00:00Z",
    updated_at: "2026-08-25T10:00:00Z",
    version: 3,
    ...overrides,
  };
}

export function aPremiumContract(overrides: Partial<Contract> = {}): Contract {
  return aContract({ after_hours_handling: "premium_rate", after_hours_multiplier: "1.500", ...overrides });
}

export function aCompTimeContract(overrides: Partial<Contract> = {}): Contract {
  return aContract({ after_hours_handling: "comp_time", after_hours_multiplier: null, ...overrides });
}

export const GROUP_ID = "99999999-9999-4999-8999-999999999999";

export const TICKET_GROUP_ID = "88888888-8888-4888-8888-888888888888";

/** A constructed change window: October's release window with one freeze inside it (TM-10, TM-18). */
export function aTicketGroup(overrides: Partial<TicketGroup> = {}): TicketGroup {
  return {
    id: TICKET_GROUP_ID,
    account_id: ACCOUNT_ID,
    kind: "change_window",
    name: "October release window",
    description: "The monthly consolidation release",
    owner_user_id: "u-ben",
    starts_at: "2026-10-03T18:00:00Z",
    ends_at: "2026-10-04T02:00:00Z",
    freeze_windows: [aFreeze()],
    status: "planned",
    created_at: "2026-09-01T09:00:00Z",
    updated_at: "2026-09-01T09:00:00Z",
    version: 1,
    ...overrides,
  };
}

/** A constructed freeze: the hour inside the window during which nothing may be scheduled. */
export function aFreeze(overrides: Partial<FreezeWindow> = {}): FreezeWindow {
  return {
    starts_at: "2026-10-03T20:00:00Z",
    ends_at: "2026-10-03T21:00:00Z",
    reason: "Month-end close",
    ...overrides,
  };
}

/** A constructed project: a container with no schedule, so no window rule applies to it. */
export function aProjectGroup(overrides: Partial<TicketGroup> = {}): TicketGroup {
  return aTicketGroup({
    id: "88888888-8888-4888-8888-888888888889",
    kind: "project",
    name: "Cutover programme",
    starts_at: null,
    ends_at: null,
    freeze_windows: [],
    status: "active",
    ...overrides,
  });
}

/** A constructed routing default: every incident goes to one group unless a category rule is more specific. */
export function aRoutingRule(overrides: Partial<RoutingRule> = {}): RoutingRule {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    account_id: ACCOUNT_ID,
    ticket_type: "incident",
    category: null,
    group_id: GROUP_ID,
    group_name: "Application support",
    created_at: "2026-09-01T09:00:00Z",
    updated_at: "2026-09-01T09:00:00Z",
    version: 1,
    ...overrides,
  };
}

/**
 * A constructed calendar window (TM-18): October's release window with one
 * freeze inside it and one change planned in it. The calendar answers a
 * window with both ends and never a cancelled one, so the fixture has both.
 */
export function aChangeWindow(overrides: Partial<ChangeCalendarWindow> = {}): ChangeCalendarWindow {
  return {
    id: TICKET_GROUP_ID,
    account_id: ACCOUNT_ID,
    name: "October release window",
    status: "planned",
    starts_at: "2026-10-03T18:00:00Z",
    ends_at: "2026-10-04T02:00:00Z",
    freeze_windows: [aFreeze()],
    tickets: [
      {
        id: "t-change",
        key: "CS1000420",
        type: "change",
        state: "scheduled",
        priority: "p3",
        short_description: "Deploy the consolidation hotfix",
      },
    ],
    ...overrides,
  };
}

/** The instant answer for an account inside an open window. */
export function anOpenWindowAt(overrides: Partial<WindowAt> = {}): WindowAt {
  return {
    at: "2026-10-03T19:00:00Z",
    inside: true,
    frozen: false,
    windows: [
      {
        id: TICKET_GROUP_ID,
        name: "October release window",
        status: "active",
        starts_at: "2026-10-03T18:00:00Z",
        ends_at: "2026-10-04T02:00:00Z",
        freeze: null,
      },
    ],
    ...overrides,
  };
}
