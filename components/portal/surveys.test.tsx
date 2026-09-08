import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SurveysPage } from "@/components/portal/surveys";
import { anAnsweredSurvey, aSurvey, json, renderPortal, stubFetch } from "@/test-kit/portal";

vi.mock("next/navigation", () => ({
  usePathname: () => "/portal/surveys",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const survey = aSurvey();
const ANSWER = `POST /v1/portal/surveys/${survey.id}/answer`;

describe("portal surveys page", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows a pending survey as a card with the key, the description and the five labelled buttons, and the completed ones with their score", async () => {
    stubFetch({ "GET /v1/portal/surveys": () => json({ pending: [survey], answered: [anAnsweredSurvey()] }) });
    renderPortal(<SurveysPage />);
    const card = await screen.findByRole("region", { name: "CS0001001" });
    expect(card).toHaveTextContent("Cannot open the consolidation report");
    expect(card).toHaveTextContent("Open until 2026-09-15");
    expect(within(card).getByText("How satisfied are you with the handling of CS0001001?")).toBeInTheDocument();
    const group = within(card).getByRole("group", { name: "Score" });
    expect(
      within(group)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["1, Very dissatisfied", "2, Dissatisfied", "3, Neutral", "4, Satisfied", "5, Very satisfied"]);
    expect(within(card).getByRole("button", { name: "Send my answer" })).toBeDisabled();
    const completed = screen.getByRole("list", { name: "Completed surveys" });
    const row = within(completed).getByRole("listitem");
    expect(within(row).getByRole("link", { name: "CS0000990" })).toHaveAttribute("href", "/portal/requests/CS0000990");
    expect(row).toHaveTextContent("4 of 5, Satisfied");
    expect(row).toHaveTextContent("2026-08-29");
    expect(screen.queryByText("No surveys pending.")).not.toBeInTheDocument();
  });

  it("posts the score and the comment, then reads the list again and thanks the client", async () => {
    let answered = false;
    const calls = stubFetch({
      "GET /v1/portal/surveys": () =>
        json(
          answered
            ? { pending: [], answered: [aSurvey({ status: "answered", score: 4 })] }
            : { pending: [survey], answered: [] },
        ),
      [ANSWER]: () => {
        answered = true;
        return json({ survey_id: survey.id, score: 4, answered_at: "2026-09-07T10:00:00Z" }, 201);
      },
    });
    renderPortal(<SurveysPage />);
    const card = await screen.findByRole("region", { name: "CS0001001" });
    fireEvent.click(within(card).getByRole("button", { name: "4, Satisfied" }));
    expect(within(card).getByRole("button", { name: "4, Satisfied" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(within(card).getByLabelText("Comment (optional)"), { target: { value: "  Quick and clear  " } });
    fireEvent.click(within(card).getByRole("button", { name: "Send my answer" }));
    await screen.findByText("Thank you. Your answer for CS0001001 has been recorded.");
    expect(calls.find((call) => call.key === ANSWER)?.body).toEqual({ score: 4, comment: "Quick and clear" });
    await waitFor(() => expect(screen.getByText("No surveys pending.")).toBeInTheDocument());
    expect(screen.getByRole("list", { name: "Completed surveys" })).toHaveTextContent("4 of 5, Satisfied");
  });

  it("sends only the score without a comment and words already_answered", async () => {
    const calls = stubFetch({
      "GET /v1/portal/surveys": () => json({ pending: [survey], answered: [] }),
      [ANSWER]: () => json({ code: "already_answered" }, 409),
    });
    renderPortal(<SurveysPage />);
    const card = await screen.findByRole("region", { name: "CS0001001" });
    fireEvent.click(within(card).getByRole("button", { name: "2, Dissatisfied" }));
    fireEvent.click(within(card).getByRole("button", { name: "Send my answer" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("You have already answered this survey. Thank you.");
    expect(calls.find((call) => call.key === ANSWER)?.body).toEqual({ score: 2 });
    // The refusal means the list is behind: it is read again.
    await waitFor(() => expect(calls.filter((call) => call.key === "GET /v1/portal/surveys").length).toBe(2));
  });

  it("words survey_closed with the expired status", async () => {
    stubFetch({
      "GET /v1/portal/surveys": () => json({ pending: [survey], answered: [] }),
      [ANSWER]: () => json({ code: "survey_closed", status: "expired" }, 409),
    });
    renderPortal(<SurveysPage />);
    const card = await screen.findByRole("region", { name: "CS0001001" });
    fireEvent.click(within(card).getByRole("button", { name: "5, Very satisfied" }));
    fireEvent.click(within(card).getByRole("button", { name: "Send my answer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This survey has expired and can no longer be answered.",
    );
  });

  it("shows the empty state when nothing is pending", async () => {
    stubFetch({ "GET /v1/portal/surveys": () => json({ pending: [], answered: [] }) });
    renderPortal(<SurveysPage />);
    expect(await screen.findByRole("status")).toHaveTextContent("No surveys pending.");
    expect(screen.getByText("No completed surveys yet.")).toBeInTheDocument();
  });

  it("puts the survey a link named first, or explains that it was already answered", async () => {
    const other = aSurvey({ id: "55555555-5555-4555-8555-555555555555", ticket_key: "CS0001002" });
    stubFetch({ "GET /v1/portal/surveys": () => json({ pending: [other, survey], answered: [anAnsweredSurvey()] }) });
    const first = renderPortal(<SurveysPage focusId={survey.id} />);
    await screen.findByRole("region", { name: "CS0001001" });
    const cards = screen.getAllByRole("region", { name: /CS000100/ });
    expect(cards[0]).toHaveAttribute("aria-label", "CS0001001");
    first.unmount();
    renderPortal(<SurveysPage focusId={anAnsweredSurvey().id} />);
    expect(
      await screen.findByText("You have already answered the survey for CS0000990. Thank you."),
    ).toBeInTheDocument();
  });
});
