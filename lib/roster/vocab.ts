/**
 * Roster vocabulary (Capacity & Allocation functional 5.1): the operator's
 * role list, the four skill levels and the certification expiry rule. Roles
 * are snake_case codes on the API; the labels here are display only and an
 * unknown code is humanised rather than hidden.
 */
export const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "consultant", label: "Consultant" },
  { value: "senior_consultant", label: "Senior Consultant" },
  { value: "architect", label: "Architect" },
  { value: "infrastructure_engineer", label: "Infrastructure Engineer" },
  { value: "team_lead", label: "Team Lead" },
  { value: "account_manager", label: "Account Manager" },
  { value: "practice_lead", label: "Practice Lead" },
];

export function roleLabel(code: string | null | undefined): string {
  if (!code) return "";
  const known = ROLE_OPTIONS.find((option) => option.value === code);
  if (known) return known.label;
  return code
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export const SKILL_LEVELS: { level: number; label: string }[] = [
  { level: 1, label: "Aware" },
  { level: 2, label: "Working" },
  { level: 3, label: "Proficient" },
  { level: 4, label: "Expert" },
];

export function levelLabel(level: number): string {
  return SKILL_LEVELS.find((entry) => entry.level === level)?.label ?? `Level ${level}`;
}

export const SKILL_KIND_LABEL: Record<string, string> = {
  technology: "Technology",
  account: "Account familiarity",
  process: "Process",
};

/** ISO weekday numbers as the API stores them: 1 Monday to 7 Sunday. */
export const ISO_WEEKDAYS: { value: number; label: string; short: string }[] = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
  { value: 7, label: "Sunday", short: "Sun" },
];

export type ExpiryTone = "overdue" | "needs-input" | "complete" | "blocked";

export interface ExpiryState {
  tone: ExpiryTone;
  label: string;
  /** Whole days until expiry; negative when past; null without an expiry. */
  days: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dateOnly(value: string | Date): number {
  const date = typeof value === "string" ? new Date(`${value.slice(0, 10)}T00:00:00Z`) : value;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * The expiry chip rule: red once the date has passed, amber within 90 days,
 * green otherwise, grey when the certification never expires. The API does
 * not compute this; it is display only and the notification rule (60 days)
 * stays server-side.
 */
export function expiryState(expiresOn: string | null | undefined, today: Date = new Date()): ExpiryState {
  if (!expiresOn) return { tone: "blocked", label: "No expiry", days: null };
  const days = Math.round((dateOnly(expiresOn) - dateOnly(today)) / DAY_MS);
  if (days < 0) return { tone: "overdue", label: "Expired", days };
  if (days === 0) return { tone: "needs-input", label: "Expires today", days };
  if (days <= 90) return { tone: "needs-input", label: `Expires in ${days} day${days === 1 ? "" : "s"}`, days };
  return { tone: "complete", label: "Valid", days };
}

/** "100.00" from the API renders as "100%"; "62.50" as "62.5%". */
export function formatPercent(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const number = Number(value);
  if (Number.isNaN(number)) return String(value);
  return `${Number(number.toFixed(2))}%`;
}

export function formatHours(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const number = Number(value);
  if (Number.isNaN(number)) return String(value);
  return `${Number(number.toFixed(2))} h`;
}
