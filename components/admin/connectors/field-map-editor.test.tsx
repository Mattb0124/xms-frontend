import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FieldMapEditor, transformFor, unmappedRequired } from "@/components/admin/connectors/field-map-editor";
import { FieldMapTab } from "@/components/admin/connectors/field-map-tab";
import { pickDefaultMap } from "@/components/admin/connectors/map-lifecycle";
import { ValidationReportView } from "@/components/admin/connectors/map-versions";
import { aFieldMap, anInstance } from "@/redux/connectorsApi.test";
import type { FieldMapEntry } from "@/redux/connectorsApi";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/connectors/x" }));

function Harness({
  initial,
  dictionary,
}: {
  initial: FieldMapEntry[];
  dictionary?: { name: string; mandatory?: boolean }[];
}) {
  const [entries, setEntries] = useState(initial);
  return (
    <>
      <FieldMapEditor entries={entries} dictionary={dictionary} onChange={setEntries} />
      <output data-testid="entries">{JSON.stringify(entries)}</output>
    </>
  );
}

function read(): FieldMapEntry[] {
  return JSON.parse(screen.getByTestId("entries").textContent ?? "[]");
}

describe("FieldMapEditor", () => {
  it("calls out required fields until they have an inbound entry", () => {
    expect(unmappedRequired([])).toEqual(["short_description", "requester_email"]);
    expect(unmappedRequired([{ external: "a", xms: "short_description", direction: "out" }])).toEqual([
      "short_description",
      "requester_email",
    ]);
    expect(
      unmappedRequired([
        { external: "a", xms: "short_description", direction: "both" },
        { external: "b", xms: "requester_email", direction: "in" },
      ]),
    ).toEqual([]);
  });

  it("adds and removes entries, picking the external field from the dictionary when loaded", () => {
    render(
      <Harness initial={[]} dictionary={[{ name: "short_description", mandatory: true }, { name: "contact.email" }]} />,
    );
    expect(screen.getByText(/Required XMS fields without an inbound entry/)).toHaveAttribute(
      "data-missing",
      "short_description,requester_email",
    );
    fireEvent.click(screen.getByRole("button", { name: "Add entry" }));
    fireEvent.change(screen.getByLabelText("External field 1"), { target: { value: "short_description" } });
    fireEvent.click(screen.getByRole("button", { name: "Add entry" }));
    fireEvent.change(screen.getByLabelText("External field 2"), { target: { value: "contact.email" } });
    fireEvent.change(screen.getByLabelText("Direction 2"), { target: { value: "both" } });
    expect(read()).toEqual([
      { external: "short_description", xms: "short_description", direction: "in" },
      { external: "contact.email", xms: "requester_email", direction: "both" },
    ]);
    expect(screen.queryByText(/Required XMS fields without an inbound entry/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove entry 1" }));
    expect(read()).toEqual([{ external: "contact.email", xms: "requester_email", direction: "both" }]);
    expect(screen.getByText(/Required XMS fields without an inbound entry/)).toHaveAttribute(
      "data-missing",
      "short_description",
    );
  });

  it("edits the transform parameters per kind and the system of record", () => {
    render(<Harness initial={[{ external: "priority", xms: "urgency", direction: "in" }]} />);
    fireEvent.change(screen.getByLabelText("Transform 1"), { target: { value: "lookup" } });
    fireEvent.click(screen.getByRole("button", { name: "Add row" }));
    fireEvent.change(screen.getByLabelText("Lookup 1 External value 1"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Lookup 1 XMS value 1"), { target: { value: "high" } });
    fireEvent.change(screen.getByLabelText("Lookup fallback 1"), { target: { value: "medium" } });
    expect(read()[0].transform).toEqual({ kind: "lookup", values: { "1": "high" }, fallback: "medium" });

    fireEvent.change(screen.getByLabelText("Transform 1"), { target: { value: "truncate" } });
    fireEvent.change(screen.getByLabelText("Truncate length 1"), { target: { value: "120" } });
    expect(read()[0].transform).toEqual({ kind: "truncate", length: 120 });

    fireEvent.change(screen.getByLabelText("Transform 1"), { target: { value: "template" } });
    fireEvent.change(screen.getByLabelText("Template 1"), { target: { value: "{{number}}: {{short_description}}" } });
    expect(read()[0].transform).toEqual({ kind: "template", template: "{{number}}: {{short_description}}" });

    fireEvent.change(screen.getByLabelText("Transform 1"), { target: { value: "none" } });
    expect(read()[0].transform).toBeUndefined();

    fireEvent.change(screen.getByLabelText("System of record 1"), { target: { value: "xms" } });
    expect(read()[0].sor).toBe("xms");
    fireEvent.change(screen.getByLabelText("System of record 1"), { target: { value: "" } });
    expect(read()[0].sor).toBeUndefined();
    expect(transformFor("lookup", { kind: "lookup", values: { a: "b" } })).toEqual({
      kind: "lookup",
      values: { a: "b" },
    });
  });

  it("renders the validation report with problems in red and warnings in amber", () => {
    render(
      <ValidationReportView
        report={{
          ok: false,
          problems: ["required field requester_email has no inbound entry"],
          warnings: ["sample without contact.email"],
          checked_samples: 5,
        }}
      />,
    );
    expect(screen.getByText("1 problem, checked 5 samples")).toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "Problems" })).getByText(
        "required field requester_email has no inbound entry",
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "Warnings" })).getByText("sample without contact.email"),
    ).toBeInTheDocument();
    expect(screen.getByText("1 problem, checked 5 samples").parentElement).toHaveAttribute("data-report-ok", "false");
  });
});

describe("FieldMapTab", () => {
  afterEach(() => vi.unstubAllGlobals());
  const instance = anInstance({ active_field_map_id: null });
  const ID = instance.id;

  it("selects the newest editable version by default and offers Activate only once validated", async () => {
    const draft = aFieldMap({ id: "22222222-2222-4222-8222-222222222221", version: 2, state: "draft" });
    const validated = aFieldMap({
      id: "22222222-2222-4222-8222-222222222222",
      version: 1,
      state: "validated",
      validation_report: { ok: true, problems: [], warnings: [], checked_samples: 5 },
    });
    expect(pickDefaultMap([validated, draft])?.version).toBe(2);
    const calls = stubFetch({
      [`GET /v1/connectors/${ID}/field-maps`]: () => json([validated, draft]),
      [`POST /v1/connectors/${ID}/field-maps/${validated.id}/activate`]: () => json({ ...validated, state: "active" }),
    });
    renderDesk(<FieldMapTab instance={instance} />);
    await screen.findByText("Field map v2");
    expect(screen.getByRole("button", { name: "Activate" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /^v1/ }));
    await screen.findByText("Field map v1");
    expect(screen.getByText("Valid, checked 5 samples")).toBeInTheDocument();
    const activate = screen.getByRole("button", { name: "Activate" });
    expect(activate).toBeEnabled();
    fireEvent.click(activate);
    await waitFor(() =>
      expect(calls.some((call) => call.key === `POST /v1/connectors/${ID}/field-maps/${validated.id}/activate`)).toBe(
        true,
      ),
    );
    await screen.findByText("Activated");
  });

  it("saves the edited draft, loads samples onto it and shows the validation problems inline", async () => {
    const draft = aFieldMap({
      state: "draft",
      entries: [{ external: "short_description", xms: "short_description", direction: "in" }],
    });
    let current = draft;
    const calls = stubFetch({
      [`GET /v1/connectors/${ID}/field-maps`]: () => json([current]),
      [`PUT /v1/connectors/${ID}/field-maps/${draft.id}`]: (body) => {
        current = { ...draft, entries: JSON.parse(body!).entries };
        return json(current);
      },
      [`POST /v1/connectors/${ID}/samples`]: () =>
        json({
          records: [{ short_description: "Printer down", contact: { display_value: "pat@client.test" } }],
          dictionary: [{ name: "short_description", mandatory: true }, { name: "contact" }],
        }),
      [`POST /v1/connectors/${ID}/field-maps/${draft.id}/validate`]: () =>
        json({
          ok: false,
          problems: ["required field requester_email has no inbound entry"],
          warnings: [],
          checked_samples: 1,
        }),
    });
    renderDesk(<FieldMapTab instance={instance} />);
    await screen.findByText("Field map v1");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Load samples" }));
    await waitFor(() =>
      expect(calls.find((call) => call.key === `POST /v1/connectors/${ID}/samples`)?.body).toEqual({
        map_id: draft.id,
      }),
    );
    await screen.findByText("Printer down");
    fireEvent.change(await screen.findByLabelText("Direction 1"), { target: { value: "both" } });
    expect(screen.getByRole("button", { name: "Validate" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(calls.find((call) => call.key === `PUT /v1/connectors/${ID}/field-maps/${draft.id}`)?.body).toEqual({
        entries: [{ external: "short_description", xms: "short_description", direction: "both" }],
      }),
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Validate" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Validate" }));
    await screen.findByText("required field requester_email has no inbound entry");
    expect(screen.getByRole("button", { name: "Activate" })).toBeDisabled();
  });
});
