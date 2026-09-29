"use client";

import { useSyncExternalStore } from "react";

/**
 * The one-time survey token (security review finding 9).
 *
 * The token is the sole credential for the unauthenticated
 * `POST /v1/csat/:id/answer`. In the query string it lands in browser
 * history, bookmark sync, proxy and load-balancer access logs, and travels
 * verbatim whenever the client forwards the email; anyone holding those logs
 * can answer on the client's behalf and attribute a free-text comment to that
 * contact. So the fragment is read first, since a fragment is never sent to a
 * server and never logged, and whichever form carried it, the token is taken
 * out of the address bar with `history.replaceState` the moment it is read,
 * so it leaves the bar, the session history entry and any Referer.
 *
 * Links already in inboxes carry `?token=`, so that form keeps working; the
 * API is moving to `#token=`.
 */

/** A token that could plausibly have been minted: printable, no whitespace, bounded. */
const PLAUSIBLE_TOKEN = /^[\x21-\x7e]{8,512}$/;

export interface ExtractedSurveyToken {
  token: string | null;
  /** The address to put in the bar instead, as a same-document relative URL. */
  cleaned: string;
}

/** Pulls `#token=` first, then `?token=`, and returns the address with neither. */
export function extractSurveyToken(href: string): ExtractedSurveyToken {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return { token: null, cleaned: href };
  }
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
  const candidate = fragment.get("token") ?? url.searchParams.get("token");
  const relative = () => `${url.pathname}${url.search}${url.hash}`;
  if (candidate === null || !PLAUSIBLE_TOKEN.test(candidate)) return { token: null, cleaned: relative() };
  fragment.delete("token");
  url.searchParams.delete("token");
  const rest = fragment.toString();
  url.hash = rest ? `#${rest}` : "";
  return { token: candidate, cleaned: relative() };
}

let captured: string | null | undefined;

/**
 * Reads the token once per page load and strips it from the address. The
 * answer is remembered because the address no longer carries it: a second
 * component, or a remount, must still be able to ask.
 */
export function readSurveyToken(
  win: Pick<Window, "location" | "history"> = typeof window === "undefined"
    ? ({ location: { href: "" }, history: {} } as unknown as Window)
    : window,
): string | null {
  if (captured !== undefined) return captured;
  const { token, cleaned } = extractSurveyToken(win.location.href);
  captured = token;
  if (token !== null) {
    try {
      win.history.replaceState(win.history.state ?? null, "", cleaned);
    } catch {
      // A browser that refuses replaceState keeps the token in the bar; the
      // answer still posts, and nothing else in the page depends on this.
    }
  }
  return token;
}

/** Test seam: the module remembers the token for the life of the page. */
export function resetSurveyToken(): void {
  captured = undefined;
  listeners.clear();
}

const listeners = new Set<() => void>();

/** Reads on the first subscription, which React runs after the render is committed. */
function subscribeSurveyToken(onChange: () => void): () => void {
  listeners.add(onChange);
  if (captured === undefined && typeof window !== "undefined") {
    readSurveyToken();
    for (const listener of listeners) listener();
  }
  return () => {
    listeners.delete(onChange);
  };
}

function snapshotSurveyToken(): string | null | undefined {
  return captured;
}

function serverSnapshotSurveyToken(): string | null | undefined {
  return undefined;
}

export interface SurveyLinkState {
  /** True until the token has been read on the client; the server never sees a fragment. */
  pending: boolean;
  token: string | null;
}

/**
 * The token as React state. It is pending through the server render and the
 * first client render, so both agree and there is no hydration mismatch; the
 * caller shows a placeholder for that one frame rather than guessing. The
 * read, and the `replaceState` that goes with it, happen on subscription,
 * never during a render.
 */
export function useSurveyLink(): SurveyLinkState {
  const token = useSyncExternalStore(subscribeSurveyToken, snapshotSurveyToken, serverSnapshotSurveyToken);
  return { pending: token === undefined, token: token ?? null };
}
