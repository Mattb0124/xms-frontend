import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PortalSurveyPage from "@/app/(portal)/portal/surveys/[id]/page";
import { PortalChrome } from "@/components/portal/portal-chrome";
import { resetSurveyToken } from "@/lib/portal/survey-token";
import { aPortalMe, aSurvey, aSurveyDescription, json, renderPortal, stubFetch } from "@/test-kit/portal";

const survey = aSurvey();
const TOKEN = "Xk3nQ8pLmZ2vT7wBfR4jY6sD";
let pathname = `/portal/surveys/${survey.id}`;
let search = "";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(search),
  useParams: () => ({ id: survey.id }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

/**
 * The survey token must not sit in the address bar: there it reaches browser
 * history, bookmark sync, proxy and load-balancer logs, and travels verbatim
 * when the client forwards the email (security review finding 9).
 */
describe("the survey link page", () => {
  beforeEach(() => {
    resetSurveyToken();
    pathname = `/portal/surveys/${survey.id}`;
    search = "";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
  });

  it("answers from a fragment token and clears it out of the address", async () => {
    window.history.replaceState(null, "", `/portal/surveys/${survey.id}#token=${TOKEN}`);
    // The token is the credential for the read behind the link as well as for
    // the answer, so the page describes the survey with the token it captured.
    const calls = stubFetch({ [`POST /v1/csat/${survey.id}/describe`]: () => json(aSurveyDescription()) });
    renderPortal(<PortalSurveyPage />);
    expect(await screen.findByTestId("survey-link")).toBeInTheDocument();
    expect(await screen.findByText("How satisfied are you with the handling of CS0001001?")).toBeInTheDocument();
    expect(calls.map((call) => call.body)).toEqual([{ token: TOKEN }]);
    expect(window.location.hash).toBe("");
    expect(window.location.href).not.toContain(TOKEN);
    expect(window.location.pathname).toBe(`/portal/surveys/${survey.id}`);
  });

  it("still answers from a query token, and clears that out of the address too", async () => {
    window.history.replaceState(null, "", `/portal/surveys/${survey.id}?token=${TOKEN}`);
    search = `token=${TOKEN}`;
    stubFetch({});
    renderPortal(<PortalSurveyPage />);
    expect(await screen.findByTestId("survey-link")).toBeInTheDocument();
    await waitFor(() => expect(window.location.search).toBe(""));
    expect(window.location.href).not.toContain(TOKEN);
  });

  it("shows the signed-in Surveys page when no token came with the link", async () => {
    window.history.replaceState(null, "", `/portal/surveys/${survey.id}`);
    stubFetch({
      "GET /v1/portal/me": () => json(aPortalMe()),
      "GET /v1/portal/surveys": () => json({ pending: [survey], answered: [] }),
    });
    renderPortal(<PortalSurveyPage />);
    expect(await screen.findByText(String(survey.ticket_key))).toBeInTheDocument();
    expect(screen.queryByTestId("survey-link")).not.toBeInTheDocument();
  });

  it("keeps the chrome off, and never asks for the session, for a fragment link", async () => {
    window.history.replaceState(null, "", `/portal/surveys/${survey.id}#token=${TOKEN}`);
    const calls = stubFetch({});
    renderPortal(
      <PortalChrome>
        <PortalSurveyPage />
      </PortalChrome>,
    );
    expect(await screen.findByTestId("portal-bare")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Portal" })).not.toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(calls.some((call) => call.key === "GET /v1/portal/me")).toBe(false);
  });
});
