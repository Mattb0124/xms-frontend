"use client";

import { useState } from "react";
import {
  FieldError,
  PORTAL_INPUT,
  PORTAL_PRIMARY,
  PORTAL_TEXTAREA,
  PortalNotice,
} from "@/components/portal/primitives";
import { IMPACT_OPTIONS, PORTAL_TYPES, URGENCY_OPTIONS } from "@/lib/portal/client-language";
import type { CreatePortalTicketBody, PortalLevel, PortalTicketType } from "@/redux/portalApi";

/**
 * The new request form (Client Portal functional 5.4 step 3, cut to the
 * default form per type). Validation is inline and blocks submission; the
 * server derives priority from impact and urgency.
 */
export interface RequestFormErrors {
  type?: string;
  short_description?: string;
  description?: string;
}

export function validateRequest(values: RequestFormValues): RequestFormErrors {
  const errors: RequestFormErrors = {};
  if (!values.type) errors.type = "Choose what kind of request this is.";
  const title = values.short_description.trim();
  if (title.length === 0) errors.short_description = "Give the request a short title.";
  else if (title.length > 300) errors.short_description = "Keep the title under 300 characters.";
  if (values.description.length > 50000) errors.description = "The description is too long.";
  return errors;
}

export interface RequestFormValues {
  type: PortalTicketType | "";
  short_description: string;
  description: string;
  category: string;
  impact: PortalLevel | "";
  urgency: PortalLevel | "";
}

const EMPTY: RequestFormValues = {
  type: "",
  short_description: "",
  description: "",
  category: "",
  impact: "",
  urgency: "",
};

export function toBody(values: RequestFormValues): CreatePortalTicketBody {
  return {
    type: values.type as PortalTicketType,
    short_description: values.short_description.trim(),
    description: values.description.trim() || undefined,
    category: values.category.trim() || undefined,
    impact: values.impact || undefined,
    urgency: values.urgency || undefined,
  };
}

export function RequestForm({
  onSubmit,
  submitting,
  serverError,
}: {
  onSubmit: (body: CreatePortalTicketBody) => void;
  submitting?: boolean;
  serverError?: string;
}) {
  const [values, setValues] = useState<RequestFormValues>(EMPTY);
  const [errors, setErrors] = useState<RequestFormErrors>({});
  const [touched, setTouched] = useState(false);

  const set = <K extends keyof RequestFormValues>(key: K, value: RequestFormValues[K]) => {
    const next = { ...values, [key]: value };
    setValues(next);
    if (touched) setErrors(validateRequest(next));
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        const found = validateRequest(values);
        setErrors(found);
        setTouched(true);
        if (Object.keys(found).length === 0) onSubmit(toBody(values));
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="text-xms-ink mb-1 text-[14px] font-medium">What kind of request is this?</legend>
        {PORTAL_TYPES.map((option) => (
          <label
            key={option.value}
            className="border-xms-line has-[:checked]:border-xms-accent has-[:checked]:bg-xms-tint flex cursor-pointer items-start gap-3 rounded-[6px] border p-3"
          >
            <input
              type="radio"
              name="type"
              value={option.value}
              checked={values.type === option.value}
              onChange={() => set("type", option.value)}
              aria-describedby={errors.type ? "type-error" : undefined}
              className="mt-1"
            />
            <span>
              <span className="text-xms-ink block text-[14px] font-medium">{option.label}</span>
              <span className="text-xms-label block text-[13px]">{option.hint}</span>
            </span>
          </label>
        ))}
        <FieldError id="type-error" message={errors.type} />
      </fieldset>

      <div className="flex flex-col gap-1">
        <label htmlFor="short_description" className="text-xms-ink text-[14px] font-medium">
          Title
        </label>
        <input
          id="short_description"
          name="short_description"
          value={values.short_description}
          onChange={(event) => set("short_description", event.target.value)}
          aria-invalid={Boolean(errors.short_description)}
          aria-describedby={errors.short_description ? "short_description-error" : "short_description-hint"}
          className={PORTAL_INPUT}
          maxLength={300}
          required
        />
        <p id="short_description-hint" className="text-xms-label text-[12px]">
          One line that says what is wrong or what you need.
        </p>
        <FieldError id="short_description-error" message={errors.short_description} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-xms-ink text-[14px] font-medium">
          Details
        </label>
        <textarea
          id="description"
          name="description"
          rows={6}
          value={values.description}
          onChange={(event) => set("description", event.target.value)}
          aria-describedby={errors.description ? "description-error" : "description-hint"}
          className={PORTAL_TEXTAREA}
        />
        <p id="description-hint" className="text-xms-label text-[12px]">
          What you did, what you expected, what happened instead. Error text helps.
        </p>
        <FieldError id="description-error" message={errors.description} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="category" className="text-xms-ink text-[14px] font-medium">
          Area <span className="text-xms-label font-normal">(optional)</span>
        </label>
        <input
          id="category"
          name="category"
          value={values.category}
          onChange={(event) => set("category", event.target.value)}
          className={PORTAL_INPUT}
          maxLength={120}
          placeholder="Reporting, access, integration..."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <LevelSelect
          id="impact"
          label="How many people are affected?"
          options={IMPACT_OPTIONS}
          value={values.impact}
          onChange={(value) => set("impact", value)}
        />
        <LevelSelect
          id="urgency"
          label="How soon do you need this?"
          options={URGENCY_OPTIONS}
          value={values.urgency}
          onChange={(value) => set("urgency", value)}
        />
      </div>

      {serverError ? <PortalNotice tone="error">{serverError}</PortalNotice> : null}

      <div className="flex items-center gap-3">
        <button type="submit" className={PORTAL_PRIMARY} disabled={submitting}>
          {submitting ? "Sending..." : "Send request"}
        </button>
        <p className="text-xms-label text-[13px]">You will get an email with the request key and every reply.</p>
      </div>
    </form>
  );
}

function LevelSelect({
  id,
  label,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  options: { value: PortalLevel; label: string; hint: string }[];
  value: PortalLevel | "";
  onChange: (value: PortalLevel | "") => void;
}) {
  const hint = options.find((option) => option.value === value)?.hint;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xms-ink text-[14px] font-medium">
        {label}
      </label>
      <select
        id={id}
        name={id}
        value={value}
        onChange={(event) => onChange(event.target.value as PortalLevel | "")}
        aria-describedby={`${id}-hint`}
        className={PORTAL_INPUT}
      >
        <option value="">Not sure</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <p id={`${id}-hint`} className="text-xms-label min-h-[16px] text-[12px]">
        {hint ?? "Leave it if you are not sure; the team will set it."}
      </p>
    </div>
  );
}
