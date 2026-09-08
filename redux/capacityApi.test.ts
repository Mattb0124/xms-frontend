import { afterEach, describe, expect, it, vi } from "vitest";
import {
  capacityApi,
  type Allocation,
  type CapacityCheck,
  type CapacityDemand,
  type CapacityPerson,
  type CapacityView,
  type DemandList,
  type DemandRow,
  type ImportDemandResult,
  type Pto,
  type SkillsMatrixAccount,
  type SkillsMatrixPeople,
  type VarianceLine,
  type VarianceReport,
} from "@/redux/capacityApi";
import { PERSON_ID } from "@/redux/rosterApi.test";
import { makeStore } from "@/redux/store";
import { json, stubFetch } from "@/test-kit/portal";

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

describe("capacityApi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads PTO, the view with its filters, the check, the variance and the allocations with the API's parameter names", async () => {
    const calls = stubFetch({
      [`GET /v1/roster/people/${PERSON_ID}/pto`]: () => json([aPto()]),
      "GET /v1/capacity": () => json(aCapacityView()),
      "GET /v1/capacity/check": () => json([aCapacityCheck()]),
      "GET /v1/capacity/variance": () => json(aVarianceReport()),
      "GET /v1/allocations": () => json([anAllocation()]),
    });
    const store = makeStore();
    await store.dispatch(capacityApi.endpoints.listPto.initiate(PERSON_ID)).unwrap();
    await store.dispatch(capacityApi.endpoints.capacityView.initiate()).unwrap();
    const view = await store
      .dispatch(
        capacityApi.endpoints.capacityView.initiate({
          month: "2026-09",
          group: "g-1",
          role: "consultant",
          account: ACCOUNT_ID,
        }),
      )
      .unwrap();
    expect(view.totals.allocated_minutes).toBe(12000);
    await store
      .dispatch(
        capacityApi.endpoints.capacityCheck.initiate({ personIds: [PERSON_ID, OTHER_PERSON_ID], month: "2026-09" }),
      )
      .unwrap();
    await store
      .dispatch(
        capacityApi.endpoints.capacityVariance.initiate({ month: "2026-09", account: ACCOUNT_ID, person: PERSON_ID }),
      )
      .unwrap();
    await store
      .dispatch(capacityApi.endpoints.listAllocations.initiate({ account: ACCOUNT_ID, from: "2026-09", to: "2026-11" }))
      .unwrap();
    expect(calls.map((call) => `${call.key}${decodeURIComponent(call.search)}`)).toEqual([
      `GET /v1/roster/people/${PERSON_ID}/pto`,
      "GET /v1/capacity",
      `GET /v1/capacity?month=2026-09&group=g-1&role=consultant&account=${ACCOUNT_ID}`,
      `GET /v1/capacity/check?person_ids=${PERSON_ID},${OTHER_PERSON_ID}&month=2026-09`,
      `GET /v1/capacity/variance?month=2026-09&account=${ACCOUNT_ID}&person=${PERSON_ID}`,
      `GET /v1/allocations?account=${ACCOUNT_ID}&from=2026-09&to=2026-11`,
    ]);
  });

  it("caps the check at 50 ids", async () => {
    const calls = stubFetch({ "GET /v1/capacity/check": () => json([]) });
    const store = makeStore();
    const ids = Array.from({ length: 60 }, (_, index) => `p-${index}`);
    await store.dispatch(capacityApi.endpoints.capacityCheck.initiate({ personIds: ids })).unwrap();
    const sent = new URLSearchParams(calls[0].search).get("person_ids")?.split(",") ?? [];
    expect(sent).toHaveLength(50);
    expect(sent[0]).toBe("p-0");
    expect(sent[49]).toBe("p-49");
    expect(calls[0].search).not.toContain("month");
  });

  it("sends the PTO and allocation mutations with the contract bodies", async () => {
    const calls = stubFetch({
      [`POST /v1/roster/people/${PERSON_ID}/pto`]: () => json(aPto({ fraction: "0.50" }), 201),
      [`DELETE /v1/roster/people/${PERSON_ID}/pto/${PTO_ID}`]: () => json({ removed: PTO_ID }),
      "PUT /v1/allocations": () =>
        json({
          cells: [
            anAllocation({ version: 3 }),
            { removed: true, person_id: PERSON_ID, account_id: OTHER_ACCOUNT_ID, month: "2026-09-01" },
          ],
        }),
    });
    const store = makeStore();
    const pto = await store
      .dispatch(
        capacityApi.endpoints.addPto.initiate({
          personId: PERSON_ID,
          body: { starts_on: "2026-09-21", ends_on: "2026-09-21", kind: "sick", fraction: 0.5, note: "Dentist" },
        }),
      )
      .unwrap();
    expect(pto.fraction).toBe("0.50");
    await store.dispatch(capacityApi.endpoints.removePto.initiate({ personId: PERSON_ID, ptoId: PTO_ID })).unwrap();
    const put = await store
      .dispatch(
        capacityApi.endpoints.putAllocations.initiate({
          cells: [
            { person_id: PERSON_ID, account_id: ACCOUNT_ID, month: "2026-09-01", planned_minutes: 4200, version: 2 },
            { person_id: PERSON_ID, account_id: OTHER_ACCOUNT_ID, month: "2026-09-01", planned_minutes: 0 },
          ],
        }),
      )
      .unwrap();
    expect(put.cells[1]).toMatchObject({ removed: true });
    expect(calls.map((call) => [call.key, call.body])).toEqual([
      [
        `POST /v1/roster/people/${PERSON_ID}/pto`,
        { starts_on: "2026-09-21", ends_on: "2026-09-21", kind: "sick", fraction: 0.5, note: "Dentist" },
      ],
      [`DELETE /v1/roster/people/${PERSON_ID}/pto/${PTO_ID}`, undefined],
      [
        "PUT /v1/allocations",
        {
          cells: [
            { person_id: PERSON_ID, account_id: ACCOUNT_ID, month: "2026-09-01", planned_minutes: 4200, version: 2 },
            { person_id: PERSON_ID, account_id: OTHER_ACCOUNT_ID, month: "2026-09-01", planned_minutes: 0 },
          ],
        },
      ],
    ]);
  });

  it("reads both lenses of the skills matrix and the demand list with the API's parameter names", async () => {
    const calls = stubFetch({
      "GET /v1/capacity/skills-matrix": () => json(aSkillsMatrixPeople()),
      "GET /v1/demand": () => json(aDemandList()),
    });
    const store = makeStore();
    const people = await store.dispatch(capacityApi.endpoints.skillsMatrixPeople.initiate()).unwrap();
    expect(people.people[0].levels.onestream).toBe(4);
    await store.dispatch(capacityApi.endpoints.skillsMatrixAccount.initiate()).unwrap();
    await store.dispatch(capacityApi.endpoints.skillsMatrixAccount.initiate({ account: ACCOUNT_ID })).unwrap();
    await store.dispatch(capacityApi.endpoints.listDemand.initiate()).unwrap();
    const list = await store
      .dispatch(capacityApi.endpoints.listDemand.initiate({ from: "2026-09", to: "2026-12", account: ACCOUNT_ID }))
      .unwrap();
    expect(list.totals).toEqual({ pipeline_minutes_weighted: 6000, project_minutes: 2400, total_minutes: 8400 });
    expect(calls.map((call) => `${call.key}${decodeURIComponent(call.search)}`)).toEqual([
      "GET /v1/capacity/skills-matrix?lens=people",
      "GET /v1/capacity/skills-matrix?lens=account",
      `GET /v1/capacity/skills-matrix?lens=account&account=${ACCOUNT_ID}`,
      "GET /v1/demand",
      `GET /v1/demand?from=2026-09&to=2026-12&account=${ACCOUNT_ID}`,
    ]);
  });

  it("adds, removes and imports demand with the contract bodies, reloading the list and the month view", async () => {
    let lists = 0;
    let views = 0;
    const calls = stubFetch({
      "GET /v1/demand": () => {
        lists += 1;
        return json(aDemandList());
      },
      "GET /v1/capacity": () => {
        views += 1;
        return json(aCapacityView());
      },
      "POST /v1/demand": () => json(aDemandRow(), 201),
      [`DELETE /v1/demand/${DEMAND_ID}`]: () => json({ removed: DEMAND_ID }),
      "POST /v1/demand/import": () => json(anImportResult(), 201),
    });
    const store = makeStore();
    const list = store.dispatch(capacityApi.endpoints.listDemand.initiate({ from: "2026-12" }));
    const view = store.dispatch(capacityApi.endpoints.capacityView.initiate({ month: "2026-12" }));
    await list.unwrap();
    await view.unwrap();
    const added = await store
      .dispatch(
        capacityApi.endpoints.addDemand.initiate({
          source: "pipeline",
          prospect_name: "Acme Corp",
          month: "2026-12",
          hours: 200,
          probability: 0.5,
          role: "architect",
          note: "Two pursuits closing",
        }),
      )
      .unwrap();
    expect(added.id).toBe(DEMAND_ID);
    await vi.waitFor(() => expect([lists, views]).toEqual([2, 2]));
    await store.dispatch(capacityApi.endpoints.removeDemand.initiate(DEMAND_ID)).unwrap();
    await vi.waitFor(() => expect([lists, views]).toEqual([3, 3]));
    const content = "source,account,month,hours\nproject,BRK,2026-12,40\n";
    const imported = await store.dispatch(capacityApi.endpoints.importDemand.initiate({ content })).unwrap();
    expect(imported.imported).toBe(2);
    await vi.waitFor(() => expect([lists, views]).toEqual([4, 4]));
    expect(calls.filter((call) => !call.key.startsWith("GET")).map((call) => [call.key, call.body])).toEqual([
      [
        "POST /v1/demand",
        {
          source: "pipeline",
          prospect_name: "Acme Corp",
          month: "2026-12",
          hours: 200,
          probability: 0.5,
          role: "architect",
          note: "Two pursuits closing",
        },
      ],
      [`DELETE /v1/demand/${DEMAND_ID}`, undefined],
      ["POST /v1/demand/import", { content }],
    ]);
    list.unsubscribe();
    view.unsubscribe();
  });

  it("leaves the list alone when an import is refused, so the problems stay on screen", async () => {
    let lists = 0;
    stubFetch({
      "GET /v1/demand": () => {
        lists += 1;
        return json(aDemandList());
      },
      "POST /v1/demand/import": () =>
        json({ code: "invalid_import", problems: [{ line: 2, problem: 'month must be YYYY-MM, got "2026-13"' }] }, 400),
    });
    const store = makeStore();
    const list = store.dispatch(capacityApi.endpoints.listDemand.initiate({ from: "2026-12" }));
    await list.unwrap();
    await expect(
      store
        .dispatch(capacityApi.endpoints.importDemand.initiate({ content: "source,month,hours\npipeline,2026-13,10" }))
        .unwrap(),
    ).rejects.toMatchObject({ status: 400, data: { code: "invalid_import" } });
    expect(lists).toBe(1);
    list.unsubscribe();
  });

  it("reloads the view after PTO is entered and after cells are written, even when the write is refused as stale", async () => {
    let views = 0;
    stubFetch({
      "GET /v1/capacity": () => {
        views += 1;
        return json(aCapacityView());
      },
      [`POST /v1/roster/people/${PERSON_ID}/pto`]: () => json(aPto(), 201),
      "PUT /v1/allocations": () => json({ code: "stale_version", entity: "allocation", current: 3 }, 409),
    });
    const store = makeStore();
    const subscription = store.dispatch(capacityApi.endpoints.capacityView.initiate({ month: "2026-09" }));
    await subscription.unwrap();
    await store
      .dispatch(
        capacityApi.endpoints.addPto.initiate({
          personId: PERSON_ID,
          body: { starts_on: "2026-09-21", ends_on: "2026-09-21", kind: "other" },
        }),
      )
      .unwrap();
    await vi.waitFor(() => expect(views).toBe(2));
    await expect(
      store
        .dispatch(
          capacityApi.endpoints.putAllocations.initiate({
            cells: [
              { person_id: PERSON_ID, account_id: ACCOUNT_ID, month: "2026-09-01", planned_minutes: 60, version: 1 },
            ],
          }),
        )
        .unwrap(),
    ).rejects.toMatchObject({ status: 409, data: { code: "stale_version", current: 3 } });
    await vi.waitFor(() => expect(views).toBe(3));
    subscription.unsubscribe();
  });
});
