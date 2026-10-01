import type { PatchTicketBody } from "@/redux/ticketsApi";

/** The analyst-typed reference. Sync writes its own keys beside this one. */
const CLIENT_REFERENCE = "client_reference";

/** The reference a person typed. Empty when nobody has. */
export function clientReference(refs: Record<string, unknown> | null | undefined): string {
  const value = refs?.[CLIENT_REFERENCE];
  return typeof value === "string" ? value : "";
}

/** References other systems wrote, so a typed reference does not hide them. */
export function syncedReferences(refs: Record<string, unknown> | null | undefined): string {
  return Object.entries(refs ?? {})
    .filter(([key, value]) => key !== CLIENT_REFERENCE && typeof value === "string" && value !== "")
    .map(([, value]) => value)
    .join(" · ");
}

/**
 * The map a saved external reference sends back. Other string keys stay,
 * because replacing the map is how the API stores it, and dropping a sync
 * key would unlink the case from that system.
 */
export function externalRefsBody(
  refs: Record<string, unknown> | null | undefined,
  value: string,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, current] of Object.entries(refs ?? {})) {
    if (key === CLIENT_REFERENCE) continue;
    if (typeof current === "string" && current !== "") next[key] = current;
  }
  const trimmed = value.trim();
  if (trimmed !== "") next[CLIENT_REFERENCE] = trimmed;
  return next;
}

/**
 * The body one committed row of the case form sends, or null for a row the
 * form does not write. The rows that may be emptied are sent as null when
 * they are.
 */
export function caseFieldPatch(key: string, value: string, version: number): PatchTicketBody | null {
  switch (key) {
    case "short_description":
      return { version, short_description: value };
    case "description":
      return { version, description: value === "" ? null : value };
    case "category":
      return { version, category: value === "" ? null : value };
    case "configuration_item_id":
      return { version, configuration_item_id: value === "" ? null : value };
    case "contract_id":
      return { version, contract_id: value };
    case "impact":
      return { version, impact: value === "" ? null : (value as PatchTicketBody["impact"]) };
    case "urgency":
      return { version, urgency: value === "" ? null : (value as PatchTicketBody["urgency"]) };
    case "priority":
      return { version, priority: value as PatchTicketBody["priority"] };
    default:
      return null;
  }
}
