import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { disciplineItems, EMPTY_RESOLVE, ResolveForm, toResolutionBody } from "@/components/tickets/resolve-form";

const RESOLVE = ["resolution", "solution_link", "time_logged"];

describe("disciplineItems", () => {
  it("lists every missing item for an empty draft and clears them as the draft fills in", () => {
    expect(disciplineItems(EMPTY_RESOLVE, RESOLVE).map((item) => [item.key, item.done])).toEqual([
      ["resolution_code", false],
      ["notes", false],
      ["solution", false],
      ["time", false],
    ]);
    const full = {
      ...EMPTY_RESOLVE,
      code: "fixed",
      notes: "Rebuilt",
      solutionCandidate: true,
      timeExemptionReason: "Vendor",
    };
    expect(disciplineItems(full, RESOLVE).every((item) => item.done)).toBe(true);
  });

  it("waives the solution link for a no-solution code and the exemption when time is logged", () => {
    const duplicate = { ...EMPTY_RESOLVE, code: "duplicate", notes: "dup of CS0001000" };
    const items = disciplineItems(duplicate, RESOLVE, 30);
    expect(items.find((item) => item.key === "solution")).toMatchObject({
      done: true,
      detail: "waived by the resolution code",
    });
    expect(items.find((item) => item.key === "time")).toMatchObject({ done: true, detail: "30 min logged" });
  });

  it("serialises only the filled fields", () => {
    expect(toResolutionBody({ ...EMPTY_RESOLVE, code: "fixed", notes: " x " })).toEqual({
      code: "fixed",
      notes: "x",
      solution_article_id: undefined,
      solution_candidate: undefined,
      time_exemption_reason: undefined,
    });
  });
});

describe("ResolveForm", () => {
  it("keeps Submit disabled until the checklist is complete, then submits the draft", async () => {
    const onSubmit = vi.fn(async () => undefined);
    render(<ResolveForm requires={RESOLVE} targetLabel="Resolved" onSubmit={onSubmit} onCancel={() => undefined} />);
    const submit = screen.getByRole("button", { name: "Move to Resolved" });
    expect(submit).toBeDisabled();
    expect(screen.getByText("4 items missing before Resolved.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Resolution code"), { target: { value: "fixed" } });
    fireEvent.change(screen.getByLabelText("Resolution notes"), { target: { value: "Rebuilt the cube" } });
    fireEvent.click(screen.getByLabelText("Propose a new article from this ticket"));
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Time exemption reason"), { target: { value: "Fixed by vendor" } });
    expect(screen.getByText("Ready to resolve.")).toBeInTheDocument();
    expect(submit).toBeEnabled();

    fireEvent.click(submit);
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        code: "fixed",
        notes: "Rebuilt the cube",
        solutionCandidate: true,
        solutionArticleId: "",
        timeExemptionReason: "Fixed by vendor",
      }),
    );
  });

  it("shows what the server still needs", () => {
    render(
      <ResolveForm
        requires={RESOLVE}
        targetLabel="Resolved"
        onSubmit={() => undefined}
        onCancel={() => undefined}
        serverMissing={["solution_link"]}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("The server still needs: solution_link.");
  });
});
