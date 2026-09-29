import { describeError, type ApiError } from "@/lib/admin/api-error";
import {
  COLUMNS_BY_KIND,
  CONDITIONABLE_KINDS,
  conditionValuesOf,
  submissionError,
  type FormDefinition,
  type FormField,
  type FormFieldKind,
  type FormFieldOption,
  type FormTicketColumn,
  type SubmissionError,
} from "@/lib/portal/forms";

/**
 * The form builder's draft grammar (CP-03). A version is authored as a draft
 * and frozen on publish, so the editor holds the whole definition as one
 * draft and saves it as one body: a field cannot be half-saved, and a refused
 * definition changed nothing.
 *
 * Every check here is one the server makes in
 * `src/domain/portal/form-schema.ts`. Running them first is not a second
 * opinion, it is so an author reads the problem beside the field.
 */
export interface TicketFormVersion {
  id: string;
  account_id: string;
  form_id: string;
  version_no: number;
  definition: FormDefinition;
  published_at: string | null;
  published_by: string | null;
  created_at: string;
}

export interface TicketForm {
  id: string;
  account_id: string;
  ticket_type: string;
  name: string;
  description: string;
  current_version_id: string | null;
  is_active: boolean;
  client_visible: boolean;
  created_at: string;
  updated_at: string;
  version: number;
  versions: TicketFormVersion[];
}

/** One field being authored. Options are a draft list even for a kind that takes none. */
export interface FieldDraft {
  key: string;
  kind: FormFieldKind;
  label: string;
  help: string;
  required: boolean;
  options: FormFieldOption[];
  mapsTo: string;
  /** "" for no condition; otherwise the key of a field asked earlier. */
  conditionField: string;
  conditionEquals: string;
}

export const CUSTOM_PREFIX = "custom.";

export function emptyFieldDraft(index = 0): FieldDraft {
  return {
    key: `question_${index + 1}`,
    kind: "short_text",
    label: "",
    help: "",
    required: false,
    options: [],
    mapsTo: `${CUSTOM_PREFIX}question_${index + 1}`,
    conditionField: "",
    conditionEquals: "",
  };
}

export function draftFromField(field: FormField): FieldDraft {
  return {
    key: field.key,
    kind: field.kind,
    label: field.label,
    help: field.help ?? "",
    required: field.required ?? false,
    options: (field.options ?? []).map((option) => ({ ...option })),
    mapsTo: field.maps_to,
    conditionField: field.visible_when?.field ?? "",
    conditionEquals: field.visible_when === undefined ? "" : String(field.visible_when.equals),
  };
}

export function draftFromDefinition(definition: FormDefinition | undefined): FieldDraft[] {
  return (definition?.fields ?? []).map(draftFromField);
}

/** Where a field of this kind may send its answer: the columns it may write, then a custom key. */
export function mapsToOptions(draft: FieldDraft): { value: string; label: string }[] {
  const columns = COLUMNS_BY_KIND[draft.kind].map((column: FormTicketColumn) => ({
    value: column,
    label: `Ticket field: ${column}`,
  }));
  return [...columns, { value: `${CUSTOM_PREFIX}${draft.key}`, label: `Answer kept as custom.${draft.key}` }];
}

/** The condition value written back in the type the server expects. */
function conditionEqualsValue(controller: FieldDraft | undefined, raw: string): string | boolean {
  if (controller?.kind === "boolean") return raw === "true";
  return raw;
}

export function definitionFromDraft(fields: FieldDraft[]): FormDefinition {
  return {
    fields: fields.map((draft, index) => {
      const controller = fields.slice(0, index).find((other) => other.key === draft.conditionField);
      const field: FormField = {
        key: draft.key.trim(),
        kind: draft.kind,
        label: draft.label.trim(),
        maps_to: draft.mapsTo.trim(),
      };
      if (draft.help.trim()) field.help = draft.help.trim();
      if (draft.required) field.required = true;
      if (draft.kind === "choice" || draft.kind === "multi_choice")
        field.options = draft.options.map((option) => ({
          value: option.value.trim(),
          label: option.label.trim() || option.value.trim(),
        }));
      if (draft.conditionField)
        field.visible_when = {
          field: draft.conditionField,
          equals: conditionEqualsValue(controller, draft.conditionEquals),
        };
      return field;
    }),
  };
}

const KEY = /^[a-z][a-z0-9_]{0,60}$/;

/**
 * What the server would refuse, said here first: one line per problem, in
 * the order the fields are asked. An empty list means the definition is one
 * the API can enforce.
 */
export function validateFormDraft(fields: FieldDraft[]): string[] {
  const problems: string[] = [];
  if (fields.length === 0) problems.push("A form needs at least one field.");
  if (fields.length > 60) problems.push("A form takes at most 60 fields.");

  const seenKeys = new Set<string>();
  const seenTargets = new Set<string>();
  let attachments = 0;
  let urgency = 0;
  let impact = 0;

  for (const [index, draft] of fields.entries()) {
    const name = draft.label.trim() || draft.key.trim() || `Field ${index + 1}`;
    const key = draft.key.trim();
    if (!KEY.test(key))
      problems.push(`${name}: a field key is lower case letters, digits and underscores, starting with a letter.`);
    else if (seenKeys.has(key)) problems.push(`${name}: two fields share the key "${key}".`);
    seenKeys.add(key);

    if (draft.label.trim().length === 0) problems.push(`Field ${index + 1}: every field needs a label.`);
    else if (draft.label.length > 160) problems.push(`${name}: a label is at most 160 characters.`);
    if (draft.help.length > 400) problems.push(`${name}: help text is at most 400 characters.`);

    if (draft.kind === "attachment") attachments += 1;
    if (draft.kind === "urgency") urgency += 1;
    if (draft.kind === "impact") impact += 1;
    if (draft.kind === "attachment" && draft.required)
      problems.push(`${name}: an attachment field cannot be required.`);

    if (draft.kind === "choice" || draft.kind === "multi_choice") {
      const values = draft.options.map((option) => option.value.trim()).filter(Boolean);
      if (values.length === 0) problems.push(`${name}: a choice field needs at least one option.`);
      if (draft.options.length > 50) problems.push(`${name}: a choice field takes at most 50 options.`);
      if (new Set(values).size !== values.length) problems.push(`${name}: two options share the same value.`);
      if (draft.options.some((option) => option.label.trim().length === 0 && option.value.trim().length === 0))
        problems.push(`${name}: every option needs a value.`);
    }

    const target = draft.mapsTo.trim();
    if (target.length === 0) problems.push(`${name}: every field says where its answer goes.`);
    else if (target.startsWith(CUSTOM_PREFIX)) {
      if (!KEY.test(target.slice(CUSTOM_PREFIX.length)))
        problems.push(`${name}: "${target}" is not a usable custom key.`);
    } else if (!(COLUMNS_BY_KIND[draft.kind] as readonly string[]).includes(target))
      problems.push(`${name}: a ${draft.kind} field cannot write "${target}".`);
    if (target.length > 0) {
      if (seenTargets.has(target)) problems.push(`${name}: two fields write "${target}".`);
      seenTargets.add(target);
    }

    if (draft.conditionField) {
      const controller = fields.slice(0, index).find((other) => other.key.trim() === draft.conditionField);
      if (!controller) problems.push(`${name}: a condition names a field asked earlier on the same form.`);
      else if (!CONDITIONABLE_KINDS.includes(controller.kind))
        problems.push(`${name}: a condition cannot read a ${controller.kind} field.`);
      else if (!conditionValuesOf(controller).some((option) => option.value === draft.conditionEquals))
        problems.push(`${name}: "${draft.conditionEquals}" is not an answer "${controller.key}" can have.`);
    }
  }

  if (attachments > 1) problems.push("A form takes at most one attachment field.");
  if (urgency > 0 !== impact > 0) problems.push("A form asks for urgency and impact together or for neither.");
  return problems;
}

/** The fields a later field's condition may read: the conditionable ones asked before it. */
export function controllersFor(fields: FieldDraft[], index: number): FieldDraft[] {
  return fields.slice(0, index).filter((field) => CONDITIONABLE_KINDS.includes(field.kind) && field.key.trim());
}

export function publishedVersion(form: TicketForm): TicketFormVersion | undefined {
  return form.versions.find((version) => version.id === form.current_version_id && version.published_at);
}

/** The newest draft: the last version nobody has published. */
export function draftVersion(form: TicketForm): TicketFormVersion | undefined {
  return [...form.versions].reverse().find((version) => version.published_at === null);
}

export function versionLabel(version: TicketFormVersion): string {
  return version.published_at ? `Version ${version.version_no}, published` : `Version ${version.version_no}, draft`;
}

export const PUBLISH_FREEZES_NOTE =
  "Publishing freezes this version. It cannot be edited afterwards, and a request already being filled in keeps the version it started on. Author the next change as a new draft.";

export type TicketFormError = SubmissionError;

export function formError(error: unknown): TicketFormError {
  return submissionError(error);
}

export function describeFormError(error: TicketFormError): string {
  switch (error.code) {
    case "invalid_form_definition":
      return error.problems && error.problems.length > 0
        ? `The definition was refused: ${error.problems.map((problem) => problem.message).join("; ")}.`
        : "The definition was refused by the server's validation.";
    case "form_already_exists":
      return error.ticket_type
        ? `This account already has an active form for ${error.ticket_type}.`
        : "This account already has an active form for that request type.";
    case "form_version_published":
      return error.version_no
        ? `Version ${error.version_no} is published and frozen. Draft a new version instead.`
        : "That version is published and frozen. Draft a new version instead.";
    case "not_found":
      return "That form is no longer there. The list has been read again.";
    default:
      return describeError(error as ApiError);
  }
}
