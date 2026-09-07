import { xmsApi } from "@/redux/api";

/**
 * Capacity (Capacity & Allocation functional 5.3 to 5.6 and 5.9, technical
 * 2.4 to 2.9; CAP-02 to CAP-06): PTO per person, the month view per person,
 * the assignment-time check, planned versus actual and the allocation grid
 * cells. Every minute figure is the server's; the browser formats hours and
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
}

export interface CapacityView {
  /** "YYYY-MM-01" as the server names the month. */
  month: string;
  people: CapacityPerson[];
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
  totals: { planned_minutes: number; actual_minutes: number };
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
  useListAllocationsQuery,
  usePutAllocationsMutation,
} = capacityApi;
