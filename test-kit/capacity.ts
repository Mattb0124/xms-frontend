import type {
  Allocation,
  CapacityCheck,
  CapacityDemand,
  CapacityPerson,
  CapacityView,
  DemandList,
  DemandRow,
  ImportDemandResult,
  Pto,
  SkillsMatrixAccount,
  SkillsMatrixPeople,
  VarianceLine,
  VarianceReport,
} from "@/redux/capacityApi";
import { PERSON_ID } from "@/test-kit/roster";

/** Constructed capacity, allocation, skills matrix and demand fixtures. */

/** Constructed capacity fixtures shared by the capacity tests. */
export const ACCOUNT_ID = "55555555-5555-4555-8555-555555555555";

export const OTHER_ACCOUNT_ID = "66666666-6666-4666-8666-666666666666";

export const OTHER_PERSON_ID = "77777777-7777-4777-8777-777777777777";

export const PTO_ID = "88888888-8888-4888-8888-888888888888";

export function aPto(overrides: Partial<Pto> = {}): Pto {
  return {
    id: PTO_ID,
    person_id: PERSON_ID,
    starts_on: "2026-09-14",
    ends_on: "2026-09-16",
    kind: "vacation",
    fraction: "1.00",
    note: "",
    entered_by: "u-ana",
    created_at: "2026-09-01T09:00:00Z",
    ...overrides,
  };
}

/**
 * September 2026 for a full-time person: 22 working days of 8 h, one holiday,
 * two PTO days, 10 percent overhead, 60 h allocated on one account and 9 h
 * logged, well inside the available 136.8 h.
 */
export function aCapacityPerson(overrides: Partial<CapacityPerson> = {}): CapacityPerson {
  return {
    person: {
      id: PERSON_ID,
      display_name: "Ana Silva",
      role: "senior_consultant",
      fte_percent: "100.00",
      time_zone: "Europe/London",
      assignment_group_ids: [],
    },
    month: {
      working_days: 22,
      contracted_minutes: 10560,
      pto_minutes: 960,
      holiday_minutes: 480,
      overhead_minutes: 912,
      available_minutes: 8208,
      allocated_minutes: 3600,
      actual_minutes: 540,
      remaining_minutes: 4608,
      status: "available",
    },
    allocations: [{ account_id: ACCOUNT_ID, planned_minutes: 3600, note: null, version: 2 }],
    ...overrides,
  };
}

/** A second person, over their month: allocated past the available minutes on two accounts. */
export function anOverPerson(overrides: Partial<CapacityPerson> = {}): CapacityPerson {
  return aCapacityPerson({
    person: {
      id: OTHER_PERSON_ID,
      display_name: "Ben Ito",
      role: "consultant",
      fte_percent: "80.00",
      time_zone: "Europe/Lisbon",
      assignment_group_ids: [],
    },
    month: {
      working_days: 22,
      contracted_minutes: 8448,
      pto_minutes: 0,
      holiday_minutes: 0,
      overhead_minutes: 845,
      available_minutes: 7603,
      allocated_minutes: 8400,
      actual_minutes: 1230,
      remaining_minutes: 0,
      status: "over",
    },
    allocations: [
      { account_id: ACCOUNT_ID, planned_minutes: 6000, note: null, version: 1 },
      { account_id: OTHER_ACCOUNT_ID, planned_minutes: 2400, note: "Go-live support", version: 3 },
    ],
    ...overrides,
  });
}

/**
 * The month's demand as the view overlays it: 200 h of pipeline at 50
 * percent for a prospect (100 h weighted) and 40 h of project demand on
 * the first account, 140 h in all.
 */
export function aCapacityDemand(overrides: Partial<CapacityDemand> = {}): CapacityDemand {
  return {
    pipeline_minutes_weighted: 6000,
    project_minutes: 2400,
    total_minutes: 8400,
    by_subject: [
      { account_id: ACCOUNT_ID, account_key: "BRK", prospect_name: null, source: "project", hours: 40, probability: 1 },
      {
        account_id: null,
        account_key: null,
        prospect_name: "Acme Corp",
        source: "pipeline",
        hours: 200,
        probability: 0.5,
      },
    ],
    ...overrides,
  };
}

export function aCapacityView(overrides: Partial<CapacityView> = {}): CapacityView {
  const people = overrides.people ?? [aCapacityPerson(), anOverPerson()];
  return {
    month: "2026-09-01",
    people,
    demand: aCapacityDemand(),
    totals: {
      available_minutes: people.reduce((sum, row) => sum + row.month.available_minutes, 0),
      allocated_minutes: people.reduce((sum, row) => sum + row.month.allocated_minutes, 0),
      actual_minutes: people.reduce((sum, row) => sum + row.month.actual_minutes, 0),
      remaining_minutes: people.reduce((sum, row) => sum + row.month.remaining_minutes, 0),
    },
    ...overrides,
  };
}

export function aCapacityCheck(overrides: Partial<CapacityCheck> = {}): CapacityCheck {
  return {
    person_id: PERSON_ID,
    display_name: "Ana Silva",
    available_minutes: 8208,
    allocated_minutes: 3600,
    actual_minutes: 540,
    remaining_minutes: 4608,
    status: "available",
    ...overrides,
  };
}

/** Planned 40 h, logged 62 h: plus 22 h, 55 percent (the functional spec's own example). */
export function aVarianceLine(overrides: Partial<VarianceLine> = {}): VarianceLine {
  return {
    person_id: PERSON_ID,
    display_name: "Ana Silva",
    account_id: ACCOUNT_ID,
    planned_minutes: 2400,
    actual_minutes: 3720,
    variance_minutes: 1320,
    variance_ratio: 0.55,
    ...overrides,
  };
}

export function aVarianceReport(overrides: Partial<VarianceReport> = {}): VarianceReport {
  const lines = overrides.lines ?? [
    aVarianceLine(),
    aVarianceLine({
      person_id: OTHER_PERSON_ID,
      display_name: "Ben Ito",
      account_id: OTHER_ACCOUNT_ID,
      planned_minutes: 0,
      actual_minutes: 90,
      variance_minutes: 90,
      variance_ratio: null,
    }),
  ];
  return {
    month: "2026-09-01",
    lines,
    totals: {
      planned_minutes: lines.reduce((sum, line) => sum + line.planned_minutes, 0),
      actual_minutes: lines.reduce((sum, line) => sum + line.actual_minutes, 0),
      variance_minutes: lines.reduce((sum, line) => sum + line.variance_minutes, 0),
    },
    ...overrides,
  };
}

export function anAllocation(overrides: Partial<Allocation> = {}): Allocation {
  return {
    id: "al-1",
    person_id: PERSON_ID,
    account_id: ACCOUNT_ID,
    period_month: "2026-09-01",
    planned_minutes: 3600,
    note: null,
    updated_by: "u1",
    updated_at: "2026-09-01T09:00:00Z",
    version: 2,
    ...overrides,
  };
}

/**
 * The people lens (functional 5.8): three skills in two kinds; Ana is an
 * expert on OneStream, proficient on Anaplan and working on the close;
 * Ben is working on OneStream and proficient on Anaplan, nothing on the
 * close.
 */
export function aSkillsMatrixPeople(overrides: Partial<SkillsMatrixPeople> = {}): SkillsMatrixPeople {
  return {
    lens: "people",
    skills: [
      { id: "s-close", code: "close", name: "Financial close", kind: "process" },
      { id: "s-anaplan", code: "anaplan", name: "Anaplan", kind: "technology" },
      { id: "s-onestream", code: "onestream", name: "OneStream", kind: "technology" },
    ],
    people: [
      {
        id: PERSON_ID,
        display_name: "Ana Silva",
        role: "senior_consultant",
        levels: { onestream: 4, anaplan: 3, close: 2 },
      },
      { id: OTHER_PERSON_ID, display_name: "Ben Ito", role: "consultant", levels: { onestream: 2, anaplan: 3 } },
    ],
    ...overrides,
  };
}

/**
 * The account lens for Brookfield, whose contracts require Anaplan,
 * OneStream and SAP: Anaplan is covered by both, OneStream by Ana alone
 * (a single point of failure) and SAP by nobody (a gap).
 */
export function aSkillsMatrixAccount(overrides: Partial<SkillsMatrixAccount> = {}): SkillsMatrixAccount {
  return {
    lens: "account",
    required_level: 3,
    accounts: [
      {
        account_id: ACCOUNT_ID,
        key: "BRK",
        name: "Brookfield",
        technologies: [
          {
            code: "anaplan",
            status: "ok",
            qualified: [
              { person_id: PERSON_ID, display_name: "Ana Silva" },
              { person_id: OTHER_PERSON_ID, display_name: "Ben Ito" },
            ],
          },
          { code: "onestream", status: "spof", qualified: [{ person_id: PERSON_ID, display_name: "Ana Silva" }] },
          { code: "sap", status: "gap", qualified: [] },
        ],
        single_points_of_failure: ["onestream"],
        gaps: ["sap"],
      },
    ],
    ...overrides,
  };
}

export const DEMAND_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

export const OTHER_DEMAND_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

/** 200 h of pipeline at 50 percent for a prospect in December 2026: 100 h weighted. */
export function aDemandRow(overrides: Partial<DemandRow> = {}): DemandRow {
  return {
    id: DEMAND_ID,
    source: "pipeline",
    account_id: null,
    account_key: null,
    prospect_name: "Acme Corp",
    period_month: "2026-12-01",
    hours: 200,
    probability: 0.5,
    role: "architect",
    note: "Two pursuits closing",
    entered_by: "u1",
    created_at: "2026-09-01T09:00:00Z",
    ...overrides,
  };
}

/** 40 h of committed project demand on the first account in the same month. */
export function aProjectDemandRow(overrides: Partial<DemandRow> = {}): DemandRow {
  return aDemandRow({
    id: OTHER_DEMAND_ID,
    source: "project",
    account_id: ACCOUNT_ID,
    account_key: "BRK",
    prospect_name: null,
    hours: 40,
    probability: 1,
    role: null,
    note: "",
    ...overrides,
  });
}

/** September to December 2026: the project row and the pipeline row, 140 h weighted in all. */
export function aDemandList(overrides: Partial<DemandList> = {}): DemandList {
  const rows = overrides.rows ?? [aProjectDemandRow(), aDemandRow()];
  let pipeline = 0;
  let project = 0;
  for (const row of rows) {
    if (row.source === "project") project += row.hours * 60;
    else pipeline += row.hours * 60 * row.probability;
  }
  return {
    from: "2026-09-01",
    to: "2026-12-01",
    rows,
    totals: {
      pipeline_minutes_weighted: Math.round(pipeline),
      project_minutes: Math.round(project),
      total_minutes: Math.round(pipeline + project),
    },
    ...overrides,
  };
}

export function anImportResult(overrides: Partial<ImportDemandResult> = {}): ImportDemandResult {
  const rows = overrides.rows ?? [
    aProjectDemandRow({ id: "d-imp-1", source: "import", note: "imported line 2" }),
    aDemandRow({ id: "d-imp-2", source: "import", note: "imported line 3", probability: 0.25 }),
  ];
  return { imported: rows.length, rows, ...overrides };
}
