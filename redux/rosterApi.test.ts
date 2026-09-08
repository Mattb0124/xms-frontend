import { afterEach, describe, expect, it, vi } from "vitest";
import { describeRosterError, rosterError } from "@/lib/roster/errors";
import {
  rosterApi,
  type Certification,
  type Person,
  type PersonDetail,
  type PersonSkill,
  type Skill,
} from "@/redux/rosterApi";
import { makeStore } from "@/redux/store";
import { json, stubFetch } from "@/test-kit/portal";

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

describe("rosterApi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads the list with its filters, the record, the catalog, the skills and the certifications", async () => {
    const calls = stubFetch({
      "GET /v1/roster/people": () => json([aPerson()]),
      [`GET /v1/roster/people/${PERSON_ID}`]: () => json(aPersonDetail()),
      "GET /v1/roster/skills": () => json([aSkill()]),
      [`GET /v1/roster/people/${PERSON_ID}/skills`]: () => json([aPersonSkill()]),
      [`GET /v1/roster/people/${PERSON_ID}/certifications`]: () => json([aCertification()]),
    });
    const store = makeStore();
    await store.dispatch(rosterApi.endpoints.listPeople.initiate()).unwrap();
    await store
      .dispatch(
        rosterApi.endpoints.listPeople.initiate({
          active: "all",
          role: "consultant",
          group: GROUP_ID,
          skill: "onestream",
          q: "ana",
        }),
      )
      .unwrap();
    await store.dispatch(rosterApi.endpoints.getPerson.initiate(PERSON_ID)).unwrap();
    await store.dispatch(rosterApi.endpoints.listSkills.initiate()).unwrap();
    await store.dispatch(rosterApi.endpoints.listSkills.initiate({ include_inactive: true })).unwrap();
    await store.dispatch(rosterApi.endpoints.getPersonSkills.initiate(PERSON_ID)).unwrap();
    await store.dispatch(rosterApi.endpoints.listCertifications.initiate(PERSON_ID)).unwrap();
    expect(calls.map((call) => `${call.key}${call.search}`)).toEqual([
      "GET /v1/roster/people",
      `GET /v1/roster/people?active=all&role=consultant&group=${GROUP_ID}&skill=onestream&q=ana`,
      `GET /v1/roster/people/${PERSON_ID}`,
      "GET /v1/roster/skills",
      "GET /v1/roster/skills?include_inactive=true",
      `GET /v1/roster/people/${PERSON_ID}/skills`,
      `GET /v1/roster/people/${PERSON_ID}/certifications`,
    ]);
  });

  it("sends the person mutations with the contract bodies", async () => {
    const calls = stubFetch({
      "POST /v1/roster/people": () => json(aPerson(), 201),
      "POST /v1/roster/import": () => json({ created: 2, people: [] }),
      [`PATCH /v1/roster/people/${PERSON_ID}`]: () => json(aPerson({ version: 3 })),
      [`PUT /v1/roster/people/${PERSON_ID}/calendar`]: () =>
        json({ working_days: [1, 2, 3], day_start: "08:00", day_end: "16:00", hours_per_day: "8.00" }),
      "POST /v1/roster/skills": () => json(aSkill(), 201),
      [`PUT /v1/roster/people/${PERSON_ID}/skills`]: () => json([aPersonSkill()]),
      [`POST /v1/roster/people/${PERSON_ID}/certifications`]: () => json(aCertification(), 201),
      [`DELETE /v1/roster/people/${PERSON_ID}/certifications/cert-1`]: () => new Response(null, { status: 204 }),
    });
    const store = makeStore();
    await store
      .dispatch(
        rosterApi.endpoints.createPerson.initiate({
          display_name: "Ana Silva",
          email: "ana.silva@example.com",
          role: "senior_consultant",
          fte_percent: 80,
          time_zone: "Europe/London",
        }),
      )
      .unwrap();
    await store.dispatch(rosterApi.endpoints.importRoster.initiate()).unwrap();
    await store
      .dispatch(
        rosterApi.endpoints.patchPerson.initiate({
          id: PERSON_ID,
          body: { version: 2, fte_percent: 60, country: "PT" },
        }),
      )
      .unwrap();
    await store
      .dispatch(
        rosterApi.endpoints.setPersonCalendar.initiate({
          id: PERSON_ID,
          body: { working_days: [1, 2, 3], day_start: "08:00", day_end: "16:00" },
        }),
      )
      .unwrap();
    await store
      .dispatch(rosterApi.endpoints.createSkill.initiate({ kind: "process", code: "close", name: "Close" }))
      .unwrap();
    await store
      .dispatch(
        rosterApi.endpoints.setPersonSkills.initiate({
          id: PERSON_ID,
          skills: [
            { skill_id: SKILL_ID, level: 4 },
            { code: "close", level: 2 },
          ],
        }),
      )
      .unwrap();
    await store
      .dispatch(
        rosterApi.endpoints.addCertification.initiate({
          id: PERSON_ID,
          body: { name: "PMP", issuer: "PMI", obtained_on: "2026-01-15", expires_on: "2029-01-15" },
        }),
      )
      .unwrap();
    await store
      .dispatch(rosterApi.endpoints.removeCertification.initiate({ id: PERSON_ID, certificationId: "cert-1" }))
      .unwrap();
    expect(calls.map((call) => [call.key, call.body])).toEqual([
      [
        "POST /v1/roster/people",
        {
          display_name: "Ana Silva",
          email: "ana.silva@example.com",
          role: "senior_consultant",
          fte_percent: 80,
          time_zone: "Europe/London",
        },
      ],
      ["POST /v1/roster/import", undefined],
      [`PATCH /v1/roster/people/${PERSON_ID}`, { version: 2, fte_percent: 60, country: "PT" }],
      [
        `PUT /v1/roster/people/${PERSON_ID}/calendar`,
        { working_days: [1, 2, 3], day_start: "08:00", day_end: "16:00" },
      ],
      ["POST /v1/roster/skills", { kind: "process", code: "close", name: "Close" }],
      [
        `PUT /v1/roster/people/${PERSON_ID}/skills`,
        {
          skills: [
            { skill_id: SKILL_ID, level: 4 },
            { code: "close", level: 2 },
          ],
        },
      ],
      [
        `POST /v1/roster/people/${PERSON_ID}/certifications`,
        { name: "PMP", issuer: "PMI", obtained_on: "2026-01-15", expires_on: "2029-01-15" },
      ],
      [`DELETE /v1/roster/people/${PERSON_ID}/certifications/cert-1`, undefined],
    ]);
  });

  it("refreshes the people list after an import and after a skills save", async () => {
    let lists = 0;
    stubFetch({
      "GET /v1/roster/people": () => {
        lists += 1;
        return json([aPerson()]);
      },
      "POST /v1/roster/import": () =>
        json({ created: 1, people: [{ id: "p2", email: "b@x.com", role: "consultant" }] }),
      [`PUT /v1/roster/people/${PERSON_ID}/skills`]: () => json([aPersonSkill()]),
    });
    const store = makeStore();
    const subscription = store.dispatch(rosterApi.endpoints.listPeople.initiate({ active: "true" }));
    await subscription.unwrap();
    await store.dispatch(rosterApi.endpoints.importRoster.initiate()).unwrap();
    await vi.waitFor(() => expect(lists).toBe(2));
    await store
      .dispatch(
        rosterApi.endpoints.setPersonSkills.initiate({ id: PERSON_ID, skills: [{ skill_id: SKILL_ID, level: 1 }] }),
      )
      .unwrap();
    await vi.waitFor(() => expect(lists).toBe(3));
    subscription.unsubscribe();
  });
});

describe("roster errors", () => {
  it("parses the typed 400, 404 and 409 bodies into fixed copy", () => {
    const exists = rosterError({ status: 400, data: { code: "person_exists", email: "ana.silva@example.com" } });
    expect(exists.email).toBe("ana.silva@example.com");
    expect(describeRosterError(exists)).toBe("ana.silva@example.com is already on the roster.");
    expect(describeRosterError(rosterError({ status: 400, data: { code: "day_end_before_start" } }))).toBe(
      "The day must end after it starts.",
    );
    expect(describeRosterError(rosterError({ status: 400, data: { code: "duplicate_working_day" } }))).toBe(
      "Each working day can be listed once.",
    );
    expect(describeRosterError(rosterError({ status: 400, data: { code: "skill_exists", skill: "close" } }))).toBe(
      "A skill with the code close already exists.",
    );
    expect(describeRosterError(rosterError({ status: 400, data: { code: "duplicate_skill", skill: "close" } }))).toBe(
      "close is listed twice.",
    );
    expect(
      describeRosterError(rosterError({ status: 404, data: { code: "not_found", entity: "skill", skill: "nope" } })),
    ).toBe("The skill nope is not in the catalog.");
    expect(describeRosterError(rosterError({ status: 400, data: { code: "expires_before_obtained" } }))).toBe(
      "The expiry date must be on or after the date obtained.",
    );
    expect(describeRosterError(rosterError({ status: 409, data: { code: "stale_version" } }))).toBe(
      "Someone else changed this record. It has been reloaded.",
    );
  });
});
