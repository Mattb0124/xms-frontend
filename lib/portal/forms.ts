import { apiError, describeError, type ApiError } from "@/lib/admin/api-error";

/**
 * Request forms (CP-03; Client Portal functional 5.4 step 3, technical 2.2
 * and 2.7). One vocabulary for the two sides of the same definition: the
 * operator's builder on the account record's Configuration tab, and the
 * client's form on the portal.
 *
 * The rules here are a mirror of `src/domain/portal/form-schema.ts`, not a
 * second opinion: the builder refuses locally what the server would refuse
 * anyway, so an author sees the problem beside the field rather than in a
 * toast, and the server still decides. Nothing here relaxes a server rule.
 */
export const FORM_FIELD_KINDS = [
  "short_text",
  "long_text",
  "choice",
  "multi_choice",
  "date",
  "number",
  "boolean",
  "ci_picker",
  "contact_picker",
  "urgency",
  "impact",
  "attachment",
] as const;
export type FormFieldKind = (typeof FORM_FIELD_KINDS)[number];

export const FORM_TICKET_TYPES = ["incident", "service_request", "change"] as const;
export type FormTicketType = (typeof FORM_TICKET_TYPES)[number];

/** The ticket columns a field may write; everything else lands in `custom.<key>`. */
export const FORM_TICKET_COLUMNS = [
  "short_description",
  "description",
  "category",
  "impact",
  "urgency",
  "configuration_item_id",
] as const;
export type FormTicketColumn = (typeof FORM_TICKET_COLUMNS)[number];

/** Which columns each kind may write. A kind with none writes a custom key alone. */
export const COLUMNS_BY_KIND: Record<FormFieldKind, readonly FormTicketColumn[]> = {
  short_text: ["short_description", "category"],
  long_text: ["description"],
  choice: ["category"],
  multi_choice: [],
  date: [],
  number: [],
  boolean: [],
  ci_picker: ["configuration_item_id"],
  contact_picker: [],
  urgency: ["urgency"],
  impact: ["impact"],
  attachment: [],
};

/** The kinds a later field's condition may read. */
export const CONDITIONABLE_KINDS: readonly FormFieldKind[] = ["choice", "multi_choice", "boolean", "urgency", "impact"];

export const LEVELS = ["high", "medium", "low"] as const;
export type FormLevel = (typeof LEVELS)[number];

export interface FormFieldOption {
  value: string;
  label: string;
}

export interface FormFieldCondition {
  field: string;
  equals: string | number | boolean;
}

export interface FormField {
  key: string;
  kind: FormFieldKind;
  label: string;
  help?: string;
  required?: boolean;
  options?: FormFieldOption[];
  visible_when?: FormFieldCondition;
  maps_to: string;
}

export interface FormDefinition {
  fields: FormField[];
}

/** A request type and the form behind it, as GET /v1/portal/forms answers. */
export interface PortalFormView {
  ticket_type: FormTicketType;
  name: string;
  description: string;
  form_id: string | null;
  form_version_id: string | null;
  version_no: number | null;
  /** `published` is the account's own form; `default` is the fixed fallback. */
  source: "published" | "default";
  definition: FormDefinition;
}

const KIND_LABELS: Record<FormFieldKind, string> = {
  short_text: "Short text",
  long_text: "Long text",
  choice: "One of a list",
  multi_choice: "Several of a list",
  date: "Date",
  number: "Number",
  boolean: "Yes or no",
  ci_picker: "Configuration item",
  contact_picker: "Contact",
  urgency: "Urgency",
  impact: "Impact",
  attachment: "Files",
};

export function kindLabel(kind: FormFieldKind): string {
  return KIND_LABELS[kind] ?? kind;
}

const TYPE_LABELS: Record<FormTicketType, string> = {
  incident: "Incident",
  service_request: "Service request",
  change: "Change",
};

export function formTypeLabel(type: string): string {
  return TYPE_LABELS[type as FormTicketType] ?? type;
}

const LEVEL_LABELS: Record<FormLevel, string> = { high: "High", medium: "Medium", low: "Low" };

export function levelLabel(level: string): string {
  return LEVEL_LABELS[level as FormLevel] ?? level;
}

/** The kinds whose answer is a list rather than a single value. */
export function isListKind(kind: FormFieldKind): boolean {
  return kind === "multi_choice" || kind === "attachment";
}

/** The answers a condition on this field may test, for the builder's picker. */
export function conditionValuesOf(field: { kind: FormFieldKind; options?: FormFieldOption[] }): FormFieldOption[] {
  if (field.kind === "boolean")
    return [
      { value: "true", label: "Yes" },
      { value: "false", label: "No" },
    ];
  if (field.kind === "urgency" || field.kind === "impact")
    return LEVELS.map((level) => ({ value: level, label: levelLabel(level) }));
  return (field.options ?? []).map((option) => ({ value: option.value, label: option.label || option.value }));
}

// The client's side of a published form -------------------------------------

export type FormAnswer = string | number | boolean | string[] | undefined;
export type FormAnswers = Record<string, FormAnswer>;

/**
 * Whether a field is asked, given what has been answered above it. The
 * server reads a condition the same way: an unanswered controller hides the
 * field, and a multi_choice controller holds it when the value is among the
 * answers picked.
 */
export function conditionHolds(condition: FormFieldCondition, answers: FormAnswers): boolean {
  const answer = answers[condition.field];
  if (answer === undefined || answer === "") return false;
  if (Array.isArray(answer)) return answer.includes(String(condition.equals));
  if (typeof condition.equals === "boolean") return answer === condition.equals;
  if (typeof condition.equals === "number") return answer === condition.equals;
  return answer === condition.equals;
}

/** The fields a client is asked right now, in the definition's own order. */
export function visibleFields(definition: FormDefinition, answers: FormAnswers): FormField[] {
  const visible: FormField[] = [];
  const sofar: FormAnswers = {};
  for (const field of definition.fields) {
    if (field.visible_when && !conditionHolds(field.visible_when, sofar)) continue;
    visible.push(field);
    sofar[field.key] = answers[field.key];
  }
  return visible;
}

function isBlank(answer: FormAnswer): boolean {
  if (answer === undefined || answer === null) return true;
  if (typeof answer === "string") return answer.trim().length === 0;
  if (Array.isArray(answer)) return answer.length === 0;
  return false;
}

/**
 * The `answers` body for POST /v1/portal/tickets: only the fields being
 * asked, only the ones answered, each in the shape its kind takes. A field a
 * condition hid is left out entirely rather than sent as an empty answer,
 * because the server refuses an answer for a field it did not ask for.
 */
export function answersBody(definition: FormDefinition, answers: FormAnswers): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const field of visibleFields(definition, answers)) {
    const answer = answers[field.key];
    if (isBlank(answer)) continue;
    if (field.kind === "number") {
      const value = typeof answer === "number" ? answer : Number(answer);
      body[field.key] = Number.isFinite(value) ? value : answer;
      continue;
    }
    if (field.kind === "boolean") {
      body[field.key] = answer === true || answer === "true";
      continue;
    }
    body[field.key] = typeof answer === "string" ? answer.trim() : answer;
  }
  return body;
}

/** The required fields a client has left blank, refused before the API is asked. */
export function missingRequired(definition: FormDefinition, answers: FormAnswers): string[] {
  return visibleFields(definition, answers)
    .filter((field) => field.required && field.kind !== "attachment" && isBlank(answers[field.key]))
    .map((field) => field.key);
}

// Refusals -------------------------------------------------------------------

export interface FormProblem {
  field: string;
  code: string;
  message: string;
}

export interface SubmissionError extends ApiError {
  /** invalid_submission and invalid_form_definition both carry these. */
  problems?: FormProblem[];
  ticket_type?: string;
  version_no?: number;
}

export function submissionError(error: unknown): SubmissionError {
  const parsed = apiError(error) as SubmissionError;
  const data = (error as { data?: Record<string, unknown> })?.data;
  if (data && typeof data === "object") {
    if (Array.isArray(data.problems))
      parsed.problems = data.problems
        .filter((problem): problem is FormProblem => typeof problem === "object" && problem !== null)
        .map((problem) => ({
          field: String(problem.field ?? ""),
          code: String(problem.code ?? "bad_value"),
          message: String(problem.message ?? ""),
        }));
    if (typeof data.ticket_type === "string") parsed.ticket_type = data.ticket_type;
    if (typeof data.version_no === "number") parsed.version_no = data.version_no;
  }
  return parsed;
}

/** The server's problems keyed by the field they name, for wording beside it. */
export function problemsByField(error: SubmissionError): Record<string, string> {
  const byField: Record<string, string> = {};
  for (const problem of error.problems ?? []) if (!byField[problem.field]) byField[problem.field] = problem.message;
  return byField;
}

export const FORM_ANSWERS_REQUIRED_MESSAGE =
  "This request form was updated while you were filling it in. Reload the page and answer the questions it asks now.";

/** The whole-form line: what the client is told above the fields. */
export function describeSubmissionError(error: SubmissionError): string {
  switch (error.code) {
    case "form_answers_required":
      return FORM_ANSWERS_REQUIRED_MESSAGE;
    case "invalid_submission": {
      const count = error.problems?.length ?? 0;
      if (count === 0) return "The request was not accepted. Check the answers and send it again.";
      return count === 1
        ? "One answer needs your attention before this can be sent."
        : `${count} answers need your attention before this can be sent.`;
    }
    case "type_not_offered":
      return "That kind of request is not offered on this account.";
    default:
      return describeError(error);
  }
}
