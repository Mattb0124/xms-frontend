import type { SignalTone } from "@/components/xms/signal-pill";
import { formatHours } from "@/lib/time/budget";
import { SKILL_KIND_LABEL } from "@/lib/roster/vocab";
import type {
  CapacityCheck,
  CapacityStatus,
  CoverageStatus,
  DemandRow,
  DemandSource,
  MatrixSkill,
  PtoKind,
} from "@/redux/capacityApi";

/**
 * The capacity vocabulary (Capacity & Allocation functional 5.1, 5.3 to
 * 5.6 and 5.9). The server computes every minute; this file words the
 * fixed sets, formats hours and picks the tone.
 */
export const PTO_KIND_LABEL: Record<PtoKind, string> = {
  vacation: "Vacation",
  sick: "Sick",
  other: "Other",
};

export const PTO_KINDS: { value: PtoKind; label: string }[] = [
  { value: "vacation", label: PTO_KIND_LABEL.vacation },
  { value: "sick", label: PTO_KIND_LABEL.sick },
  { value: "other", label: PTO_KIND_LABEL.other },
];

/** "Full days", "Half days", "0.25 of a day" from the API's numeric string. */
export function fractionLabel(fraction: string | number): string {
  const value = Number(fraction);
  if (value === 1) return "Full days";
  if (value === 0.5) return "Half days";
  return `${value} of a day`;
}

export const CAPACITY_STATUS: Record<CapacityStatus, { label: string; tone: SignalTone }> = {
  available: { label: "Available", tone: "complete" },
  warning: { label: "Near capacity", tone: "needs-input" },
  over: { label: "Over", tone: "overdue" },
  no_calendar: { label: "No calendar", tone: "blocked" },
};

/** The account lens statuses (5.8): covered, a single point of failure, a gap. */
export const COVERAGE_STATUS: Record<CoverageStatus, { label: string; tone: SignalTone }> = {
  ok: { label: "Covered", tone: "complete" },
  spof: { label: "Single point of failure", tone: "needs-input" },
  gap: { label: "Gap", tone: "overdue" },
};

/** "Single point of failure: OneStream", "Gap: SAP": the account record's chips. */
export function coverageChipLabel(status: "spof" | "gap", name: string): string {
  return `${COVERAGE_STATUS[status].label}: ${name}`;
}

/** The heat map ramp: the accent deepening from level 1 to 4, on the scope tokens; empty for no level. */
export function levelCellClass(level: number | undefined): string {
  switch (level) {
    case 1:
      return "bg-xms-tint text-xms-ink";
    case 2:
      return "bg-xms-accent-tint-strong text-xms-ink";
    case 3:
      return "bg-xms-accent-border text-xms-ink";
    case 4:
      return "bg-xms-accent text-white";
    default:
      return "";
  }
}

const SKILL_KIND_ORDER = ["technology", "account", "process"];

export interface SkillGroup {
  kind: string;
  label: string;
  skills: MatrixSkill[];
}

/** The heat map columns grouped by kind (technology, account familiarity, process, then anything else), names ascending. */
export function groupSkillsByKind(skills: MatrixSkill[]): SkillGroup[] {
  const groups = new Map<string, MatrixSkill[]>();
  for (const skill of skills) {
    const list = groups.get(skill.kind) ?? [];
    list.push(skill);
    groups.set(skill.kind, list);
  }
  const rank = (kind: string) => {
    const index = SKILL_KIND_ORDER.indexOf(kind);
    return index === -1 ? SKILL_KIND_ORDER.length : index;
  };
  return [...groups.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]))
    .map(([kind, list]) => ({
      kind,
      label: SKILL_KIND_LABEL[kind] ?? kind,
      skills: [...list].sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

/** The demand sources (5.7): pipeline weighted by probability, project as committed, imported lines from the template. */
export const DEMAND_SOURCE: Record<DemandSource, { label: string; tone: SignalTone }> = {
  pipeline: { label: "Pipeline", tone: "ready" },
  project: { label: "Project", tone: "complete" },
  import: { label: "Imported", tone: "blocked" },
};

/** The minutes a line adds to the month: project as committed, anything else weighted by its probability. */
export function weightedMinutes(row: Pick<DemandRow, "source" | "hours" | "probability">): number {
  const minutes = row.hours * 60;
  return row.source === "project" ? Math.round(minutes) : Math.round(minutes * row.probability);
}

/** "50%" from the API's 0.5. */
export function formatProbability(probability: number): string {
  return `${Math.round(probability * 100)}%`;
}

/** The account key, else the prospect name, else the id prefix. */
export function demandSubject(row: Pick<DemandRow, "account_key" | "prospect_name" | "account_id">): string {
  return row.account_key ?? row.prospect_name ?? row.account_id?.slice(0, 8) ?? "";
}

/** "YYYY-MM" moved by a number of months, either way. */
export function addMonths(month: string, count: number): string {
  const year = Number(month.slice(0, 4));
  const index = Number(month.slice(5, 7)) - 1 + count;
  const date = new Date(Date.UTC(year, index, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The spreadsheet template's header, in any order; source, month and hours are required. */
export const DEMAND_TEMPLATE_COLUMNS = ["source", "account", "prospect", "month", "hours", "probability", "role"] as const;

export const DEMAND_TEMPLATE_EXAMPLE = [
  DEMAND_TEMPLATE_COLUMNS.join(","),
  "project,BRK,,2026-12,40,,",
  "pipeline,,Acme Corp,2026-12,200,50%,architect",
].join("\n");

/** "+22 h", "-1.5 h", "0 h": a variance in hours with its sign. */
export function formatSignedHours(minutes: number): string {
  if (minutes === 0) return formatHours(0);
  return `${minutes > 0 ? "+" : "-"}${formatHours(Math.abs(minutes))}`;
}

/** "+55%", "-10%", "n/a" when nothing was planned; whole percentages. */
export function formatVariancePercent(ratio: number | null): string {
  if (ratio === null || !Number.isFinite(ratio)) return "n/a";
  const percent = Math.round(ratio * 100);
  if (percent === 0) return "0%";
  return `${percent > 0 ? "+" : "-"}${Math.abs(percent)}%`;
}

/**
 * The picker's hint (5.9): "76.8 h left", "Over by 13.3 h" (allocated past
 * available, since the server clamps remaining at 0), "No calendar".
 */
export function remainingLabel(check: Pick<CapacityCheck, "status" | "remaining_minutes" | "allocated_minutes" | "available_minutes">): string {
  if (check.status === "no_calendar") return "No calendar";
  if (check.status === "over") return `Over by ${formatHours(check.allocated_minutes - check.available_minutes)}`;
  return `${formatHours(check.remaining_minutes)} left`;
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isMonth(value: string | null | undefined): value is string {
  return typeof value === "string" && MONTH.test(value);
}

/** "YYYY-MM" for the local date. */
export function currentMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** "YYYY-MM-01": the month as the allocation routes name it. */
export function monthStart(month: string): string {
  return `${month.slice(0, 7)}-01`;
}

/** The last day of the month as "YYYY-MM-DD". */
export function monthEnd(month: string): string {
  const year = Number(month.slice(0, 4));
  const index = Number(month.slice(5, 7));
  const last = new Date(Date.UTC(year, index, 0)).getUTCDate();
  return `${month.slice(0, 7)}-${String(last).padStart(2, "0")}`;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "September 2026" from "2026-09" or "2026-09-01". */
export function monthLabel(month: string): string {
  const index = Number(month.slice(5, 7)) - 1;
  return `${MONTH_NAMES[index] ?? month.slice(5, 7)} ${month.slice(0, 4)}`;
}

/** The grid cell's text for a stored value: "60", "1.5", "" for nothing. */
export function minutesToHoursText(minutes: number | undefined): string {
  if (minutes === undefined) return "";
  const hours = minutes / 60;
  return Number.isInteger(hours) ? String(hours) : String(Math.round(hours * 100) / 100);
}

/** The minutes behind a cell's text: empty or 0 clears; null when it is not a usable number of hours. */
export function hoursTextToMinutes(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return 0;
  const hours = Number(trimmed);
  if (!Number.isFinite(hours) || hours < 0) return null;
  return Math.round(hours * 60);
}
