import { xmsApi } from "@/redux/api";

/**
 * Capacity (Capacity & Allocation functional 5.3 to 5.9, technical 2.4 to
 * 2.9; CAP-02 to CAP-08): PTO per person, the month view per person with
 * the demand overlay, the assignment-time check, planned versus actual, the
 * allocation grid cells, the skills matrix in both lenses and forward
 * demand (list, add, remove, import). Every minute figure is the server's; the browser formats hours and
 * never recomputes a month. PTO is readable and writable by the person
 * themselves or under `capacity:manage` (the route needs `time:log`); the
 * view, the variance and the allocation list need `capacity:view`; the
 * check needs `tickets:work`; writing cells needs `capacity:manage`.
 */
export type PtoKind = "vacation" | "sick" | "other";

export interface Pto {
  id: string;
  person_id: string;
  starts_on: string;
  ends_on: string;
  kind: PtoKind;
  /** Numeric string from the API ("1.00", "0.50"). */
  fraction: string;
  note: string;
  entered_by: string;
  created_at: string;
}

export interface CreatePtoBody {
  starts_on: string;
  ends_on: string;
  kind: PtoKind;
  /** 0.25 to 1; the server defaults to a full day. */
  fraction?: number;
  note?: string;
}

export type CapacityStatus = "available" | "warning" | "over" | "no_calendar";

/** One person's month as the server computed it (CAP-03). */
export interface CapacityMonth {
  working_days: number;
  contracted_minutes: number;
  pto_minutes: number;
  holiday_minutes: number;
  overhead_minutes: number;
  available_minutes: number;
  allocated_minutes: number;
  actual_minutes: number;
  remaining_minutes: number;
  status: CapacityStatus;
}

/** A grid cell as the view carries it: the planned minutes on one account with the version to send back. */
export interface CapacityAllocationCell {
  account_id: string;
  planned_minutes: number;
  note: string | null;
  version: number;
}

export interface CapacityPersonSummary {
  id: string;
  display_name: string;
  role: string;
  fte_percent: string;
  time_zone: string;
  assignment_group_ids: string[];
}

export interface CapacityPerson {
  person: CapacityPersonSummary;
  month: CapacityMonth;
  allocations: CapacityAllocationCell[];
}

export interface CapacityTotals {
  available_minutes: number;
  allocated_minutes: number;
  actual_minutes: number;
  remaining_minutes: number;
}

/** One demand line as the month view overlays it (5.7): an account or a prospect with its hours and probability. */
export interface CapacityDemandSubject {
  account_id: string | null;
  account_key: string | null;
  prospect_name: string | null;
  source: DemandSource;
  hours: number;
  probability: number;
}

export interface CapacityDemand extends DemandTotals {
  by_subject: CapacityDemandSubject[];
}

export interface CapacityView {
  /** "YYYY-MM-01" as the server names the month. */
  month: string;
  people: CapacityPerson[];
  /** The month's forward demand, weighted by the server (CAP-08). */
  demand: CapacityDemand;
  totals: CapacityTotals;
}

/** The view's filter; the query parameter names are the API's. */
export interface CapacityFilter {
  /** "YYYY-MM"; the server defaults to the current month. */
  month?: string;
  group?: string;
  role?: string;
  account?: string;
}

/** CAP-06: one candidate's room this month, from the same math as the view. */
export interface CapacityCheck {
  person_id: string;
  display_name: string;
  available_minutes: number;
  allocated_minutes: number;
  actual_minutes: number;
  remaining_minutes: number;
  status: CapacityStatus;
}

/** CAP-05: one person on one account for the month. */
export interface VarianceLine {
  person_id: string;
  display_name: string;
  account_id: string;
  planned_minutes: number;
  actual_minutes: number;
  variance_minutes: number;
  /** variance over planned; null when nothing was planned. */
  variance_ratio: number | null;
}

export interface VarianceReport {
  month: string;
  lines: VarianceLine[];
  totals: { planned_minutes: number; actual_minutes: number; variance_minutes: number };
}

export interface VarianceFilter {
  month?: string;
  account?: string;
  person?: string;
}

/** One stored allocation cell (CAP-04). */
export interface Allocation {
  id: string;
  person_id: string;
  account_id: string;
  /** "YYYY-MM-01". */
  period_month: string;
  planned_minutes: number;
  note: string | null;
  updated_by: string;
  updated_at: string;
  version: number;
}

export interface AllocationsFilter {
  account?: string;
  /** "YYYY-MM". */
  from?: string;
  to?: string;
}

/** A cell to upsert; `version` is the one the grid read, so a concurrent edit is refused as stale_version. */
export interface AllocationCellBody {
  person_id: string;
  account_id: string;
  /** "YYYY-MM-01". */
  month: string;
  planned_minutes: number;
  note?: string | null;
  version?: number;
}

export interface PutAllocationsBody {
  cells: AllocationCellBody[];
}

export interface RemovedCell {
  removed: true;
  person_id: string;
  account_id: string;
  month: string;
}

export interface PutAllocationsResult {
  cells: (Allocation | RemovedCell)[];
}

// Skills matrix (functional 5.8, CAP-07) ---------------------------------------

export type SkillsLens = "people" | "account";

export interface MatrixSkill {
  id: string;
  code: string;
  name: string;
  /** technology, account or process; the heat map groups columns by it. */
  kind: string;
}

export interface MatrixPerson {
  id: string;
  display_name: string;
  role: string;
  /** Level 1 to 4 per skill code; a code absent means no level. */
  levels: Record<string, number>;
}

/** The people lens: people as rows, active skills as columns, the level per cell. */
export interface SkillsMatrixPeople {
  lens: "people";
  skills: MatrixSkill[];
  people: MatrixPerson[];
}

/** ok: two or more at the required level; spof: exactly one; gap: nobody. */
export type CoverageStatus = "ok" | "spof" | "gap";

export interface TechnologyCoverage {
  code: string;
  status: CoverageStatus;
  qualified: { person_id: string; display_name: string }[];
}

export interface AccountCoverage {
  account_id: string;
  key: string;
  name: string;
  /** The union of the technology codes on the account's active contracts, sorted. */
  technologies: TechnologyCoverage[];
  single_points_of_failure: string[];
  gaps: string[];
}

/** The account lens: per granted account (or the one asked for), the required technologies and who qualifies. */
export interface SkillsMatrixAccount {
  lens: "account";
  /** The level a person needs to count (3). */
  required_level: number;
  accounts: AccountCoverage[];
}

// Forward demand (functional 5.7, CAP-08) ----------------------------------------

export type DemandSource = "pipeline" | "project" | "import";

export interface DemandRow {
  id: string;
  source: DemandSource;
  account_id: string | null;
  /** The account key when the row names an account; null for a prospect. */
  account_key: string | null;
  prospect_name: string | null;
  /** "YYYY-MM-01". */
  period_month: string;
  hours: number;
  /** 1 for project demand. */
  probability: number;
  role: string | null;
  note: string;
  entered_by: string;
  created_at: string;
}

export interface DemandTotals {
  /** Pipeline hours times probability, in minutes. */
  pipeline_minutes_weighted: number;
  project_minutes: number;
  total_minutes: number;
}

export interface DemandList {
  /** "YYYY-MM-01" as the server names the months. */
  from: string;
  to: string;
  account?: string;
  rows: DemandRow[];
  totals: DemandTotals;
}

/** The list filter; the query parameter names are the API's. `to` defaults to `from` on the server. */
export interface DemandFilter {
  /** "YYYY-MM". */
  from?: string;
  to?: string;
  account?: string;
}

/** One line entered by hand: an account or a prospect (subject_required otherwise); probability only counts for pipeline. */
export interface CreateDemandBody {
  source: "pipeline" | "project";
  account_id?: string;
  prospect_name?: string;
  /** "YYYY-MM". */
  month: string;
  hours: number;
  /** 0.01 to 1; ignored for project demand. */
  probability?: number;
  role?: string;
  note?: string;
}

export interface ImportDemandResult {
  imported: number;
  rows: DemandRow[];
}

function cleanParams(filter: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(filter).filter((entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== ""),
  );
}

function ptoTag(personId: string) {
  return { type: "Pto" as const, id: personId };
}

export const capacityApi = xmsApi.injectEndpoints({
  endpoints: (build) => ({
    listPto: build.query<Pto[], string>({
      query: (personId) => `/v1/roster/people/${personId}/pto`,
      providesTags: (_result, _error, personId) => [ptoTag(personId)],
    }),
    addPto: build.mutation<Pto, { personId: string; body: CreatePtoBody }>({
      query: ({ personId, body }) => ({ url: `/v1/roster/people/${personId}/pto`, method: "POST", body }),
      // Entering PTO recomputes the affected months (5.3), so the view reloads too.
      invalidatesTags: (_result, error, { personId }) => (error ? [] : [ptoTag(personId), "Capacity"]),
    }),
    removePto: build.mutation<{ removed: string }, { personId: string; ptoId: string }>({
      query: ({ personId, ptoId }) => ({ url: `/v1/roster/people/${personId}/pto/${ptoId}`, method: "DELETE" }),
      invalidatesTags: (_result, error, { personId }) => (error ? [] : [ptoTag(personId), "Capacity"]),
    }),
    capacityView: build.query<CapacityView, CapacityFilter | void>({
      query: (filter) => ({ url: "/v1/capacity", params: cleanParams({ ...(filter ?? {}) }) }),
      providesTags: ["Capacity"],
    }),
    capacityCheck: build.query<CapacityCheck[], { personIds: string[]; month?: string }>({
      query: ({ personIds, month }) => ({
        url: "/v1/capacity/check",
        params: cleanParams({ person_ids: personIds.slice(0, 50).join(","), month }),
      }),
      providesTags: ["Capacity"],
    }),
    capacityVariance: build.query<VarianceReport, VarianceFilter | void>({
      query: (filter) => ({ url: "/v1/capacity/variance", params: cleanParams({ ...(filter ?? {}) }) }),
      providesTags: ["Capacity"],
    }),
    skillsMatrixPeople: build.query<SkillsMatrixPeople, void>({
      query: () => ({ url: "/v1/capacity/skills-matrix", params: { lens: "people" } }),
      providesTags: ["SkillsMatrix"],
    }),
    skillsMatrixAccount: build.query<SkillsMatrixAccount, { account?: string } | void>({
      query: (filter) => ({
        url: "/v1/capacity/skills-matrix",
        params: cleanParams({ lens: "account", account: filter?.account }),
      }),
      providesTags: ["SkillsMatrix"],
    }),
    listDemand: build.query<DemandList, DemandFilter | void>({
      query: (filter) => ({ url: "/v1/demand", params: cleanParams({ ...(filter ?? {}) }) }),
      providesTags: ["Demand"],
    }),
    addDemand: build.mutation<DemandRow, CreateDemandBody>({
      query: (body) => ({ url: "/v1/demand", method: "POST", body }),
      // The month view overlays demand, so it reloads with the list.
      invalidatesTags: (_result, error) => (error ? [] : ["Demand", "Capacity"]),
    }),
    removeDemand: build.mutation<{ removed: string }, string>({
      query: (id) => ({ url: `/v1/demand/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, error) => (error ? [] : ["Demand", "Capacity"]),
    }),
    importDemand: build.mutation<ImportDemandResult, { content: string }>({
      query: (body) => ({ url: "/v1/demand/import", method: "POST", body }),
      invalidatesTags: (_result, error) => (error ? [] : ["Demand", "Capacity"]),
    }),
    listAllocations: build.query<Allocation[], AllocationsFilter | void>({
      query: (filter) => ({ url: "/v1/allocations", params: cleanParams({ ...(filter ?? {}) }) }),
      providesTags: ["Allocations"],
    }),
    putAllocations: build.mutation<PutAllocationsResult, PutAllocationsBody>({
      query: (body) => ({ url: "/v1/allocations", method: "PUT", body }),
      // A stale_version refusal means someone else wrote the grid: reload it either way.
      invalidatesTags: ["Allocations", "Capacity"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListPtoQuery,
  useAddPtoMutation,
  useRemovePtoMutation,
  useCapacityViewQuery,
  useCapacityCheckQuery,
  useCapacityVarianceQuery,
  useSkillsMatrixPeopleQuery,
  useSkillsMatrixAccountQuery,
  useListDemandQuery,
  useAddDemandMutation,
  useRemoveDemandMutation,
  useImportDemandMutation,
  useListAllocationsQuery,
  usePutAllocationsMutation,
} = capacityApi;
