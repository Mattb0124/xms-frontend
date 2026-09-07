import { xmsApi } from "@/redux/api";

/**
 * The roster (Capacity & Allocation functional 5.2, technical 2.1 to 2.3;
 * CAP-01; P2.12.1): people with a working calendar, skills and
 * certifications, imported from the sign-in directory or created by hand.
 * Reading needs `capacity:view`; create, patch and import need `admin:users`;
 * the calendar, skills and certifications need `capacity:manage`. There is no
 * rate field in this cut and nothing here renders one. The list carries the
 * `Roster` tag and every person mutation invalidates it, so the dense list
 * refreshes after a save without a manual refetch.
 */
export type SkillKind = "technology" | "account" | "process";

export interface PersonSkill {
  skill_id: string;
  code: string;
  name: string;
  kind: SkillKind | string;
  /** 1 Aware, 2 Working, 3 Proficient, 4 Expert. */
  level: number;
  assessed_on: string;
  assessed_by: string;
}

export interface Person {
  id: string;
  user_id: string | null;
  display_name: string;
  email: string;
  /** snake_case role code (consultant, team_lead, ...). */
  role: string;
  /** Numeric strings from the API; the browser formats, never recomputes. */
  fte_percent: string;
  hours_base_per_week: string;
  admin_overhead_percent: string | null;
  currency: string;
  country: string | null;
  time_zone: string;
  holiday_calendar_id: string | null;
  assignment_group_ids: string[];
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  version: number;
  skills: PersonSkill[];
}

export interface PersonCalendar {
  /** ISO weekday numbers, 1 Monday to 7 Sunday. */
  working_days: number[];
  day_start: string;
  day_end: string;
  /** Derived by the API from day_start and day_end. */
  hours_per_day: string;
}

export interface Certification {
  id: string;
  name: string;
  issuer: string | null;
  obtained_on: string;
  expires_on: string | null;
}

export interface PersonDetail extends Person {
  calendar: PersonCalendar | null;
  certifications: Certification[];
}

export interface Skill {
  id: string;
  kind: SkillKind;
  code: string;
  name: string;
  account_id: string | null;
  is_active: boolean;
}

export interface PeopleFilter {
  active?: "true" | "false" | "all";
  role?: string;
  group?: string;
  skill?: string;
  q?: string;
}

export interface CreatePersonBody {
  display_name: string;
  email: string;
  role: string;
  user_id?: string;
  fte_percent?: number;
  hours_base_per_week?: number;
  admin_overhead_percent?: number | null;
  currency?: string;
  country?: string | null;
  time_zone?: string;
  holiday_calendar_id?: string | null;
  assignment_group_ids?: string[];
  start_date?: string | null;
  end_date?: string | null;
}

export interface PatchPersonBody extends Partial<CreatePersonBody> {
  version: number;
  is_active?: boolean;
}

export interface PersonCalendarBody {
  working_days: number[];
  day_start: string;
  day_end: string;
}

export interface SkillLevelInput {
  skill_id?: string;
  code?: string;
  level: number;
}

export interface CreateSkillBody {
  kind: SkillKind;
  code: string;
  name: string;
  account_id?: string;
}

export interface CertificationBody {
  name: string;
  issuer?: string;
  obtained_on: string;
  expires_on?: string;
}

export interface ImportResult {
  created: number;
  people: { id: string; email: string; role: string }[];
}

function cleanParams(filter: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(filter).filter((entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== ""),
  );
}

export const rosterApi = xmsApi.injectEndpoints({
  endpoints: (build) => ({
    listPeople: build.query<Person[], PeopleFilter | void>({
      query: (filter) => ({ url: "/v1/roster/people", params: cleanParams({ ...(filter ?? {}) }) }),
      providesTags: (result) => [
        "Roster",
        ...(result ?? []).map((person) => ({ type: "Person" as const, id: person.id })),
      ],
    }),
    createPerson: build.mutation<Person, CreatePersonBody>({
      query: (body) => ({ url: "/v1/roster/people", method: "POST", body }),
      invalidatesTags: ["Roster"],
    }),
    importRoster: build.mutation<ImportResult, void>({
      query: () => ({ url: "/v1/roster/import", method: "POST" }),
      invalidatesTags: ["Roster"],
    }),
    getPerson: build.query<PersonDetail, string>({
      query: (id) => `/v1/roster/people/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Person", id }],
    }),
    patchPerson: build.mutation<Person, { id: string; body: PatchPersonBody }>({
      query: ({ id, body }) => ({ url: `/v1/roster/people/${id}`, method: "PATCH", body }),
      invalidatesTags: (_result, _error, { id }) => [{ type: "Person", id }, "Roster"],
    }),
    setPersonCalendar: build.mutation<PersonCalendar, { id: string; body: PersonCalendarBody }>({
      query: ({ id, body }) => ({ url: `/v1/roster/people/${id}/calendar`, method: "PUT", body }),
      invalidatesTags: (_result, _error, { id }) => [{ type: "Person", id }],
    }),
    listSkills: build.query<Skill[], { include_inactive?: boolean } | void>({
      query: (options) => ({
        url: "/v1/roster/skills",
        params: options?.include_inactive ? { include_inactive: "true" } : undefined,
      }),
      providesTags: ["Skills"],
    }),
    createSkill: build.mutation<Skill, CreateSkillBody>({
      query: (body) => ({ url: "/v1/roster/skills", method: "POST", body }),
      invalidatesTags: ["Skills"],
    }),
    getPersonSkills: build.query<PersonSkill[], string>({
      query: (id) => `/v1/roster/people/${id}/skills`,
      providesTags: (_result, _error, id) => [{ type: "Person", id: `${id}:skills` }],
    }),
    setPersonSkills: build.mutation<PersonSkill[], { id: string; skills: SkillLevelInput[] }>({
      query: ({ id, skills }) => ({ url: `/v1/roster/people/${id}/skills`, method: "PUT", body: { skills } }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Person", id },
        { type: "Person", id: `${id}:skills` },
        "Roster",
      ],
    }),
    listCertifications: build.query<Certification[], string>({
      query: (id) => `/v1/roster/people/${id}/certifications`,
      providesTags: (_result, _error, id) => [{ type: "Certifications", id }],
    }),
    addCertification: build.mutation<Certification, { id: string; body: CertificationBody }>({
      query: ({ id, body }) => ({ url: `/v1/roster/people/${id}/certifications`, method: "POST", body }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Certifications", id },
        { type: "Person", id },
      ],
    }),
    removeCertification: build.mutation<void, { id: string; certificationId: string }>({
      query: ({ id, certificationId }) => ({
        url: `/v1/roster/people/${id}/certifications/${certificationId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Certifications", id },
        { type: "Person", id },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListPeopleQuery,
  useCreatePersonMutation,
  useImportRosterMutation,
  useGetPersonQuery,
  usePatchPersonMutation,
  useSetPersonCalendarMutation,
  useListSkillsQuery,
  useCreateSkillMutation,
  useGetPersonSkillsQuery,
  useSetPersonSkillsMutation,
  useListCertificationsQuery,
  useAddCertificationMutation,
  useRemoveCertificationMutation,
} = rosterApi;
