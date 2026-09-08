import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PortalNewRequestPage from "@/app/(portal)/portal/requests/new/page";
import { DynamicRequestForm } from "@/components/portal/dynamic-request-form";
import { submissionError } from "@/lib/portal/forms";
import { aDefaultPortalForm, aFormField, aPortalForm } from "@/test-kit/forms";
import { json, renderPortal, stubFetch } from "@/test-kit/portal";

vi.mock("next/navigation", () => ({
  usePathname: () => "/portal/requests/new",
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const FORMS = "GET /v1/portal/forms";
const CREATE = "POST /v1/portal/tickets";
const formOf = (type: string) => `GET /v1/portal/forms/${type}`;

/**
 * The client's side of a published form (CP-03). The fields are the
 * server's, a condition decides what is asked, and every refusal is worded
 * where the client can act on it.
 */
describe("the published request form", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders each kind, asks a conditional field only once its condition holds, and posts type and answers", async () => {
    const onSubmit = vi.fn();
    renderPortal(<DynamicRequestForm view={aPortalForm()} onSubmit={onSubmit} />);

    // The conditional field is not asked until the choice above it is made.
    expect(screen.queryByLabelText(/Which report\?/)).toBeNull();
    fireEvent.change(screen.getByLabelText("What went wrong?"), { target: { value: "  Report fails  " } });
    fireEvent.change(screen.getByLabelText("Which area?"), { target: { value: "reporting" } });
    const conditional = await screen.findByLabelText("Which report?");
    fireEvent.change(conditional, { target: { value: "Group consolidation" } });
    fireEvent.click(screen.getByLabelText(/Has this happened before\?/));

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(onSubmit).toHaveBeenCalledWith({
      type: "incident",
      answers: {
        short_description: "Report fails",
        area: "reporting",
        report_name: "Group consolidation",
        seen_before: true,
      },
    });
  });

  it("stops a required answer from being sent and says which one is needed", async () => {
    const onSubmit = vi.fn();
    renderPortal(<DynamicRequestForm view={aPortalForm()} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(onSubmit).not.toHaveBeenCalled();
    await screen.findByText("What went wrong? is needed before this can be sent.");
    expect(screen.getByLabelText("What went wrong?")).toHaveAttribute("aria-invalid", "true");
  });

  it("sends nothing for a field a condition hid, even when it was answered before the choice changed", () => {
    const onSubmit = vi.fn();
    renderPortal(<DynamicRequestForm view={aPortalForm()} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText("What went wrong?"), { target: { value: "Broken" } });
    fireEvent.change(screen.getByLabelText("Which area?"), { target: { value: "reporting" } });
    fireEvent.change(screen.getByLabelText("Which report?"), { target: { value: "Trial balance" } });
    // Changing the area hides the report question; the answer must not travel.
    fireEvent.change(screen.getByLabelText("Which area?"), { target: { value: "access" } });
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(onSubmit).toHaveBeenCalledWith({
      type: "incident",
      answers: { short_description: "Broken", area: "access" },
    });
  });

  it("renders a number, a date and a several-of-a-list field in the shape each answer takes", () => {
    const onSubmit = vi.fn();
    const view = aPortalForm({
      definition: {
        fields: [
          aFormField(),
          aFormField({ key: "seats", kind: "number", label: "How many people?", maps_to: "custom.seats" }),
          aFormField({ key: "needed_by", kind: "date", label: "Needed by", maps_to: "custom.needed_by" }),
          aFormField({
            key: "systems",
            kind: "multi_choice",
            label: "Which systems?",
            maps_to: "custom.systems",
            options: [
              { value: "erp", label: "ERP" },
              { value: "crm", label: "CRM" },
            ],
          }),
        ],
      },
    });
    renderPortal(<DynamicRequestForm view={view} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText("What went wrong?"), { target: { value: "Access" } });
    fireEvent.change(screen.getByLabelText(/How many people\?/), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText(/Needed by/), { target: { value: "2026-10-01" } });
    fireEvent.click(screen.getByLabelText("ERP"));
    fireEvent.click(screen.getByLabelText("CRM"));
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(onSubmit).toHaveBeenCalledWith({
      type: "incident",
      answers: { short_description: "Access", seats: 3, needed_by: "2026-10-01", systems: ["erp", "crm"] },
    });
  });

  it("words an invalid_submission problem beside its own field", async () => {
    const error = submissionError({
      status: 400,
      data: {
        code: "invalid_submission",
        problems: [
          { field: "area", code: "not_an_option", message: '"Which area?" is not one of the offered answers' },
        ],
      },
    });
    renderPortal(<DynamicRequestForm view={aPortalForm()} onSubmit={vi.fn()} error={error} />);
    await screen.findByText('"Which area?" is not one of the offered answers');
    expect(screen.getByText("One answer needs your attention before this can be sent.")).toBeTruthy();
  });

  it("words form_answers_required about the whole form, since the form changed underneath the page", async () => {
    const error = submissionError({
      status: 400,
      data: { code: "form_answers_required", ticket_type: "incident", form_version_id: "v-9" },
    });
    renderPortal(<DynamicRequestForm view={aPortalForm()} onSubmit={vi.fn()} error={error} />);
    await screen.findByText(/This request form was updated while you were filling it in/);
  });

  it("points an attachment field at the files card rather than asking for identifiers", () => {
    const view = aPortalForm({
      definition: {
        fields: [
          aFormField(),
          aFormField({
            key: "files",
            kind: "attachment",
            label: "Screenshots",
            maps_to: "custom.files",
            required: undefined,
          }),
        ],
      },
    });
    renderPortal(<DynamicRequestForm view={view} onSubmit={vi.fn()} />);
    expect(screen.getByText("Screenshots")).toBeTruthy();
    expect(screen.getByText(/Add the files below/)).toBeTruthy();
  });
});

/**
 * The page decides which of the two forms a client fills in, and the account
 * that has published nothing keeps the fixed one it always had.
 */
describe("the new request page", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the fixed form where the account has published none", async () => {
    const calls = stubFetch({
      [FORMS]: () =>
        json({
          items: [
            aDefaultPortalForm(),
            aDefaultPortalForm({ ticket_type: "service_request", name: "Ask for something" }),
          ],
        }),
      [CREATE]: () => json({ key: "CS0001001" }),
    });
    renderPortal(<PortalNewRequestPage />);
    // The fixed form asks for the type itself and posts the flat shape.
    await screen.findByLabelText(/Something is broken/);
    fireEvent.click(screen.getByLabelText(/Something is broken/));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Report fails" } });
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(calls.some((call) => call.key === CREATE)).toBe(true));
    expect(calls.find((call) => call.key === CREATE)?.body).toEqual({
      type: "incident",
      short_description: "Report fails",
    });
    // Nothing was read through the per-type route, because nothing is published.
    expect(calls.some((call) => call.key.startsWith("GET /v1/portal/forms/"))).toBe(false);
  });

  it("offers the account's own types and fills in the published form for the chosen one", async () => {
    const calls = stubFetch({
      [FORMS]: () =>
        json({
          items: [
            aPortalForm({ name: "Report a problem" }),
            aDefaultPortalForm({ ticket_type: "service_request", name: "Ask for something" }),
          ],
        }),
      [formOf("incident")]: () => json(aPortalForm()),
      [CREATE]: () => json({ key: "CS0001002" }),
    });
    renderPortal(<PortalNewRequestPage />);
    fireEvent.click(await screen.findByRole("radio", { name: /Report a problem/ }));
    await screen.findByLabelText("What went wrong?");
    fireEvent.change(screen.getByLabelText("What went wrong?"), { target: { value: "Report fails" } });
    fireEvent.change(screen.getByLabelText("Which area?"), { target: { value: "access" } });
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(calls.some((call) => call.key === CREATE)).toBe(true));
    expect(calls.find((call) => call.key === CREATE)?.body).toEqual({
      type: "incident",
      answers: { short_description: "Report fails", area: "access" },
    });
  });

  it("falls back to the fixed form for a type the account has published none for", async () => {
    const calls = stubFetch({
      [FORMS]: () =>
        json({
          items: [aPortalForm(), aDefaultPortalForm({ ticket_type: "service_request", name: "Ask for something" })],
        }),
      [formOf("service_request")]: () =>
        json(aDefaultPortalForm({ ticket_type: "service_request", name: "Ask for something" })),
      [CREATE]: () => json({ key: "CS0001003" }),
    });
    renderPortal(<PortalNewRequestPage />);
    fireEvent.click(await screen.findByRole("radio", { name: /Ask for something/ }));
    // The fixed form, with the type already chosen above it rather than asked twice.
    const title = (await screen.findByLabelText("Title")) as HTMLInputElement;
    fireEvent.change(title, { target: { value: "New starter access" } });
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(calls.some((call) => call.key === CREATE)).toBe(true));
    expect(calls.find((call) => call.key === CREATE)?.body).toEqual({
      type: "service_request",
      short_description: "New starter access",
    });
  });

  it("words the server's per-field refusal on the published form", async () => {
    stubFetch({
      [FORMS]: () => json({ items: [aPortalForm()] }),
      [formOf("incident")]: () => json(aPortalForm()),
      [CREATE]: () =>
        json(
          {
            code: "invalid_submission",
            problems: [{ field: "area", code: "not_an_option", message: "That area is no longer offered" }],
          },
          400,
        ),
    });
    renderPortal(<PortalNewRequestPage />);
    fireEvent.click(await screen.findByRole("radio", { name: /Report a problem/ }));
    await screen.findByLabelText("What went wrong?");
    fireEvent.change(screen.getByLabelText("What went wrong?"), { target: { value: "Broken" } });
    fireEvent.change(screen.getByLabelText("Which area?"), { target: { value: "access" } });
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    await screen.findByText("That area is no longer offered");
  });
});
