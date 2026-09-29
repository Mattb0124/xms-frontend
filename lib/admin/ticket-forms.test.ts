import { describe, expect, it } from "vitest";
import {
  controllersFor,
  definitionFromDraft,
  describeFormError,
  draftFromDefinition,
  draftVersion,
  emptyFieldDraft,
  formError,
  mapsToOptions,
  publishedVersion,
  validateFormDraft,
  versionLabel,
  type FieldDraft,
} from "@/lib/admin/ticket-forms";
import { aFormDefinition, aFormVersion, aPublishedVersion, aTicketForm } from "@/test-kit/forms";

const field = (overrides: Partial<FieldDraft> = {}): FieldDraft => ({
  ...emptyFieldDraft(0),
  label: "Ask",
  ...overrides,
});

/**
 * The builder's own rules (CP-03). Every one of them is a rule the server
 * enforces in `src/domain/portal/form-schema.ts`; running them first is so
 * an author reads the problem beside the field rather than in a 400.
 */
describe("the request form draft", () => {
  it("reads a definition back as a draft and writes the same definition out", () => {
    const definition = aFormDefinition();
    const draft = draftFromDefinition(definition);
    expect(draft.map((row) => row.key)).toEqual(["short_description", "area", "report_name", "seen_before"]);
    expect(draft[2].conditionField).toBe("area");
    expect(draft[2].conditionEquals).toBe("reporting");
    expect(definitionFromDraft(draft)).toEqual(definition);
  });

  it("writes a boolean condition back as a boolean, never as the string it was edited as", () => {
    const fields = [
      field({ key: "seen_before", kind: "boolean", label: "Seen before?", mapsTo: "custom.seen_before" }),
      field({
        key: "when",
        kind: "short_text",
        label: "When?",
        mapsTo: "custom.when",
        conditionField: "seen_before",
        conditionEquals: "true",
      }),
    ];
    expect(definitionFromDraft(fields).fields[1].visible_when).toEqual({ field: "seen_before", equals: true });
  });

  it("offers a kind only the columns it may write, then its own custom key", () => {
    expect(mapsToOptions(field({ kind: "long_text", key: "detail" })).map((option) => option.value)).toEqual([
      "description",
      "custom.detail",
    ]);
    expect(mapsToOptions(field({ kind: "number", key: "seats" })).map((option) => option.value)).toEqual([
      "custom.seats",
    ]);
  });

  it("offers a condition only the conditionable fields asked before it", () => {
    const fields = [
      field({ key: "area", kind: "choice" }),
      field({ key: "detail", kind: "long_text" }),
      field({ key: "urgency", kind: "urgency" }),
    ];
    expect(controllersFor(fields, 2).map((row) => row.key)).toEqual(["area"]);
    expect(controllersFor(fields, 0)).toEqual([]);
  });

  it("accepts the definition the server accepts", () => {
    expect(validateFormDraft(draftFromDefinition(aFormDefinition()))).toEqual([]);
  });

  it("refuses a bad key, a missing label and two fields writing the same place", () => {
    const problems = validateFormDraft([
      field({ key: "Bad Key", label: "" }),
      field({ key: "one", label: "One", mapsTo: "short_description", kind: "short_text" }),
      field({ key: "two", label: "Two", mapsTo: "short_description", kind: "short_text" }),
    ]);
    expect(problems).toContain(
      "Bad Key: a field key is lower case letters, digits and underscores, starting with a letter.",
    );
    expect(problems).toContain("Field 1: every field needs a label.");
    expect(problems).toContain('Two: two fields write "short_description".');
  });

  it("refuses a kind writing a column it may not, and a choice with no options", () => {
    const problems = validateFormDraft([
      field({ key: "note", kind: "long_text", label: "Note", mapsTo: "category" }),
      field({ key: "area", kind: "choice", label: "Area", mapsTo: "custom.area", options: [] }),
    ]);
    expect(problems).toContain('Note: a long_text field cannot write "category".');
    expect(problems).toContain("Area: a choice field needs at least one option.");
  });

  it("refuses urgency without impact, a required attachment and a second attachment field", () => {
    const problems = validateFormDraft([
      field({ key: "urgency", kind: "urgency", label: "Urgency", mapsTo: "urgency" }),
      field({ key: "files", kind: "attachment", label: "Files", mapsTo: "custom.files", required: true }),
      field({ key: "more", kind: "attachment", label: "More files", mapsTo: "custom.more" }),
    ]);
    expect(problems).toContain("A form asks for urgency and impact together or for neither.");
    expect(problems).toContain("Files: an attachment field cannot be required.");
    expect(problems).toContain("A form takes at most one attachment field.");
  });

  it("refuses a condition on a field asked later, on an unconditionable kind and on an answer it cannot have", () => {
    const later = validateFormDraft([
      field({ key: "detail", label: "Detail", mapsTo: "custom.detail", conditionField: "area", conditionEquals: "x" }),
      field({
        key: "area",
        kind: "choice",
        label: "Area",
        mapsTo: "custom.area",
        options: [{ value: "x", label: "X" }],
      }),
    ]);
    expect(later).toContain("Detail: a condition names a field asked earlier on the same form.");

    const unconditionable = validateFormDraft([
      field({ key: "note", kind: "long_text", label: "Note", mapsTo: "description" }),
      field({ key: "detail", label: "Detail", mapsTo: "custom.detail", conditionField: "note", conditionEquals: "x" }),
    ]);
    expect(unconditionable).toContain("Detail: a condition cannot read a long_text field.");

    const wrongValue = validateFormDraft([
      field({
        key: "area",
        kind: "choice",
        label: "Area",
        mapsTo: "custom.area",
        options: [{ value: "x", label: "X" }],
      }),
      field({ key: "detail", label: "Detail", mapsTo: "custom.detail", conditionField: "area", conditionEquals: "y" }),
    ]);
    expect(wrongValue).toContain('Detail: "y" is not an answer "area" can have.');
  });

  it("refuses an empty form", () => {
    expect(validateFormDraft([])).toContain("A form needs at least one field.");
  });
});

describe("the versions of a form", () => {
  it("names the published one and the newest unpublished draft", () => {
    const form = aTicketForm();
    expect(publishedVersion(form)?.version_no).toBe(1);
    expect(draftVersion(form)?.version_no).toBe(2);
    expect(versionLabel(aPublishedVersion())).toBe("Version 1, published");
    expect(versionLabel(aFormVersion())).toBe("Version 2, draft");
  });

  it("reads a form with nothing published as having no published version", () => {
    const form = aTicketForm({ current_version_id: null, versions: [aFormVersion({ version_no: 1 })] });
    expect(publishedVersion(form)).toBeUndefined();
    expect(draftVersion(form)?.version_no).toBe(1);
  });
});

describe("the form refusals", () => {
  it("words invalid_form_definition with the server's own problems", () => {
    const error = formError({
      status: 400,
      data: {
        code: "invalid_form_definition",
        problems: [{ field: "area", code: "bad_options", message: "a choice field needs 1 to 50 options" }],
      },
    });
    expect(describeFormError(error)).toBe("The definition was refused: a choice field needs 1 to 50 options.");
  });

  it("names the type an active form already exists for", () => {
    const error = formError({ status: 409, data: { code: "form_already_exists", ticket_type: "incident" } });
    expect(describeFormError(error)).toBe("This account already has an active form for incident.");
  });

  it("says a published version is frozen and names it", () => {
    const error = formError({ status: 409, data: { code: "form_version_published", version_no: 1 } });
    expect(describeFormError(error)).toBe("Version 1 is published and frozen. Draft a new version instead.");
  });
});
