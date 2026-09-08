import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecordForm, readOnlyText } from "@/components/xms/record-form";
import { Toaster, ToastProvider, useToast } from "@/components/xms/toast";

describe("RecordForm", () => {
  const fields = [
    { key: "category", label: "Category", value: "HFM" },
    {
      key: "impact",
      label: "Impact",
      value: "high",
      kind: "select" as const,
      options: [
        { value: "high", label: "High" },
        { value: "low", label: "Low" },
      ],
    },
  ];

  it("commits on blur and keeps the new value on success", async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    render(<RecordForm fields={fields} onCommit={onCommit} />);
    const input = screen.getByLabelText("Category");
    fireEvent.change(input, { target: { value: "Azure" } });
    fireEvent.blur(input);
    await waitFor(() => expect(onCommit).toHaveBeenCalledWith("category", "Azure"));
    expect(input).toHaveValue("Azure");
  });

  it("does not commit an unchanged value", () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    render(<RecordForm fields={fields} onCommit={onCommit} />);
    fireEvent.blur(screen.getByLabelText("Category"));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("rolls back and reports when the commit is rejected", async () => {
    const onCommit = vi.fn().mockRejectedValue(new Error("409 stale_version"));
    const onRollback = vi.fn();
    render(<RecordForm fields={fields} onCommit={onCommit} onRollback={onRollback} />);
    const select = screen.getByLabelText("Impact");
    await act(async () => {
      fireEvent.change(select, { target: { value: "low" } });
    });
    await waitFor(() => expect(onRollback).toHaveBeenCalledWith("impact", "high", expect.any(Error)));
    expect(select).toHaveValue("high");
  });
});

/**
 * Review finding 9: read-only values rendered in input-shaped boxes, so they
 * looked editable, and every long one was clipped with no ellipsis and no
 * tooltip ("AUS - Austral M", "Pat Client <pat.", "Service requ").
 */
describe("RecordForm read-only values", () => {
  const readOnly = [
    { key: "account", label: "Account", value: "AUS - Austral Mining Corporation", readOnly: true },
    {
      key: "type",
      label: "Type",
      value: "service_request",
      kind: "select" as const,
      options: [
        { value: "incident", label: "Incident" },
        { value: "service_request", label: "Request" },
      ],
      readOnly: true,
    },
    { key: "closed_at", label: "Closed", value: "", readOnly: true, mono: true },
  ];

  it("words a read-only select by its option label and an empty one as Not set", () => {
    expect(readOnlyText(readOnly[0])).toBe("AUS - Austral Mining Corporation");
    expect(readOnlyText(readOnly[1])).toBe("Request");
    expect(readOnlyText({ key: "x", label: "X", value: "unknown", kind: "select", options: [] })).toBe("unknown");
  });

  it("renders read-only fields as wrapping text with a tooltip, not as form controls", () => {
    const { container } = render(<RecordForm columns={1} fields={readOnly} onCommit={vi.fn()} />);
    expect(container.querySelectorAll("input, select, textarea")).toHaveLength(0);

    const account = container.querySelector('[data-field="account"] [data-readonly-value]');
    expect(account).toHaveTextContent("AUS - Austral Mining Corporation");
    // The whole value is reachable on hover and nothing forces one line.
    expect(account).toHaveAttribute("title", "AUS - Austral Mining Corporation");
    expect(account?.className).toContain("break-words");
    expect(account?.className).not.toContain("truncate");

    expect(container.querySelector('[data-field="type"] [data-readonly-value]')).toHaveTextContent("Request");
    expect(container.querySelector('[data-field="closed_at"] [data-readonly-value]')).toHaveTextContent("Not set");
  });

  it("keeps an editable field a control and carries its hint under it", () => {
    render(
      <RecordForm
        columns={1}
        fields={[{ key: "priority", label: "Priority", value: "P2", hint: "Derived from the matrix" }]}
        onCommit={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Priority")).toHaveValue("P2");
    expect(screen.getByText("Derived from the matrix")).toBeInTheDocument();
  });
});

function Pusher() {
  const { push } = useToast();
  return (
    <button
      type="button"
      onClick={() => push({ title: "Reverted", detail: "Someone else changed this record", tone: "error" })}
    >
      push
    </button>
  );
}

describe("Toast", () => {
  it("shows a pushed toast and dismisses it", () => {
    render(
      <ToastProvider ttlMs={0}>
        <Pusher />
        <Toaster />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText("push"));
    expect(screen.getByRole("status")).toHaveAttribute("data-tone", "error");
    expect(screen.getByText("Reverted")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Dismiss"));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
