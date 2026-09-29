import type { TicketForm, TicketFormVersion } from "@/lib/admin/ticket-forms";
import type { FormField, FormDefinition, PortalFormView } from "@/lib/portal/forms";

/**
 * Constructed request form fixtures (CP-03), shared by the builder tests and
 * the portal's dynamic form tests. No live account, key or endpoint.
 */
export const FORM_ACCOUNT_ID = "5c5c5c5c-5c5c-4c5c-8c5c-5c5c5c5c5c5c";
export const FORM_ID = "f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0";
export const DRAFT_VERSION_ID = "d0d0d0d0-d0d0-4d0d-8d0d-d0d0d0d0d0d0";
export const PUBLISHED_VERSION_ID = "b0b0b0b0-b0b0-4b0b-8b0b-b0b0b0b0b0b0";

export function aFormField(overrides: Partial<FormField> = {}): FormField {
  return {
    key: "short_description",
    kind: "short_text",
    label: "What went wrong?",
    required: true,
    maps_to: "short_description",
    ...overrides,
  };
}

/**
 * A definition that exercises the shapes the renderer has to tell apart: a
 * required summary, a choice that a later field's condition reads, and the
 * conditional long text that only a "reporting" answer asks for.
 */
export function aFormDefinition(overrides: Partial<FormDefinition> = {}): FormDefinition {
  return {
    fields: [
      aFormField(),
      aFormField({
        key: "area",
        kind: "choice",
        label: "Which area?",
        required: true,
        maps_to: "category",
        options: [
          { value: "reporting", label: "Reporting" },
          { value: "access", label: "Access" },
        ],
      }),
      aFormField({
        key: "report_name",
        kind: "short_text",
        label: "Which report?",
        required: true,
        maps_to: "custom.report_name",
        visible_when: { field: "area", equals: "reporting" },
      }),
      // Not required, so the definition carries no `required` key at all,
      // which is the shape the server writes and reads back.
      { key: "seen_before", kind: "boolean", label: "Has this happened before?", maps_to: "custom.seen_before" },
    ],
    ...overrides,
  };
}

export function aFormVersion(overrides: Partial<TicketFormVersion> = {}): TicketFormVersion {
  return {
    id: DRAFT_VERSION_ID,
    account_id: FORM_ACCOUNT_ID,
    form_id: FORM_ID,
    version_no: 2,
    definition: aFormDefinition(),
    published_at: null,
    published_by: null,
    created_at: "2026-09-07T09:00:00Z",
    ...overrides,
  };
}

export function aPublishedVersion(overrides: Partial<TicketFormVersion> = {}): TicketFormVersion {
  return aFormVersion({
    id: PUBLISHED_VERSION_ID,
    version_no: 1,
    definition: { fields: [aFormField()] },
    published_at: "2026-09-06T09:00:00Z",
    published_by: "user-cara",
    ...overrides,
  });
}

/** A form with version 1 published and version 2 waiting as a draft. */
export function aTicketForm(overrides: Partial<TicketForm> = {}): TicketForm {
  return {
    id: FORM_ID,
    account_id: FORM_ACCOUNT_ID,
    ticket_type: "incident",
    name: "Report a problem",
    description: "Something is broken or not working as it should.",
    current_version_id: PUBLISHED_VERSION_ID,
    is_active: true,
    client_visible: true,
    created_at: "2026-09-01T09:00:00Z",
    updated_at: "2026-09-07T09:00:00Z",
    version: 3,
    versions: [aPublishedVersion(), aFormVersion()],
    ...overrides,
  };
}

/** The form as GET /v1/portal/forms/:type answers it for a published one. */
export function aPortalForm(overrides: Partial<PortalFormView> = {}): PortalFormView {
  return {
    ticket_type: "incident",
    name: "Report a problem",
    description: "Something is broken or not working as it should.",
    form_id: FORM_ID,
    form_version_id: PUBLISHED_VERSION_ID,
    version_no: 1,
    source: "published",
    definition: aFormDefinition(),
    ...overrides,
  };
}

/** The fixed fallback the API answers where the account has published nothing. */
export function aDefaultPortalForm(overrides: Partial<PortalFormView> = {}): PortalFormView {
  return aPortalForm({
    form_id: null,
    form_version_id: null,
    version_no: null,
    source: "default",
    definition: { fields: [aFormField()] },
    ...overrides,
  });
}
