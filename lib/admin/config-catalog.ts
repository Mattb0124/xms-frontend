import { TICKET_TYPES } from "@/lib/tickets/vocab";
import type { ConfigKind } from "@/redux/adminApi";

/**
 * The configuration catalogs an account may override (Accounts &
 * Administration technical 2.5 and 3.4). The state machine is seeded per
 * ticket type, so it takes a scope; every other kind lives under the `*`
 * scope. Mirrors the backend's `ensureDefaults` so the editor asks for the
 * scope exactly where the server keeps one.
 */
export interface CatalogKind {
  key: ConfigKind;
  label: string;
  detail: string;
  /** The scope values when the kind is scoped; undefined means the `*` scope. */
  scopes?: { value: string; label: string }[];
}

export const CATALOG_KINDS: CatalogKind[] = [
  {
    key: "state_machine",
    label: "State machines",
    detail: "States, transitions and their requirements, one per ticket type.",
    scopes: TICKET_TYPES.map((type) => ({ value: type.value, label: type.label })),
  },
  { key: "priority_matrix", label: "Priority matrix", detail: "Impact by urgency to a priority." },
  { key: "sla_policy", label: "SLA policy", detail: "Response and resolution targets per type and priority." },
  { key: "activity_types", label: "Activity types", detail: "What time is logged against." },
  { key: "billable_classes", label: "Billable classes", detail: "Which time consumes the contract." },
  { key: "resolution_codes", label: "Resolution codes", detail: "How a ticket was resolved." },
];

export function catalogKind(key: ConfigKind): CatalogKind | undefined {
  return CATALOG_KINDS.find((kind) => kind.key === key);
}

export function isScoped(key: ConfigKind): boolean {
  return Boolean(catalogKind(key)?.scopes);
}

/** The scope the editor should start on: the first ticket type for scoped kinds, nothing otherwise. */
export function defaultScope(key: ConfigKind): string | undefined {
  return catalogKind(key)?.scopes?.[0]?.value;
}

/** Pretty JSON for the editor; the server stores the parsed object, never this text. */
export function formatBody(body: unknown): string {
  return JSON.stringify(body ?? {}, null, 2);
}

export type ParsedBody = { ok: true; body: Record<string, unknown> } | { ok: false; problem: string };

/** Parses the editor text: valid JSON that is an object (arrays and scalars are refused before the server sees them). */
export function parseBody(text: string): ParsedBody {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (caught) {
    return { ok: false, problem: `Not valid JSON: ${(caught as Error).message}` };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, problem: "The body must be a JSON object." };
  }
  return { ok: true, body: parsed as Record<string, unknown> };
}
