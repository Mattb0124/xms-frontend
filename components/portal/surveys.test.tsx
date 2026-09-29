import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SurveysPage } from "@/components/portal/surveys";
import { anAnsweredSurvey, aQuarterlySurvey, aSurvey, json, renderPortal, stubFetch } from "@/test-kit/portal";

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
    // The question is the group's own name, so a reader entering the buttons
    // hears which question they answer even with five on the card.
    const group = within(card).getByRole("group", {
      name: "How satisfied are you with the handling of CS0001001?",
    });
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

/**
 * The quarterly relationship survey (functional 5.7): the same list, the
 * same card, five keyed questions instead of one, named by the quarter
 * rather than by a ticket, and answered with `scores`.
 */
describe("the quarterly relationship survey on the portal", () => {
  const quarterly = aQuarterlySurvey();
  const QUARTERLY_ANSWER = `POST /v1/portal/surveys/${quarterly.id}/answer`;

  afterEach(() => vi.unstubAllGlobals());

  it("lists both kinds, naming the quarter on the quarterly card and asking its five questions", async () => {
    stubFetch({ "GET /v1/portal/surveys": () => json({ pending: [survey, quarterly], answered: [] }) });
    renderPortal(<SurveysPage />);
    const card = await screen.findByRole("region", { name: "2026 Q2 relationship survey" });
    expect(card).toHaveTextContent("Five short questions about how the service went");
    expect(card).toHaveTextContent("Open until 2026-07-22");
    expect(
      within(card)
        .getAllByRole("group")
        .map((group) => group.getAttribute("data-question")),
    ).toEqual(["responsiveness", "quality", "communication", "value", "recommend"]);
    expect(within(card).getByText("How responsive were we this quarter?")).toBeInTheDocument();
    expect(within(card).getByText("How likely are you to recommend us to a colleague?")).toBeInTheDocument();
    // The ticket-close card is still there, still asking its one question.
    const close = screen.getByRole("region", { name: "CS0001001" });
    expect(within(close).getAllByRole("group")).toHaveLength(1);
  });

  it("keeps Send disabled until all five are answered, then posts them as scores", async () => {
    let answered = false;
    const calls = stubFetch({
      "GET /v1/portal/surveys": () =>
        json(
          answered
            ? {
                pending: [],
                answered: [
                  aQuarterlySurvey({
                    status: "answered",
                    answered_at: "2026-07-03T09:15:00Z",
                    answers: { responsiveness: 4, quality: 5, communication: 4, value: 3, recommend: 5 },
                  }),
                ],
              }
            : { pending: [quarterly], answered: [] },
        ),
      [QUARTERLY_ANSWER]: () => {
        answered = true;
        return json(
          {
            survey_id: quarterly.id,
            kind: "quarterly",
            period: "2026-Q2",
            answers: { responsiveness: 4, quality: 5, communication: 4, value: 3, recommend: 5 },
            score: 4.2,
            answered_at: "2026-07-03T09:15:00Z",
          },
          200,
        );
      },
    });
    renderPortal(<SurveysPage />);
    const card = await screen.findByRole("region", { name: "2026 Q2 relationship survey" });
    const answer = (question: string, label: string) =>
      fireEvent.click(within(within(card).getByRole("group", { name: question })).getByRole("button", { name: label }));

    answer("How responsive were we this quarter?", "4, Satisfied");
    // Four of five answered is not an answer the server would take.
    expect(within(card).getByRole("button", { name: "Send my answer" })).toBeDisabled();
    answer("How would you rate the quality of the work delivered?", "5, Very satisfied");
    answer("How clear and timely was our communication?", "4, Satisfied");
    answer("How well does the service represent value for money?", "3, Neutral");
    expect(within(card).getByRole("button", { name: "Send my answer" })).toBeDisabled();
    answer("How likely are you to recommend us to a colleague?", "5, Very satisfied");
    fireEvent.change(within(card).getByLabelText("Comment (optional)"), { target: { value: "More of the same" } });
    fireEvent.click(within(card).getByRole("button", { name: "Send my answer" }));

    await screen.findByText("Thank you. Your answer for 2026 Q2 relationship survey has been recorded.");
    expect(calls.find((call) => call.key === QUARTERLY_ANSWER)?.body).toEqual({
      scores: { responsiveness: 4, quality: 5, communication: 4, value: 3, recommend: 5 },
      comment: "More of the same",
    });
    await waitFor(() =>
      expect(screen.getByRole("list", { name: "Completed surveys" })).toHaveTextContent(
        "Responsiveness 4, Quality 5, Communication 4, Value 3, Recommend 5",
      ),
    );
    // No ticket to link to, so the row names the quarter instead.
    const row = within(screen.getByRole("list", { name: "Completed surveys" })).getByRole("listitem");
    expect(row).toHaveTextContent("2026 Q2 relationship survey");
    expect(within(row).queryByRole("link")).not.toBeInTheDocument();
  });
});
