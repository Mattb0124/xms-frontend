import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TicketFormsPanel } from "@/components/admin/forms/ticket-forms-panel";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";
import { aTicketForm, DRAFT_VERSION_ID, FORM_ACCOUNT_ID, FORM_ID } from "@/test-kit/forms";

const FORMS = `GET /v1/accounts/${FORM_ACCOUNT_ID}/forms`;
const CREATE = `POST /v1/accounts/${FORM_ACCOUNT_ID}/forms`;
const EDIT_DRAFT = `PUT /v1/accounts/${FORM_ACCOUNT_ID}/forms/${FORM_ID}/versions/${DRAFT_VERSION_ID}`;
const ADD_DRAFT = `POST /v1/accounts/${FORM_ACCOUNT_ID}/forms/${FORM_ID}/versions`;
const PUBLISH = `POST /v1/accounts/${FORM_ACCOUNT_ID}/forms/${FORM_ID}/versions/${DRAFT_VERSION_ID}/publish`;

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: [FORM_ACCOUNT_ID], permissions } });

/**
 * The request form builder (CP-03). Every route answers to `admin:config`,
 * so the panel asks nothing without it; a version is a draft until it is
 * published, and publishing freezes it.
 */
describe("TicketFormsPanel", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("asks nothing without admin:config and says which permission is missing", async () => {
    const calls = stubFetch({ "GET /v1/admin/me": me(["admin:accounts"]) });
    renderDesk(<TicketFormsPanel accountId={FORM_ACCOUNT_ID} />);
    await screen.findByText(/which this account binding does not carry/);
    expect(calls.some((call) => call.key.includes("/forms"))).toBe(false);
  });

  it("lists the forms per type with the published version, and shows what a client is asked now", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["admin:accounts", "admin:config"]),
      [FORMS]: () => json([aTicketForm()]),
    });
    renderDesk(<TicketFormsPanel accountId={FORM_ACCOUNT_ID} />);
    await screen.findAllByText("Report a problem");
    expect(screen.getByText("Published version 1")).toBeTruthy();
    // The published version, read only: the summary field it froze, listed
    // beside the key and the ticket field it writes.
    const publishedFields = within(screen.getByLabelText("Published fields"));
    expect(publishedFields.getByText("What went wrong?")).toBeTruthy();
    expect(publishedFields.getAllByText("short_description").length).toBe(2);
    // The draft on top of it carries the newer fields.
    expect((screen.getByLabelText("Label of field 2") as HTMLInputElement).value).toBe("Which area?");
  });

  it("says a type with no published version still serves the fixed default form", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["admin:config"]),
      [FORMS]: () => json([aTicketForm({ current_version_id: null })]),
    });
    renderDesk(<TicketFormsPanel accountId={FORM_ACCOUNT_ID} />);
    await screen.findByText(/still serves the fixed default form/);
  });

  it("refuses a draft the server would refuse, then saves the whole definition in one PUT", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["admin:config"]),
      [FORMS]: () => json([aTicketForm()]),
      [EDIT_DRAFT]: () => json({ id: DRAFT_VERSION_ID, version_no: 2 }),
    });
    renderDesk(<TicketFormsPanel accountId={FORM_ACCOUNT_ID} />);
    await screen.findByLabelText("Label of field 1");

    // Emptying a label is refused here rather than by a 400 from the API.
    fireEvent.change(screen.getByLabelText("Label of field 1"), { target: { value: "" } });
    fireEvent.click(screen.getByText("Save draft"));
    await screen.findByText("Field 1: every field needs a label.");
    expect(calls.some((call) => call.key === EDIT_DRAFT)).toBe(false);

    fireEvent.change(screen.getByLabelText("Label of field 1"), { target: { value: "What is wrong?" } });
    fireEvent.click(screen.getByText("Save draft"));
    await waitFor(() => expect(calls.some((call) => call.key === EDIT_DRAFT)).toBe(true));
    const body = calls.find((call) => call.key === EDIT_DRAFT)?.body as {
      definition: { fields: { key: string; label: string; visible_when?: unknown }[] };
    };
    expect(body.definition.fields.map((field) => field.key)).toEqual([
      "short_description",
      "area",
      "report_name",
      "seen_before",
    ]);
    expect(body.definition.fields[0].label).toBe("What is wrong?");
    // The condition survives the round trip rather than being dropped on save.
    expect(body.definition.fields[2].visible_when).toEqual({ field: "area", equals: "reporting" });
  });

  it("adds a field with a condition on an earlier choice and posts a new draft when there is none", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["admin:config"]),
      [FORMS]: () => json([aTicketForm({ versions: [aTicketForm().versions[0]] })]),
      [ADD_DRAFT]: () => json({ id: "v-3", version_no: 2 }),
    });
    renderDesk(<TicketFormsPanel accountId={FORM_ACCOUNT_ID} />);
    await screen.findByLabelText("Label of field 1");
    fireEvent.click(screen.getByText("Add field"));
    fireEvent.change(screen.getByLabelText("Label of field 2"), { target: { value: "Anything else?" } });
    fireEvent.change(screen.getByLabelText("Key of field 2"), { target: { value: "anything_else" } });
    // Renaming the key renames the custom answer it is filed under rather
    // than leaving the field writing a key nobody will read.
    expect((screen.getByLabelText("Answer of field 2 goes to") as HTMLSelectElement).value).toBe(
      "custom.anything_else",
    );
    fireEvent.click(screen.getByText("Save draft"));
    await waitFor(() => expect(calls.some((call) => call.key === ADD_DRAFT)).toBe(true));
    const body = calls.find((call) => call.key === ADD_DRAFT)?.body as {
      definition: { fields: { key: string; maps_to: string }[] };
    };
    expect(body.definition.fields.map((field) => field.key)).toEqual(["short_description", "anything_else"]);
    expect(body.definition.fields[1].maps_to).toBe("custom.anything_else");
  });

  it("publishes behind a confirmation that says the version is frozen", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["admin:config"]),
      [FORMS]: () => json([aTicketForm()]),
      [PUBLISH]: () => json(aTicketForm({ current_version_id: DRAFT_VERSION_ID })),
    });
    renderDesk(<TicketFormsPanel accountId={FORM_ACCOUNT_ID} />);
    const publish = await screen.findByText("Publish version 2");
    expect(screen.getAllByText(/Publishing freezes this version/).length).toBeGreaterThan(0);

    fireEvent.click(publish);
    // Armed, not sent: the first click only asks.
    expect(calls.some((call) => call.key === PUBLISH)).toBe(false);
    fireEvent.click(screen.getByText("Publish and freeze"));
    await waitFor(() => expect(calls.some((call) => call.key === PUBLISH)).toBe(true));
  });

  it("will not publish while the draft in hand is unsaved", async () => {
    stubFetch({ "GET /v1/admin/me": me(["admin:config"]), [FORMS]: () => json([aTicketForm()]) });
    renderDesk(<TicketFormsPanel accountId={FORM_ACCOUNT_ID} />);
    await screen.findByLabelText("Label of field 1");
    fireEvent.change(screen.getByLabelText("Label of field 1"), { target: { value: "Changed" } });
    expect(screen.getByText("Publish version 2")).toBeDisabled();
    await screen.findByText(/Save the draft before publishing it/);
  });

  it("creates a form for a type that has none and words the API's refusal", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["admin:config"]),
      [FORMS]: () => json([aTicketForm()]),
      [CREATE]: () => json({ code: "form_already_exists", ticket_type: "change" }, 409),
    });
    renderDesk(<TicketFormsPanel accountId={FORM_ACCOUNT_ID} />);
    await screen.findByLabelText("Request type of the new form");
    // Incident is taken by the active form, so it is not offered again.
    const options = Array.from(
      (screen.getByLabelText("Request type of the new form") as HTMLSelectElement).options,
    ).map((option) => option.value);
    expect(options).toEqual(["service_request", "change"]);

    fireEvent.change(screen.getByLabelText("Request type of the new form"), { target: { value: "change" } });
    fireEvent.click(screen.getByText("New form"));
    await waitFor(() => expect(calls.some((call) => call.key === CREATE)).toBe(true));
    await screen.findByText("This account already has an active form for change.");
  });
});
