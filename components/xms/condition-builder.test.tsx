import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { ConditionBuilder } from "@/components/xms/condition-builder";
import { parseConditions, serializeConditions, type Condition, type ConditionField } from "@/lib/conditions";

const FIELDS: ConditionField[] = [
  {
    key: "state",
    label: "State",
    kind: "enum",
    options: [
      { value: "new", label: "New" },
      { value: "in_progress", label: "In progress" },
    ],
  },
  { key: "short_description", label: "Short description", kind: "text" },
  { key: "updated_at", label: "Updated", kind: "date" },
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

describe("ConditionBuilder", () => {
  it("adds a condition with the first field and its first operator", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("+ Add condition"));
    expect(screen.getAllByLabelText("Field")).toHaveLength(1);
    expect(screen.getByLabelText("Operator")).toHaveValue("is");
    expect(screen.getByTestId("serialized")).toHaveTextContent('[["state","is",""]]');
  });

  it("edits the value and removes the row", () => {
    render(<Harness initial={[{ field: "state", op: "is", value: "" }]} />);
    fireEvent.change(screen.getByLabelText("Value"), { target: { value: "in_progress" } });
    expect(screen.getByTestId("serialized")).toHaveTextContent('[["state","is","in_progress"]]');
    fireEvent.click(screen.getByLabelText("Remove condition"));
    expect(screen.queryByLabelText("Field")).not.toBeInTheDocument();
    expect(screen.getByTestId("serialized")).toHaveTextContent("[]");
  });

  it("changing the field resets the operator to one valid for its kind and hides the value for empty", () => {
    render(<Harness initial={[{ field: "state", op: "is", value: "new" }]} />);
    fireEvent.change(screen.getByLabelText("Field"), { target: { value: "updated_at" } });
    expect(screen.getByLabelText("Operator")).toHaveValue("before");
    expect(screen.getByLabelText("Value")).toHaveAttribute("type", "date");
    fireEvent.change(screen.getByLabelText("Operator"), { target: { value: "empty" } });
    expect(screen.queryByLabelText("Value")).not.toBeInTheDocument();
  });

  it("round-trips a condition set through the serialised form", () => {
    const conditions: Condition[] = [
      { field: "state", op: "in", value: ["new", "in_progress"] },
      { field: "short_description", op: "contains", value: "azure" },
      { field: "updated_at", op: "empty", value: null },
    ];
    const raw = serializeConditions(conditions);
    expect(parseConditions(raw)).toEqual(conditions);
    render(<Harness initial={parseConditions(raw)} />);
    expect(screen.getAllByLabelText("Field")).toHaveLength(3);
    expect(screen.getByTestId("serialized")).toHaveTextContent(raw);
  });

  it("drops malformed entries instead of throwing", () => {
    expect(parseConditions("not json")).toEqual([]);
    expect(parseConditions('[["state","bogus","x"],["state","is","new"],42]')).toEqual([
      { field: "state", op: "is", value: "new" },
    ]);
  });
});
