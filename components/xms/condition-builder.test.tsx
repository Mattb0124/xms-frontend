import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { ConditionBuilder } from "@/components/xms/condition-builder";
import {
  isComplete,
  parseConditions,
  serializeConditions,
  type Condition,
  type ConditionField,
} from "@/lib/conditions";

const FIELDS: ConditionField[] = [
  { key: "short_description", label: "Short description", kind: "text" },
  {
    key: "state",
    label: "State",
    kind: "enum",
    options: [
      { value: "new", label: "New" },
      { value: "in_progress", label: "In progress" },
    ],
  },
  { key: "updated_at", label: "Updated", kind: "timestamp" },
];

function Harness({ initial = [] }: { initial?: Condition[] }) {
  const [value, setValue] = useState<Condition[]>(initial);
  return (
    <>
      <ConditionBuilder fields={FIELDS} value={value} onChange={setValue} />
      <output data-testid="serialized">{serializeConditions(value)}</output>
    </>
  );
}

/**
 * The reviewer's own reference for the builder
 * (`01-architecture/wireframes/v3/refs/filter-builder.png`): a "WHERE" label,
 * rows of field, operator and value with a cross to remove one, and
 * "Add condition" and "Clear conditions" underneath. The operators are the
 * server's own (`src/modules/tickets/conditions.ts`), not a second vocabulary.
 */
describe("ConditionBuilder", () => {
  it("opens on one empty row, and adds another on the first field and its first operator", () => {
    render(<Harness />);
    expect(screen.getByText("Where")).toBeInTheDocument();
    // The reference opens on a row waiting to be filled in, not on a link
    // that has to be found first. The row is unfinished, so nothing is sent.
    expect(screen.getAllByLabelText("Field")).toHaveLength(1);
    // Text fields open on "contains", which is what a consultant reaches for.
    expect(screen.getByLabelText("Operator")).toHaveValue("contains");
    expect(screen.getByTestId("serialized")).toHaveTextContent("[]");

    fireEvent.click(screen.getByText("+ Add condition"));
    expect(screen.getAllByLabelText("Field")).toHaveLength(2);
    expect(screen.getByTestId("serialized")).toHaveTextContent(
      '[["short_description","contains",""],["short_description","contains",""]]',
    );
  });

  it("edits the value and removes the row", () => {
    render(<Harness initial={[{ field: "state", op: "eq", value: "" }]} />);
    fireEvent.change(screen.getByLabelText("Value"), { target: { value: "in_progress" } });
    expect(screen.getByTestId("serialized")).toHaveTextContent('[["state","eq","in_progress"]]');
    fireEvent.click(screen.getByLabelText("Remove condition"));
    // The set is empty, and the builder falls back to its one empty row.
    expect(screen.getByTestId("serialized")).toHaveTextContent("[]");
    expect(screen.getAllByLabelText("Field")).toHaveLength(1);
    expect(screen.getByLabelText("Field")).toHaveValue("short_description");
  });

  it("clears every condition at once and keeps both links standing", () => {
    render(
      <Harness
        initial={[
          { field: "state", op: "eq", value: "new" },
          { field: "short_description", op: "contains", value: "sap" },
        ]}
      />,
    );
    expect(screen.getAllByLabelText("Field")).toHaveLength(2);
    fireEvent.click(screen.getByText("Clear conditions"));
    expect(screen.getByTestId("serialized")).toHaveTextContent("[]");
    expect(screen.getAllByLabelText("Field")).toHaveLength(1);
    // Both links sit under the rows and neither comes and goes.
    expect(screen.getByText("+ Add condition")).toBeInTheDocument();
    expect(screen.getByText("Clear conditions")).toBeInTheDocument();
  });

  it("changing the field resets the operator to one valid for its kind and drops the value control", () => {
    render(<Harness initial={[{ field: "state", op: "eq", value: "new" }]} />);
    fireEvent.change(screen.getByLabelText("Field"), { target: { value: "updated_at" } });
    expect(screen.getByLabelText("Operator")).toHaveValue("before");
    expect(screen.getByLabelText("Value")).toHaveAttribute("type", "date");
    fireEvent.change(screen.getByLabelText("Operator"), { target: { value: "is_null" } });
    expect(screen.queryByLabelText("Value")).not.toBeInTheDocument();
  });

  it("draws an enum value as a picker of the field's own options", () => {
    render(<Harness initial={[{ field: "state", op: "eq", value: "" }]} />);
    const value = screen.getByLabelText("Value");
    expect(value.tagName).toBe("SELECT");
    expect(screen.getByRole("option", { name: "In progress" })).toBeInTheDocument();
    // The empty option reads as the placeholder the reference draws.
    expect(screen.getByRole("option", { name: "Value" })).toBeInTheDocument();
  });

  it("round-trips a condition set through the serialised form", () => {
    const conditions: Condition[] = [
      { field: "state", op: "in", value: ["new", "in_progress"] },
      { field: "short_description", op: "contains", value: "azure" },
      { field: "updated_at", op: "is_null", value: null },
    ];
    const raw = serializeConditions(conditions);
    expect(parseConditions(raw)).toEqual(conditions);
    render(<Harness initial={parseConditions(raw)} />);
    expect(screen.getAllByLabelText("Field")).toHaveLength(3);
    expect(screen.getByTestId("serialized")).toHaveTextContent(raw);
  });

  it("drops malformed entries instead of throwing", () => {
    expect(parseConditions("not json")).toEqual([]);
    expect(parseConditions('[["state","bogus","x"],["state","eq","new"],42]')).toEqual([
      { field: "state", op: "eq", value: "new" },
    ]);
  });

  it("counts a row without its value as unfinished, so it is not sent", () => {
    expect(isComplete({ field: "state", op: "eq", value: "" })).toBe(false);
    expect(isComplete({ field: "state", op: "eq", value: "new" })).toBe(true);
    expect(isComplete({ field: "state", op: "in", value: [] })).toBe(false);
    expect(isComplete({ field: "updated_at", op: "is_null", value: null })).toBe(true);
    expect(isComplete({ field: "assignee_id", op: "is_me", value: null })).toBe(true);
  });
});
