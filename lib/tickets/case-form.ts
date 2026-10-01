import type { PatchTicketBody } from "@/redux/ticketsApi";

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
