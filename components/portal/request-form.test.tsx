import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import * as matchers from "vitest-axe/matchers";
import { RequestForm, validateRequest } from "@/components/portal/request-form";

expect.extend(matchers);

const EMPTY = {
  type: "" as const,
  short_description: "",
  description: "",
  category: "",
  impact: "" as const,
  urgency: "" as const,
};

describe("portal request form", () => {
  it("validates the type and the title", () => {
    expect(validateRequest(EMPTY)).toEqual({
      type: "Choose what kind of request this is.",
      short_description: "Give the request a short title.",
    });
    expect(validateRequest({ ...EMPTY, type: "incident", short_description: "x".repeat(301) })).toEqual({
      short_description: "Keep the title under 300 characters.",
    });
    expect(validateRequest({ ...EMPTY, type: "incident", short_description: "Broken" })).toEqual({});
  });

  it("blocks submission inline and submits the trimmed body once valid", () => {
    const onSubmit = vi.fn();
    render(<RequestForm onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(screen.getByLabelText("Title")).toHaveAttribute("aria-invalid", "true");

    fireEvent.click(screen.getByLabelText(/Something is broken/));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "  Report fails  " } });
    fireEvent.change(screen.getByLabelText("How many people are affected?"), { target: { value: "high" } });
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(onSubmit).toHaveBeenCalledWith({
      type: "incident",
      short_description: "Report fails",
      description: undefined,
      category: undefined,
      impact: "high",
      urgency: undefined,
    });
  });

  it("explains the chosen impact and urgency levels", () => {
    render(<RequestForm onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("How soon do you need this?"), { target: { value: "high" } });
    expect(screen.getByText("Needed today; a deadline depends on it.")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<RequestForm onSubmit={vi.fn()} serverError="The API could not be reached." />);
    expect(await axe(container, { rules: { "color-contrast": { enabled: false } } })).toHaveNoViolations();
  });
});
