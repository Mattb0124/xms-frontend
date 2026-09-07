import { apiError, describeError, type ApiError } from "@/lib/admin/api-error";

/**
 * The typed error bodies of the roster routes (Capacity & Allocation
 * technical section 4). Handlers branch on `code`; the copy lives here so
 * the list, the record tabs and the picker all say the same thing.
 */
export type RosterErrorCode =
  | "person_exists"
  | "day_end_before_start"
  | "duplicate_working_day"
  | "skill_exists"
  | "duplicate_skill"
  | "expires_before_obtained"
  | "not_found"
  | "stale_version";

export interface RosterError extends ApiError {
  /** person_exists carries the email that is already on the roster. */
  email?: string;
  /** skill_exists, duplicate_skill and the skill not_found carry the code or id. */
  skill?: string;
  /** not_found names the entity (person, skill, certification). */
  entity?: string;
}

export function rosterError(error: unknown): RosterError {
  const parsed = apiError(error) as RosterError;
  const data = (error as { data?: Record<string, unknown> })?.data;
  if (data && typeof data === "object") {
    if (typeof data.email === "string") parsed.email = data.email;
    if (typeof data.skill === "string") parsed.skill = data.skill;
    if (typeof data.entity === "string") parsed.entity = data.entity;
  }
  return parsed;
}

export function describeRosterError(error: RosterError): string {
  switch (error.code) {
    case "person_exists":
      return error.email
        ? `${error.email} is already on the roster.`
        : "Someone with that email is already on the roster.";
    case "day_end_before_start":
      return "The day must end after it starts.";
    case "duplicate_working_day":
      return "Each working day can be listed once.";
    case "skill_exists":
      return error.skill ? `A skill with the code ${error.skill} already exists.` : "That skill code already exists.";
    case "duplicate_skill":
      return error.skill ? `${error.skill} is listed twice.` : "A skill is listed twice.";
    case "expires_before_obtained":
      return "The expiry date must be on or after the date obtained.";
    case "not_found":
      if (error.entity === "skill")
        return error.skill ? `The skill ${error.skill} is not in the catalog.` : "That skill is not in the catalog.";
      if (error.entity === "certification") return "That certification has already been removed.";
      if (error.entity === "person") return "This person is not on the roster.";
      return "Not found.";
    default:
      return describeError(error);
  }
}
