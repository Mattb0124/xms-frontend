"use client";

import { useState } from "react";
import {
  FieldError,
  PORTAL_INPUT,
  PORTAL_PRIMARY,
  PORTAL_TEXTAREA,
  PortalNotice,
} from "@/components/portal/primitives";
import {
  answersBody,
  describeSubmissionError,
  LEVELS,
  levelLabel,
  missingRequired,
  problemsByField,
  visibleFields,
  type FormAnswer,
  type FormAnswers,
  type FormField,
  type PortalFormView,
  type SubmissionError,
} from "@/lib/portal/forms";
import type { CreatePortalTicketBody, PortalTicketType } from "@/redux/portalApi";

/**
 * The form the account published for this request type (CP-03; Client Portal
 * functional 5.4 step 3). The fields, their order, whether each is required
 * and which of them are asked at all are the server's; this renders them by
 * kind and posts `{ type, answers }`.
 *
 * A field a condition hides is not asked and not sent, because the server
 * refuses an answer to a question it did not ask. Every refusal the server
 * words is shown where the client can act on it: an `invalid_submission`
 * problem sits beside its own field, and `form_answers_required`, which means
 * the form changed underneath this page, is said about the whole form.
 */
function fieldId(field: FormField): string {
  return `form-field-${field.key}`;
}

function FieldControl({
  field,
  answer,
  problem,
  onChange,
}: {
  field: FormField;
  answer: FormAnswer;
  problem?: string;
  onChange: (value: FormAnswer) => void;
}) {
  const id = fieldId(field);
  const described = [field.help ? `${id}-hint` : null, problem ? `${id}-error` : null].filter(Boolean).join(" ");
  const shared = {
    id,
    name: field.key,
    "aria-invalid": problem ? true : undefined,
    "aria-describedby": described || undefined,
  };

  switch (field.kind) {
    case "long_text":
      return (
        <textarea
          {...shared}
          rows={6}
          value={typeof answer === "string" ? answer : ""}
          onChange={(event) => onChange(event.target.value)}
          className={PORTAL_TEXTAREA}
        />
      );
    case "choice":
      return (
        <select
          {...shared}
          value={typeof answer === "string" ? answer : ""}
          onChange={(event) => onChange(event.target.value)}
          className={PORTAL_INPUT}
        >
          <option value="">Choose one</option>
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    case "multi_choice": {
      const chosen = Array.isArray(answer) ? answer : [];
      return (
        <div className="flex flex-col gap-2" aria-describedby={described || undefined}>
          {(field.options ?? []).map((option) => (
            <label key={option.value} className="text-xms-body flex items-center gap-2 text-[14px]">
              <input
                type="checkbox"
                name={field.key}
                value={option.value}
                checked={chosen.includes(option.value)}
                onChange={(event) =>
                  onChange(
                    event.target.checked ? [...chosen, option.value] : chosen.filter((value) => value !== option.value),
                  )
                }
              />
              {option.label}
            </label>
          ))}
        </div>
      );
    }
    case "date":
      return (
        <input
          {...shared}
          type="date"
          value={typeof answer === "string" ? answer : ""}
          onChange={(event) => onChange(event.target.value)}
          className={PORTAL_INPUT}
        />
      );
    case "number":
      return (
        <input
          {...shared}
          type="number"
          value={answer === undefined ? "" : String(answer)}
          onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))}
          className={PORTAL_INPUT}
        />
      );
    case "boolean":
      return (
        <input
          {...shared}
          type="checkbox"
          checked={answer === true}
          onChange={(event) => onChange(event.target.checked)}
        />
      );
    case "urgency":
    case "impact":
      return (
        <select
          {...shared}
          value={typeof answer === "string" ? answer : ""}
          onChange={(event) => onChange(event.target.value)}
          className={PORTAL_INPUT}
        >
          <option value="">Not sure</option>
          {LEVELS.map((level) => (
            <option key={level} value={level}>
              {levelLabel(level)}
            </option>
          ))}
        </select>
      );
    default:
      return (
        <input
          {...shared}
          value={typeof answer === "string" ? answer : ""}
          maxLength={field.kind === "short_text" ? 300 : undefined}
          onChange={(event) => onChange(event.target.value)}
          className={PORTAL_INPUT}
        />
      );
  }
}

/** What the client is told about a kind the portal cannot offer a picker for. */
function fieldHint(field: FormField): string | undefined {
  if (field.help) return field.help;
  if (field.kind === "ci_picker") return "The identifier of the system or item this is about, if you have it.";
  if (field.kind === "contact_picker") return "The identifier of the person this is about, if you have it.";
  return undefined;
}

export function DynamicRequestForm({
  view,
  onSubmit,
  submitting,
  error,
}: {
  view: PortalFormView;
  onSubmit: (body: CreatePortalTicketBody) => void;
  submitting?: boolean;
  error?: SubmissionError;
}) {
  const [answers, setAnswers] = useState<FormAnswers>({});
  const [missing, setMissing] = useState<string[]>([]);
  const fields = visibleFields(view.definition, answers);
  const serverProblems = error ? problemsByField(error) : {};
  const wholeForm = error ? describeSubmissionError(error) : undefined;

  const problemOf = (field: FormField): string | undefined =>
    missing.includes(field.key) ? `${field.label} is needed before this can be sent.` : serverProblems[field.key];

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      aria-label={view.name}
      onSubmit={(event) => {
        event.preventDefault();
        const blank = missingRequired(view.definition, answers);
        setMissing(blank);
        if (blank.length > 0) return;
        onSubmit({
          type: view.ticket_type as PortalTicketType,
          answers: answersBody(view.definition, answers),
        });
      }}
    >
      {view.description ? <p className="text-xms-label text-[13px]">{view.description}</p> : null}
      {wholeForm ? <PortalNotice tone="error">{wholeForm}</PortalNotice> : null}

      {fields.map((field) => {
        const id = fieldId(field);
        const hint = fieldHint(field);
        if (field.kind === "attachment")
          return (
            <div key={field.key} className="flex flex-col gap-1">
              <p className="text-xms-ink text-[14px] font-medium">{field.label}</p>
              <p className="text-xms-label text-[12px]">
                {hint ?? "Add the files below. They are checked and attached once the request is created."}
              </p>
            </div>
          );
        return (
          <div key={field.key} className="flex flex-col gap-1">
            <label htmlFor={id} className="text-xms-ink text-[14px] font-medium">
              {field.label}
              {field.required ? null : <span className="text-xms-label font-normal"> (optional)</span>}
            </label>
            <FieldControl
              field={field}
              answer={answers[field.key]}
              problem={problemOf(field)}
              onChange={(value) => setAnswers((current) => ({ ...current, [field.key]: value }))}
            />
            {hint ? (
              <p id={`${id}-hint`} className="text-xms-label text-[12px]">
                {hint}
              </p>
            ) : null}
            <FieldError id={`${id}-error`} message={problemOf(field)} />
          </div>
        );
      })}

      <div className="flex items-center gap-3">
        <button type="submit" className={PORTAL_PRIMARY} disabled={submitting}>
          {submitting ? "Sending..." : "Send request"}
        </button>
        <p className="text-xms-label text-[13px]">You will get an email with the request key and every reply.</p>
      </div>
    </form>
  );
}
