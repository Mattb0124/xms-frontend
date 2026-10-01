import type { PatchPersonBody, PersonDetail } from "@/redux/rosterApi";

/** The Details form's copy of a person: every value as the text its control holds. */
export interface PersonDraft {
  display_name: string;
  role: string;
  fte_percent: string;
  hours_base_per_week: string;
  admin_overhead_percent: string;
  currency: string;
  country: string;
  time_zone: string;
  start_date: string;
  end_date: string;
  assignment_group_ids: string[];
}

export function draftFromPerson(person: PersonDetail): PersonDraft {
  return {
    display_name: person.display_name,
    role: person.role,
    fte_percent: person.fte_percent === null ? "" : String(Number(person.fte_percent)),
    hours_base_per_week: person.hours_base_per_week === null ? "" : String(Number(person.hours_base_per_week)),
    admin_overhead_percent:
      person.admin_overhead_percent === null || person.admin_overhead_percent === undefined
        ? ""
        : String(Number(person.admin_overhead_percent)),
    currency: person.currency ?? "",
    country: person.country ?? "",
    time_zone: person.time_zone,
    start_date: person.start_date ?? "",
    end_date: person.end_date ?? "",
    assignment_group_ids: [...person.assignment_group_ids].sort(),
  };
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * The fields the PATCH carries: only what changed against the loaded record,
 * plus the version. Numbers go as numbers; blanks on nullable fields go as
 * null; a blank on a required field is not sent.
 */
export function changedFields(person: PersonDetail, draft: PersonDraft): Omit<PatchPersonBody, "version"> {
  const base = draftFromPerson(person);
  const body: Omit<PatchPersonBody, "version"> = {};
  if (draft.display_name.trim() !== base.display_name && draft.display_name.trim() !== "")
    body.display_name = draft.display_name.trim();
  if (draft.role !== base.role) body.role = draft.role;
  if (draft.fte_percent !== base.fte_percent && draft.fte_percent !== "") body.fte_percent = Number(draft.fte_percent);
  if (draft.hours_base_per_week !== base.hours_base_per_week && draft.hours_base_per_week !== "")
    body.hours_base_per_week = Number(draft.hours_base_per_week);
  if (draft.admin_overhead_percent !== base.admin_overhead_percent)
    body.admin_overhead_percent = draft.admin_overhead_percent === "" ? null : Number(draft.admin_overhead_percent);
  if (draft.currency.trim().toUpperCase() !== base.currency && draft.currency.trim() !== "")
    body.currency = draft.currency.trim().toUpperCase();
  if (draft.country.trim().toUpperCase() !== base.country)
    body.country = draft.country.trim() === "" ? null : draft.country.trim().toUpperCase();
  if (draft.time_zone.trim() !== base.time_zone && draft.time_zone.trim() !== "")
    body.time_zone = draft.time_zone.trim();
  if (draft.start_date !== base.start_date) body.start_date = draft.start_date === "" ? null : draft.start_date;
  if (draft.end_date !== base.end_date) body.end_date = draft.end_date === "" ? null : draft.end_date;
  const groups = [...draft.assignment_group_ids].sort();
  if (!sameList(groups, base.assignment_group_ids)) body.assignment_group_ids = groups;
  return body;
}
