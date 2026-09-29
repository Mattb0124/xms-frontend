import type { Certification, Person, PersonDetail, PersonSkill, Skill } from "@/redux/rosterApi";

/** Constructed roster fixtures, shared by every test that reads one. */

/** Constructed roster fixtures shared by the roster tests. */
export const PERSON_ID = "11111111-1111-4111-8111-111111111111";

export const SKILL_ID = "22222222-2222-4222-8222-222222222222";

export const GROUP_ID = "33333333-3333-4333-8333-333333333333";

export function aSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: SKILL_ID,
    kind: "technology",
    code: "onestream",
    name: "OneStream",
    account_id: null,
    is_active: true,
    ...overrides,
  };
}

export function aPersonSkill(overrides: Partial<PersonSkill> = {}): PersonSkill {
  return {
    skill_id: SKILL_ID,
    code: "onestream",
    name: "OneStream",
    kind: "technology",
    level: 3,
    assessed_on: "2026-09-01",
    assessed_by: "u1",
    ...overrides,
  };
}

export function aPerson(overrides: Partial<Person> = {}): Person {
  return {
    id: PERSON_ID,
    user_id: "u-ana",
    display_name: "Ana Silva",
    email: "ana.silva@example.com",
    role: "senior_consultant",
    fte_percent: "100.00",
    hours_base_per_week: "40.00",
    admin_overhead_percent: "15.00",
    currency: "GBP",
    country: "GB",
    time_zone: "Europe/London",
    holiday_calendar_id: null,
    assignment_group_ids: [GROUP_ID],
    start_date: "2024-01-08",
    end_date: null,
    is_active: true,
    version: 2,
    skills: [aPersonSkill()],
    ...overrides,
  };
}

export function aCertification(overrides: Partial<Certification> = {}): Certification {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    name: "OneStream Certified Associate",
    issuer: "OneStream",
    obtained_on: "2025-03-01",
    expires_on: "2028-03-01",
    ...overrides,
  };
}

export function aPersonDetail(overrides: Partial<PersonDetail> = {}): PersonDetail {
  return {
    ...aPerson(),
    calendar: { working_days: [1, 2, 3, 4, 5], day_start: "09:00", day_end: "17:30", hours_per_day: "8.50" },
    certifications: [aCertification()],
    ...overrides,
  };
}
