import type {
  AccountBudget,
  BillingExport,
  BillingPeriod,
  Bucket,
  BudgetContractCard,
  BudgetEntries,
  BudgetForecast,
  BudgetThresholds,
  CompTimeReport,
  ContractPosition,
  RateCard,
  ThresholdEvent,
  TimeEntry,
} from "@/redux/timeApi";

/**
 * Constructed time, budget, rate card and billing fixtures, shared by every
 * test that reads one. They live here rather than in a test file so importing
 * a fixture never re-registers another file's suites.
 */

export function anEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: "e-1",
    ticket_id: "t-1",
    person_name: "Cara Lee",
    performed_on: "2026-09-07",
    minutes: 45,
    adjusted_minutes: 45,
    activity_type: "analysis",
    billable_class: "billable",
    description: "Traced the failing job",
    performed_start: null,
    after_hours: false,
    after_hours_class: "standard",
    rate_multiplier: "1.000",
    rate_snapshot: null,
    amount: null,
    over_budget: false,
    created_at: "2026-09-07T10:00:00Z",
    ...overrides,
  };
}

/** An entry logged under a rate card: the rate and the amount frozen on the row (TB-05). */
export function aRatedEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return anEntry({
    id: "e-rated",
    minutes: 90,
    adjusted_minutes: 90,
    rate_snapshot: "150.00",
    amount: "225.00",
    ...overrides,
  });
}

/** An entry the calendar classed after hours with the contract's premium applied (TB-13). */
export function anAfterHoursEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return anEntry({
    id: "e-ah",
    performed_start: "19:30:00",
    after_hours: true,
    after_hours_class: "after_hours",
    rate_multiplier: "1.500",
    ...overrides,
  });
}

export function aCompTimeReport(overrides: Partial<CompTimeReport> = {}): CompTimeReport {
  const entries = [
    anAfterHoursEntry({ id: "ct-1", person_id: "p-1", rate_multiplier: "1.000", minutes: 90 }),
    anAfterHoursEntry({
      id: "ct-2",
      person_id: "p-1",
      rate_multiplier: "1.000",
      minutes: 30,
      after_hours_class: "weekend",
    }),
    anAfterHoursEntry({
      id: "ct-3",
      person_id: "p-2",
      person_name: "Dev Patel",
      rate_multiplier: "1.000",
      minutes: 60,
    }),
  ];
  return {
    from: "2026-08-08",
    to: "2026-09-07",
    entries,
    total_minutes: 180,
    by_person: [
      { person_id: "p-1", person_name: "Cara Lee", minutes: 120, entries: 2 },
      { person_id: "p-2", person_name: "Dev Patel", minutes: 60, entries: 1 },
    ],
    ...overrides,
  };
}

export function aPosition(overrides: Partial<ContractPosition> = {}): ContractPosition {
  return {
    contract: { id: "c-1", key: "CT10001", name: "Support retainer", model: "retainer" },
    period: { starts_on: "2026-09-01", ends_on: "2026-09-30", days_total: 30, days_elapsed: 7 },
    contracted_minutes: 2400,
    carried_over_minutes: 0,
    available_minutes: 2400,
    consumed_minutes: 600,
    non_consuming_minutes: 30,
    remaining_minutes: 1800,
    percent_consumed: 25,
    percent_elapsed: 23.3,
    projected_minutes: 2571,
    status: "on_track",
    by_class: { billable: 600 },
    by_activity: { analysis: 600 },
    ...overrides,
  };
}

/** The forecast behind aPosition: 2 h per business day over the last 5, 17 business days left, so 110 percent at period end. */
export function aForecast(overrides: Partial<BudgetForecast> = {}): BudgetForecast {
  return {
    business_days_total: 22,
    business_days_elapsed: 5,
    window_days: 5,
    run_rate_minutes: 120,
    forecast_minutes: 2640,
    forecast_percent: 110,
    business_days_to_exhaustion: 15,
    ...overrides,
  };
}

export function aThresholdEvent(overrides: Partial<ThresholdEvent> = {}): ThresholdEvent {
  return {
    id: "te-1",
    contract_period_id: "p-1",
    percent: 50,
    consumed_minutes_at_fire: 1230,
    available_minutes: 2400,
    fired_at: "2026-09-04T15:00:00Z",
    ...overrides,
  };
}

/** The default thresholds with nothing fired yet: 50 percent is next, at 20 h of the 40 h. */
export function aThresholds(overrides: Partial<BudgetThresholds> = {}): BudgetThresholds {
  return {
    percents: [50, 75, 90, 100],
    fired: [],
    next_percent: 50,
    next_at_minutes: 1200,
    events: [],
    ...overrides,
  };
}

/** One contract on the budget view: aPosition's numbers, aForecast, the default thresholds, nothing unrated. */
export function aBudgetCard(overrides: Partial<BudgetContractCard> = {}): BudgetContractCard {
  const { contract: _contract, ...position } = aPosition();
  void _contract;
  return {
    contract: {
      id: "c-1",
      key: "CT10001",
      name: "Support retainer",
      model: "retainer",
      currency: "USD",
      overage_rule: "allow_flag",
      rollover_rule: "none",
      after_hours_handling: "none",
    },
    period: { id: "p-1", starts_on: "2026-09-01", ends_on: "2026-09-30", locked: false },
    position,
    forecast: aForecast(),
    thresholds: aThresholds(),
    unrated_minutes: 0,
    ...overrides,
  };
}

export function aBudget(overrides: Partial<AccountBudget> = {}): AccountBudget {
  return {
    account_id: "acct-1",
    as_of: "2026-09-07",
    calendar_id: "cal-1",
    contracts: [aBudgetCard()],
    ...overrides,
  };
}

/** The drill-through behind the card: two rated entries and one without a rate. */
export function aBudgetEntries(overrides: Partial<BudgetEntries> = {}): BudgetEntries {
  return {
    contractId: "c-1",
    from: "2026-09-01",
    to: "2026-09-30",
    entries: [
      {
        ...aRatedEntry({ id: "be-1", person_id: "p-1", performed_on: "2026-09-03" }),
        ticket_number: "1000001",
        bucket_label: null,
        contract_key: "CT10001",
      },
      {
        ...aRatedEntry({
          id: "be-2",
          person_id: "p-2",
          person_name: "Dev Patel",
          performed_on: "2026-09-04",
          minutes: 60,
          adjusted_minutes: 60,
          activity_type: "development",
          amount: "150.00",
        }),
        ticket_number: null,
        bucket_label: "Internal",
        contract_key: "CT10001",
      },
      {
        ...anEntry({ id: "be-3", person_id: "p-1", performed_on: "2026-09-05", minutes: 30, adjusted_minutes: 30 }),
        ticket_number: "1000002",
        bucket_label: null,
        contract_key: "CT10001",
      },
    ],
    total_minutes: 180,
    total_amount: 375,
    ...overrides,
  };
}

/** An account-default rate card version (contract_id null) with one consultant line. */
export function aRateCard(overrides: Partial<RateCard> = {}): RateCard {
  return {
    id: "rc-1",
    account_id: "acct-1",
    contract_id: null,
    effective_from: "2026-01-01",
    currency: "USD",
    note: "",
    created_by: "u1",
    created_at: "2026-01-01T09:00:00Z",
    entries: [{ role: "consultant", bill_rate: 150, overage_rate: 200 }],
    ...overrides,
  };
}

/** An open September billing period with nothing summarised yet. */
export function aBillingPeriod(overrides: Partial<BillingPeriod> = {}): BillingPeriod {
  return {
    id: "bp-1",
    account_id: "acct-1",
    starts_on: "2026-09-01",
    ends_on: "2026-09-30",
    status: "open",
    submitted_at: null,
    submitted_by: null,
    approved_at: null,
    approved_by: null,
    locked_at: null,
    locked_by: null,
    submitted_by_name: null,
    approved_by_name: null,
    locked_by_name: null,
    auto_lock_at: null,
    summary: null,
    checksum: null,
    version: 1,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

/** A locked August period with the summary the export must match: 3 entries, 2.25 h, 225.00, 30 min unrated. */
export function aLockedPeriod(overrides: Partial<BillingPeriod> = {}): BillingPeriod {
  return aBillingPeriod({
    id: "bp-0",
    starts_on: "2026-08-01",
    ends_on: "2026-08-31",
    status: "locked",
    submitted_at: "2026-09-01T09:00:00Z",
    submitted_by: "u1",
    approved_at: "2026-09-02T09:00:00Z",
    approved_by: "u2",
    locked_at: "2026-09-03T09:00:00Z",
    locked_by: "u2",
    submitted_by_name: "Ana Silva",
    approved_by_name: "Ben Ito",
    locked_by_name: "Ben Ito",
    auto_lock_at: "2026-09-07T09:00:00Z",
    summary: {
      entries: 3,
      adjustments: 0,
      minutes: 135,
      amount: 225,
      unrated_minutes: 30,
      by_class: {
        billable: { minutes: 105, amount: 175 },
        absorbed: { minutes: 30, amount: 50 },
      },
      by_contract: { CT10001: { minutes: 135, amount: 225 } },
    },
    checksum: "3f2a9c8e1b7d4f6a5c3e2d1b0a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a19",
    version: 4,
    ...overrides,
  });
}

export function aBillingExport(overrides: Partial<BillingExport> = {}): BillingExport {
  return {
    id: "bx-1",
    account_id: "acct-1",
    billing_period_id: "bp-0",
    format: "xlsx",
    template_version: "thg-finance-1",
    object_key: "accounts/acct-1/billing/bp-0/finance-2026-09-03-09-05-00.xlsx",
    checksum: "3f2a9c8e1b7d4f6a5c3e2d1b0a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a19",
    row_count: 3,
    produced_by: "u2",
    produced_at: "2026-09-03T09:05:00Z",
    delivered_at: null,
    delivery_ref: null,
    ...overrides,
  };
}

export const BUCKET_ID = "b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1";

/**
 * A constructed bucket (TB-12): governance work on the shared taxonomy,
 * classed internal, so it is logged and not billed.
 */
export function aBucket(overrides: Partial<Bucket> = {}): Bucket {
  return {
    id: BUCKET_ID,
    account_id: "acct-1",
    key: "governance",
    label: "Governance",
    code: "governance",
    billable_class: "non_billable",
    contract_id: null,
    status: "active",
    version: 1,
    ...overrides,
  };
}
