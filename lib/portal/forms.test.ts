import { describe, expect, it } from "vitest";
import {
  answersBody,
  conditionHolds,
  conditionValuesOf,
  describeSubmissionError,
  kindLabel,
  levelLabel,
  missingRequired,
  problemsByField,
  submissionError,
  visibleFields,
} from "@/lib/portal/forms";
import { aFormDefinition, aFormField } from "@/test-kit/forms";

/**
 * The client's half of a published definition (CP-03). A condition decides
 * what is asked; the body carries only what was asked and answered, because
 * the server refuses an answer to a question it did not ask.
 */
describe("what a published form asks", () => {
  it("holds a conditional field back until its controller carries the answer", () => {
    const definition = aFormDefinition();
    expect(visibleFields(definition, {}).map((field) => field.key)).toEqual([
      "short_description",
      "area",
      "seen_before",
    ]);
    expect(visibleFields(definition, { area: "reporting" }).map((field) => field.key)).toEqual([
      "short_description",
      "area",
      "report_name",
      "seen_before",
    ]);
    expect(visibleFields(definition, { area: "access" }).map((field) => field.key)).not.toContain("report_name");
  });

  it("reads a condition on a boolean and on a several-of-a-list answer the way the server does", () => {
    expect(conditionHolds({ field: "seen", equals: true }, { seen: true })).toBe(true);
    expect(conditionHolds({ field: "seen", equals: true }, { seen: false })).toBe(false);
    expect(conditionHolds({ field: "systems", equals: "erp" }, { systems: ["crm", "erp"] })).toBe(true);
    expect(conditionHolds({ field: "systems", equals: "erp" }, { systems: ["crm"] })).toBe(false);
    // An unanswered controller hides the field rather than showing it.
    expect(conditionHolds({ field: "area", equals: "reporting" }, {})).toBe(false);
  });
});

describe("the answers a published form posts", () => {
  it("sends each answer in the shape its kind takes and trims the text", () => {
    const definition = {
      fields: [
        aFormField(),
        aFormField({ key: "seats", kind: "number", label: "Seats", maps_to: "custom.seats" }),
        aFormField({ key: "ok", kind: "boolean", label: "Confirmed", maps_to: "custom.ok" }),
      ],
    };
    expect(answersBody(definition, { short_description: "  Broken  ", seats: "3", ok: "true" })).toEqual({
      short_description: "Broken",
      seats: 3,
      ok: true,
    });
  });

  it("leaves out a blank answer and a field a condition hid", () => {
    expect(answersBody(aFormDefinition(), { short_description: "Broken", area: "", report_name: "Ignored" })).toEqual({
      short_description: "Broken",
    });
  });

  it("names the required answers left blank, and never a hidden one", () => {
    expect(missingRequired(aFormDefinition(), {})).toEqual(["short_description", "area"]);
    expect(missingRequired(aFormDefinition(), { short_description: "Broken", area: "reporting" })).toEqual([
      "report_name",
    ]);
    expect(missingRequired(aFormDefinition(), { short_description: "Broken", area: "access" })).toEqual([]);
  });
});

describe("the refusals a client is told about", () => {
  it("keys each invalid_submission problem to its own field and counts them in the whole-form line", () => {
    const error = submissionError({
      status: 400,
      data: {
        code: "invalid_submission",
        problems: [
          { field: "area", code: "not_an_option", message: "not offered" },
          { field: "short_description", code: "required", message: "needed" },
        ],
      },
    });
    expect(problemsByField(error)).toEqual({ area: "not offered", short_description: "needed" });
    expect(describeSubmissionError(error)).toBe("2 answers need your attention before this can be sent.");
  });

  it("says form_answers_required as a whole-form message, since the form changed underneath the page", () => {
    const error = submissionError({ status: 400, data: { code: "form_answers_required", ticket_type: "incident" } });
    expect(describeSubmissionError(error)).toMatch(/Reload the page and answer the questions it asks now/);
    expect(problemsByField(error)).toEqual({});
  });

  it("words a type the account does not offer", () => {
    const error = submissionError({ status: 400, data: { code: "type_not_offered", ticket_type: "change" } });
    expect(describeSubmissionError(error)).toBe("That kind of request is not offered on this account.");
  });
});

describe("the vocabulary both sides share", () => {
  it("names every kind and every level in words", () => {
    expect(kindLabel("multi_choice")).toBe("Several of a list");
    expect(kindLabel("ci_picker")).toBe("Configuration item");
    expect(levelLabel("high")).toBe("High");
  });

  it("offers a condition the answers its controller can have", () => {
    expect(conditionValuesOf({ kind: "boolean" }).map((option) => option.value)).toEqual(["true", "false"]);
    expect(conditionValuesOf({ kind: "urgency" }).map((option) => option.value)).toEqual(["high", "medium", "low"]);
    expect(
      conditionValuesOf({ kind: "choice", options: [{ value: "x", label: "" }] }).map((option) => option.label),
    ).toEqual(["x"]);
  });
});
