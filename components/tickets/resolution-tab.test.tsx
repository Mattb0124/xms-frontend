import { describe, expect, it } from "vitest";
import { recordDisciplineItems } from "@/components/tickets/resolution-tab";
import { RESOLUTION_CODES } from "@/lib/tickets/vocab";
import { aTicketView } from "@/test-kit/tickets";

/**
 * Render 05 draws the close discipline on the Resolution tab, where it says
 * what is still missing before Resolved. It used to live only inside the
 * resolve dialog, so an unresolved ticket's tab said one sentence and
 * nothing else.
 */
describe("the close discipline as the record stands", () => {
  it("counts nothing done on a ticket with no resolution", () => {
    const items = recordDisciplineItems(aTicketView(), 0, 0, RESOLUTION_CODES);
    expect(items.map((item) => item.key)).toEqual(["resolution_code", "notes", "solution", "time"]);
    expect(items.every((item) => !item.done)).toBe(true);
  });

  it("reads the record: a code, notes, a linked article and logged time", () => {
    const ticket = aTicketView({
      resolution: {
        code: "fixed",
        notes: "Cause and fix.",
        solution_candidate: false,
        solution_article_id: null,
        time_exemption_reason: null,
      },
    });
    const items = recordDisciplineItems(ticket, 1, 125, RESOLUTION_CODES);
    expect(items.every((item) => item.done)).toBe(true);
    expect(items.find((item) => item.key === "time")?.detail).toBe("125 min logged");
  });

  it("waives the solution where the resolution code says there is none", () => {
    const waiving = RESOLUTION_CODES.find((code) => code.noSolution);
    expect(waiving).toBeDefined();
    const ticket = aTicketView({
      resolution: {
        code: waiving!.key,
        notes: "",
        solution_candidate: false,
        solution_article_id: null,
        time_exemption_reason: null,
      },
    });
    const solution = recordDisciplineItems(ticket, 0, 0, RESOLUTION_CODES).find((item) => item.key === "solution");
    expect(solution?.done).toBe(true);
    expect(solution?.detail).toBe("waived by the resolution code");
  });

  it("takes an exemption reason in place of logged time", () => {
    const ticket = aTicketView({
      resolution: {
        code: "fixed",
        notes: "x",
        solution_candidate: false,
        solution_article_id: null,
        time_exemption_reason: "Goodwill",
      },
    });
    const time = recordDisciplineItems(ticket, 0, 0, RESOLUTION_CODES).find((item) => item.key === "time");
    expect(time?.done).toBe(true);
    expect(time?.detail).toBeUndefined();
  });
});
