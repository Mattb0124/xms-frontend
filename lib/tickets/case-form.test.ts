import { describe, expect, it } from "vitest";
import { caseFieldPatch, clientReference, externalRefsBody, syncedReferences } from "@/lib/tickets/case-form";

describe("caseFieldPatch", () => {
  it("sends the committed row with the version the record was read at", () => {
    expect(caseFieldPatch("short_description", "Printer jammed", 3)).toEqual({
      version: 3,
      short_description: "Printer jammed",
    });
    expect(caseFieldPatch("contract_id", "contract-1", 3)).toEqual({ version: 3, contract_id: "contract-1" });
    expect(caseFieldPatch("impact", "high", 3)).toEqual({ version: 3, impact: "high" });
    expect(caseFieldPatch("priority", "p2", 3)).toEqual({ version: 3, priority: "p2" });
  });

  it("sends an emptied row as null where the row may be emptied", () => {
    for (const key of ["description", "category", "configuration_item_id", "impact", "urgency"]) {
      expect(caseFieldPatch(key, "", 3)).toEqual({ version: 3, [key]: null });
    }
    expect(caseFieldPatch("short_description", "", 3)).toEqual({ version: 3, short_description: "" });
  });

  it("writes nothing for a row the form does not own", () => {
    expect(caseFieldPatch("number", "CS1000001", 3)).toBeNull();
    expect(caseFieldPatch("state", "closed", 3)).toBeNull();
  });
});

describe("external reference", () => {
  const refs = { servicenow: "INC0448120", client_reference: "PO-19" };

  it("reads the reference a person typed, and the ones a system wrote", () => {
    expect(clientReference(refs)).toBe("PO-19");
    expect(clientReference({})).toBe("");
    expect(syncedReferences(refs)).toBe("INC0448120");
  });

  it("keeps the system keys when the typed reference changes or is cleared", () => {
    expect(externalRefsBody(refs, "PO-20")).toEqual({ servicenow: "INC0448120", client_reference: "PO-20" });
    expect(externalRefsBody(refs, "  ")).toEqual({ servicenow: "INC0448120" });
  });
});
