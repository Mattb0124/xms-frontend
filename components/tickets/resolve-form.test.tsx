import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderDesk, stubFetch } from "@/test-kit/desk";
import {
  DEFAULT_MIN_NOTES_CHARS,
  disciplineItems,
  EMPTY_RESOLVE,
  ResolveForm,
  toResolutionBody,
} from "@/components/tickets/resolve-form";

const RESOLVE = ["resolution", "solution_link", "time_logged"];
/** A note that clears the default bar, so a test about something else is about that. */
const NOTES = "Rebuilt the consolidation cube and reran the close.";

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
      notes: NOTES,
      solutionCandidate: true,
      timeExemptionReason: "merged",
    };
    expect(disciplineItems(full, RESOLVE).every((item) => item.done)).toBe(true);
  });

  it("waives the solution link for a no-solution code and the exemption when time is logged", () => {
    const duplicate = { ...EMPTY_RESOLVE, code: "duplicate", notes: NOTES };
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
  afterEach(() => vi.unstubAllGlobals());

  it("keeps Submit disabled until the checklist is complete, then submits the draft", async () => {
    stubFetch({});
    const onSubmit = vi.fn(async () => undefined);
    renderDesk(
      <ResolveForm requires={RESOLVE} targetLabel="Resolved" onSubmit={onSubmit} onCancel={() => undefined} />,
    );
    const submit = screen.getByRole("button", { name: "Move to Resolved" });
    expect(submit).toBeDisabled();
    expect(screen.getByText("4 items missing before Resolved.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Resolution code"), { target: { value: "fixed" } });
    fireEvent.change(screen.getByLabelText("Resolution notes"), { target: { value: NOTES } });
    fireEvent.click(screen.getByLabelText("Propose a new article from this ticket"));
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Time exemption reason"), { target: { value: "merged" } });
    expect(screen.getByText("Ready to resolve.")).toBeInTheDocument();
    expect(submit).toBeEnabled();

    fireEvent.click(submit);
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        code: "fixed",
        notes: NOTES,
        solutionCandidate: true,
        solutionArticleId: "",
        timeExemptionReason: "merged",
      }),
    );
  });

  it("shows what the server still needs", () => {
    stubFetch({});
    renderDesk(
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

/**
 * TB-02 under revision 3: the two boxes that used to take any character. The
 * form mirrors the server so Submit is not offered for something the gate
 * will refuse; the server still decides.
 */
describe("the composite gate", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("counts the resolution note against the bar and says how far short it is", () => {
    const short = { ...EMPTY_RESOLVE, code: "fixed", notes: "Fixed" };
    expect(disciplineItems(short, RESOLVE).find((item) => item.key === "notes")).toMatchObject({
      done: false,
      detail: `5 of ${DEFAULT_MIN_NOTES_CHARS} characters`,
    });
    expect(disciplineItems({ ...short, notes: NOTES }, RESOLVE).find((item) => item.key === "notes")).toMatchObject({
      done: true,
    });
  });

  it("follows the account's own bar", () => {
    const short = { ...EMPTY_RESOLVE, code: "fixed", notes: "Fixed" };
    expect(disciplineItems(short, RESOLVE, 0, undefined, 5).find((item) => item.key === "notes")?.done).toBe(true);
  });

  it("offers the exemption reasons the account accepts, not a free-text box", () => {
    stubFetch({});
    renderDesk(
      <ResolveForm
        requires={RESOLVE}
        targetLabel="Resolved"
        onSubmit={() => undefined}
        onCancel={() => undefined}
        exemptionReasons={[{ key: "goodwill", label: "Written off as goodwill" }]}
      />,
    );
    const picker = screen.getByLabelText("Time exemption reason");
    expect(picker.tagName).toBe("SELECT");
    expect([...picker.querySelectorAll("option")].map((option) => option.textContent)).toEqual([
      "Choose a reason",
      "Written off as goodwill",
    ]);
  });

  it("offers the built-in five when the account's list could not be read", () => {
    stubFetch({});
    renderDesk(
      <ResolveForm requires={RESOLVE} targetLabel="Resolved" onSubmit={() => undefined} onCancel={() => undefined} />,
    );
    const picker = screen.getByLabelText("Time exemption reason");
    expect(picker.querySelectorAll("option")).toHaveLength(6);
  });

  it("asks for no exemption at all once time is logged", () => {
    stubFetch({});
    renderDesk(
      <ResolveForm
        requires={RESOLVE}
        targetLabel="Resolved"
        loggedMinutes={45}
        onSubmit={() => undefined}
        onCancel={() => undefined}
      />,
    );
    expect(screen.queryByLabelText("Time exemption reason")).not.toBeInTheDocument();
  });
});
