import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PortalChrome } from "@/components/portal/portal-chrome";
import { SurveyLinkAnswer } from "@/components/portal/survey-link";
import { aQuarterlyAnswer, aSurvey, json, renderPortal, stubFetch } from "@/test-kit/portal";

const survey = aSurvey();
const TOKEN = "tok-1234567890abcdefghijklmnop";
let pathname = `/portal/surveys/${survey.id}`;
let search = `token=${TOKEN}`;

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const LINK = `POST /v1/csat/${survey.id}/answer`;

describe("survey email link", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders the one question without the portal chrome and never asks for the session", async () => {
    pathname = `/portal/surveys/${survey.id}`;
    search = `token=${TOKEN}`;
    const calls = stubFetch({});
    renderPortal(
      <PortalChrome>
        <SurveyLinkAnswer surveyId={survey.id} token={TOKEN} />
      </PortalChrome>,
    );
    expect(screen.getByTestId("portal-bare")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Portal" })).not.toBeInTheDocument();
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(screen.getByText("How satisfied are you with the handling of your request?")).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(calls.some((call) => call.key === "GET /v1/portal/me")).toBe(false);
  });

  it("keeps the chrome on the surveys page without a token", async () => {
    pathname = "/portal/surveys";
    search = "";
    stubFetch({ "GET /v1/portal/me": () => json({ principal: {}, account: null }) });
    renderPortal(
      <PortalChrome>
        <p>inside</p>
      </PortalChrome>,
    );
    const nav = await screen.findByRole("navigation", { name: "Portal" });
    expect(within(nav).getByRole("link", { name: "Surveys" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Surveys" })).toHaveAttribute("href", "/portal/surveys");
  });

  it("posts the token with the score and the comment to the link route and thanks the visitor", async () => {
    pathname = `/portal/surveys/${survey.id}`;
    search = `token=${TOKEN}`;
    const calls = stubFetch({
      [LINK]: () => json({ survey_id: survey.id, score: 5, answered_at: "2026-09-07T10:00:00Z" }, 201),
    });
    renderPortal(<SurveyLinkAnswer surveyId={survey.id} token={TOKEN} />);
    fireEvent.click(screen.getByRole("button", { name: "5, Very satisfied" }));
    fireEvent.change(screen.getByLabelText("Comment (optional)"), { target: { value: "Great" } });
    fireEvent.click(screen.getByRole("button", { name: "Send my answer" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Thank you. Your answer, 5 of 5 (Very satisfied), has been recorded.",
    );
    expect(calls.map((call) => [call.key, call.body])).toEqual([[LINK, { token: TOKEN, score: 5, comment: "Great" }]]);
    expect(screen.queryByRole("button", { name: "Send my answer" })).not.toBeInTheDocument();
  });

  it("words a bad token as not found and a closed survey", async () => {
    stubFetch({ [LINK]: () => json({ code: "not_found", entity: "survey" }, 404) });
    const first = renderPortal(<SurveyLinkAnswer surveyId={survey.id} token="wrong-token-wrong-token" />);
    fireEvent.click(screen.getByRole("button", { name: "3, Neutral" }));
    fireEvent.click(screen.getByRole("button", { name: "Send my answer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This survey link is not valid.");
    first.unmount();
    vi.unstubAllGlobals();
    stubFetch({ [LINK]: () => json({ code: "survey_closed", status: "expired" }, 409) });
    renderPortal(<SurveyLinkAnswer surveyId={survey.id} token={TOKEN} />);
    fireEvent.click(screen.getByRole("button", { name: "3, Neutral" }));
    fireEvent.click(screen.getByRole("button", { name: "Send my answer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This survey has expired and can no longer be answered.",
    );
  });

  /**
   * The link route has no GET behind the token, so the kind arrives with the
   * server's refusal: `scores_required` names the five keys, and the page
   * then asks those five instead of the one.
   */
  it("asks the five quarterly questions the scores_required refusal names, and answers them", async () => {
    pathname = `/portal/surveys/${survey.id}`;
    search = `token=${TOKEN}`;
    let asked = false;
    const calls = stubFetch({
      [LINK]: () => {
        if (asked) return json(aQuarterlyAnswer({ survey_id: survey.id }), 200);
        asked = true;
        return json(
          { code: "scores_required", questions: ["responsiveness", "quality", "communication", "value", "recommend"] },
          400,
        );
      },
    });
    renderPortal(<SurveyLinkAnswer surveyId={survey.id} token={TOKEN} />);
    fireEvent.click(screen.getByRole("button", { name: "4, Satisfied" }));
    fireEvent.click(screen.getByRole("button", { name: "Send my answer" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This is the quarterly relationship survey. It asks five short questions, which are below.",
    );
    const groups = screen.getAllByRole("group");
    expect(groups.map((group) => group.getAttribute("data-question"))).toEqual([
      "responsiveness",
      "quality",
      "communication",
      "value",
      "recommend",
    ]);
    expect(screen.getByText("How responsive were we this quarter?")).toBeInTheDocument();
    // The one answer given against the single question does not carry over.
    expect(screen.getByRole("button", { name: "Send my answer" })).toBeDisabled();

    const answer = (question: string, label: string) =>
      fireEvent.click(within(screen.getByRole("group", { name: question })).getByRole("button", { name: label }));
    answer("How responsive were we this quarter?", "4, Satisfied");
    answer("How would you rate the quality of the work delivered?", "5, Very satisfied");
    answer("How clear and timely was our communication?", "4, Satisfied");
    answer("How well does the service represent value for money?", "3, Neutral");
    answer("How likely are you to recommend us to a colleague?", "5, Very satisfied");
    fireEvent.click(screen.getByRole("button", { name: "Send my answer" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Thank you. Your answers, Responsiveness 4, Quality 5, Communication 4, Value 3, Recommend 5, have been recorded.",
    );
    expect(calls.map((call) => call.body)).toEqual([
      { token: TOKEN, score: 4 },
      {
        token: TOKEN,
        scores: { responsiveness: 4, quality: 5, communication: 4, value: 3, recommend: 5 },
      },
    ]);
  });
});
