// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { extractSurveyToken, readSurveyToken, resetSurveyToken } from "@/lib/portal/survey-token";

const TOKEN = "Xk3nQ8pLmZ2vT7wBfR4jY6sD";

function fakeWindow(href: string) {
  const replaceState = vi.fn();
  return {
    replaceState,
    win: {
      location: { href },
      history: { state: { a: 1 }, replaceState },
    } as unknown as Pick<Window, "location" | "history">,
  };
}

/**
 * The token is the sole credential for the unauthenticated answer route. In
 * the query string it lands in history, bookmark sync and every access log on
 * the path, and travels verbatim when the client forwards the email (security
 * review finding 9). The fragment is never sent to a server, and whichever
 * form carried it the token must leave the address bar on read.
 */
describe("extractSurveyToken", () => {
  it("reads the fragment first and leaves an address with no token in it", () => {
    const result = extractSurveyToken(`https://portal.test/portal/surveys/s-1#token=${TOKEN}`);
    expect(result.token).toBe(TOKEN);
    expect(result.cleaned).toBe("/portal/surveys/s-1");
    expect(result.cleaned).not.toContain(TOKEN);
    expect(result.cleaned).not.toContain("token");
  });

  it("still accepts the query form, for links already in inboxes", () => {
    const result = extractSurveyToken(`https://portal.test/portal/surveys/s-1?token=${TOKEN}`);
    expect(result.token).toBe(TOKEN);
    expect(result.cleaned).toBe("/portal/surveys/s-1");
  });

  it("prefers the fragment when both are present", () => {
    const result = extractSurveyToken(`https://portal.test/portal/surveys/s-1?token=old#token=${TOKEN}`);
    expect(result.token).toBe(TOKEN);
    expect(result.cleaned).not.toContain("old");
  });

  it("keeps the other query and fragment parameters", () => {
    const result = extractSurveyToken(`https://portal.test/portal/surveys/s-1?from=email#token=${TOKEN}&focus=1`);
    expect(result.token).toBe(TOKEN);
    expect(result.cleaned).toBe("/portal/surveys/s-1?from=email#focus=1");
  });

  it("finds nothing when there is nothing, and refuses an implausible token", () => {
    expect(extractSurveyToken("https://portal.test/portal/surveys/s-1").token).toBeNull();
    expect(extractSurveyToken("https://portal.test/portal/surveys/s-1#token=").token).toBeNull();
    expect(extractSurveyToken("https://portal.test/portal/surveys/s-1#token=short").token).toBeNull();
    expect(extractSurveyToken("not a url").token).toBeNull();
  });
});

describe("readSurveyToken", () => {
  afterEach(() => resetSurveyToken());

  it("takes the token out of the address bar as soon as it is read", () => {
    const { win, replaceState } = fakeWindow(`https://portal.test/portal/surveys/s-1#token=${TOKEN}`);
    expect(readSurveyToken(win)).toBe(TOKEN);
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(replaceState.mock.calls[0][2]).toBe("/portal/surveys/s-1");
    expect(String(replaceState.mock.calls[0][2])).not.toContain(TOKEN);
    // The history state is preserved, so the router is not disturbed.
    expect(replaceState.mock.calls[0][0]).toEqual({ a: 1 });
  });

  it("takes the query form out of the bar too, so it leaves history and referrers", () => {
    const { win, replaceState } = fakeWindow(`https://portal.test/portal/surveys/s-1?token=${TOKEN}`);
    expect(readSurveyToken(win)).toBe(TOKEN);
    expect(replaceState.mock.calls[0][2]).toBe("/portal/surveys/s-1");
  });

  it("remembers the answer, since the address no longer carries it", () => {
    const { win, replaceState } = fakeWindow(`https://portal.test/portal/surveys/s-1#token=${TOKEN}`);
    expect(readSurveyToken(win)).toBe(TOKEN);
    const second = fakeWindow("https://portal.test/portal/surveys/s-1");
    expect(readSurveyToken(second.win)).toBe(TOKEN);
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(second.replaceState).not.toHaveBeenCalled();
  });

  it("touches nothing on a page with no token", () => {
    const { win, replaceState } = fakeWindow("https://portal.test/portal/requests");
    expect(readSurveyToken(win)).toBeNull();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("still hands back the token when the browser refuses replaceState", () => {
    const { win } = fakeWindow(`https://portal.test/portal/surveys/s-1#token=${TOKEN}`);
    (win.history.replaceState as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readSurveyToken(win)).toBe(TOKEN);
  });
});
