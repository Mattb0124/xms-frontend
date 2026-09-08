import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PortalChrome } from "@/components/portal/portal-chrome";
import { SurveyLinkAnswer } from "@/components/portal/survey-link";
import {
  aQuarterlyAnswer,
  aQuarterlyDescription,
  aSurvey,
  aSurveyDescription,
  json,
  renderPortal,
  stubFetch,
} from "@/test-kit/portal";

const survey = aSurvey();
const TOKEN = "tok-1234567890abcdefghijklmnop";
let pathname = `/portal/surveys/${survey.id}`;
let search = `token=${TOKEN}`;

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const DESCRIBE = `POST /v1/csat/${survey.id}/describe`;
const LINK = `POST /v1/csat/${survey.id}/answer`;

describe("survey email link", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads the survey behind the token and asks the question the server named, with no chrome and no session", async () => {
    pathname = `/portal/surveys/${survey.id}`;
    search = `token=${TOKEN}`;
    const calls = stubFetch({ [DESCRIBE]: () => json(aSurveyDescription()) });
    renderPortal(
      <PortalChrome>
        <SurveyLinkAnswer surveyId={survey.id} token={TOKEN} />
      </PortalChrome>,
    );
    expect(screen.getByTestId("portal-bare")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Portal" })).not.toBeInTheDocument();
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    // The ticket is named because describe carried its key.
    expect(await screen.findByText("How satisfied are you with the handling of CS0001001?")).toBeInTheDocument();
    expect(screen.getByText(/Open until 2026-09-15\./)).toBeInTheDocument();
    // The token travels in the body, never in the address.
    expect(calls.map((call) => [call.key, call.body])).toEqual([[DESCRIBE, { token: TOKEN }]]);
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
      [DESCRIBE]: () => json(aSurveyDescription()),
      [LINK]: () => json({ survey_id: survey.id, score: 5, answered_at: "2026-09-07T10:00:00Z" }, 201),
    });
    renderPortal(<SurveyLinkAnswer surveyId={survey.id} token={TOKEN} />);
    fireEvent.click(await screen.findByRole("button", { name: "5, Very satisfied" }));
    fireEvent.change(screen.getByLabelText("Comment (optional)"), { target: { value: "Great" } });
    fireEvent.click(screen.getByRole("button", { name: "Send my answer" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Thank you. Your answer, 5 of 5 (Very satisfied), has been recorded.",
    );
    expect(calls.map((call) => [call.key, call.body])).toEqual([
      [DESCRIBE, { token: TOKEN }],
      [LINK, { token: TOKEN, score: 5, comment: "Great" }],
    ]);
    expect(screen.queryByRole("button", { name: "Send my answer" })).not.toBeInTheDocument();
  });

  /**
   * An unknown id and a token that does not match answer the same 404
   * (backend test/csat.int-spec.ts), so the page says the same one thing
   * back and never offers a form it could not send.
   */
  it("words a link that does not resolve as one state, with nothing to answer", async () => {
    stubFetch({ [DESCRIBE]: () => json({ code: "not_found", entity: "survey" }, 404) });
    renderPortal(<SurveyLinkAnswer surveyId={survey.id} token="wrong-token-wrong-token" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This link is not valid. Open the most recent email we sent you, or ask us for a new link.",
    );
    expect(screen.queryByRole("button", { name: "Send my answer" })).not.toBeInTheDocument();
  });

  it("shows an answered survey and an expired one as their status, without a form", async () => {
    const answered = stubFetch({ [DESCRIBE]: () => json(aSurveyDescription({ status: "answered" })) });
    const first = renderPortal(<SurveyLinkAnswer surveyId={survey.id} token={TOKEN} />);
    expect(await screen.findByRole("status")).toHaveTextContent("This survey has already been answered. Thank you.");
    expect(screen.queryByRole("button", { name: "Send my answer" })).not.toBeInTheDocument();
    // Nothing is posted to the answer route for a survey that is closed.
    expect(answered.every((call) => call.key === DESCRIBE)).toBe(true);
    first.unmount();
    vi.unstubAllGlobals();

    stubFetch({ [DESCRIBE]: () => json(aSurveyDescription({ status: "expired" })) });
    renderPortal(<SurveyLinkAnswer surveyId={survey.id} token={TOKEN} />);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "This survey has expired and can no longer be answered.",
    );
    expect(screen.queryByText(/Open until/)).not.toBeInTheDocument();
  });

  /**
   * The kind comes from the read now, not from a refusal: a quarterly survey
   * opens on its own five questions, worded by the server, and the page holds
   * none of that text itself.
   */
  it("asks the five quarterly questions describe named, and answers them in one post", async () => {
    pathname = `/portal/surveys/${survey.id}`;
    search = `token=${TOKEN}`;
    const calls = stubFetch({
      [DESCRIBE]: () => json(aQuarterlyDescription({ id: survey.id })),
      [LINK]: () => json(aQuarterlyAnswer({ survey_id: survey.id })),
    });
    renderPortal(<SurveyLinkAnswer surveyId={survey.id} token={TOKEN} />);

    const groups = await screen.findAllByRole("group");
    expect(groups.map((group) => group.getAttribute("data-question"))).toEqual([
      "responsiveness",
      "quality",
      "communication",
      "value",
      "recommend",
    ]);
    expect(screen.getByText("2026 Q2 relationship survey")).toBeInTheDocument();
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
      { token: TOKEN },
      { token: TOKEN, scores: { responsiveness: 4, quality: 5, communication: 4, value: 3, recommend: 5 } },
    ]);
  });

  it("words the answer route's own refusal on a survey that closed between the read and the send", async () => {
    stubFetch({
      [DESCRIBE]: () => json(aSurveyDescription()),
      [LINK]: () => json({ code: "survey_closed", status: "expired" }, 409),
    });
    renderPortal(<SurveyLinkAnswer surveyId={survey.id} token={TOKEN} />);
    fireEvent.click(await screen.findByRole("button", { name: "3, Neutral" }));
    fireEvent.click(screen.getByRole("button", { name: "Send my answer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This survey has expired and can no longer be answered.",
    );
  });
});
