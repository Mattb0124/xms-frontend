import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecordForm } from "@/components/xms/record-form";
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
