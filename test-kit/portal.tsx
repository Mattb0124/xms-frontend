import { render, type RenderResult } from "@testing-library/react";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { vi } from "vitest";
import { Toaster, ToastProvider } from "@/components/xms/toast";
import { makeStore } from "@/redux/store";
import type { PortalMe, PortalTicket, PortalTimelineItem, Survey } from "@/redux/portalApi";

/**
 * Constructed portal data and a fetch stub keyed on method and path, shared
 * by the portal tests so every test file builds from the same fixtures.
 */
export function aPortalMe(overrides: Partial<PortalMe["principal"]> = {}, account?: PortalMe["account"]): PortalMe {
  return {
    principal: {
      kind: "portal",
      userId: "user-pat",
      email: "pat@client.test",
      displayName: "Pat Client",
      permissions: ["portal:kb", "portal:submit"],
      ...overrides,
    },
    account: account ?? { id: "acct-1", key: "BRK", name: "Brookfield", branding: {} },
  };
}

export function aPortalTicket(overrides: Partial<PortalTicket> = {}): PortalTicket {
  return {
    id: "t-1",
    key: "CS0001001",
    type: "incident",
    state: "in_progress",
    state_label: "In progress",
    short_description: "Cannot open the consolidation report",
    description: "Error 500 since this morning",
    category: null,
    priority: "p2",
    requester: { display_name: "Pat Client" },
    created_at: "2026-09-07T08:00:00Z",
    updated_at: "2026-09-07T09:00:00Z",
    resolved_at: null,
    closed_at: null,
    version: 3,
    ...overrides,
  };
}

export function aTimeline(): PortalTimelineItem[] {
  return [
    {
      kind: "state_change",
      item_id: "e-1",
      actor_name: "Cara Lee",
      body: null,
      file_name: null,
      from_state: "new",
      to_state: "in_progress",
      created_at: "2026-09-07T08:30:00Z",
    },
    {
      kind: "comment",
      item_id: "c-1",
      actor_name: "Cara Lee",
      body: "We are on it, expect a fix within the hour",
      file_name: null,
      from_state: null,
      to_state: null,
      created_at: "2026-09-07T08:35:00Z",
    },
    {
      kind: "comment",
      item_id: "c-2",
      actor_name: "Pat Client",
      body: "Thanks, still failing for me",
      file_name: null,
      from_state: null,
      to_state: null,
      created_at: "2026-09-07T08:50:00Z",
    },
  ];
}

/** A pending ticket-close survey, sent but not yet answered. */
export function aSurvey(overrides: Partial<Survey> = {}): Survey {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    ticket_id: "t-1",
    ticket_key: "CS0001001",
    short_description: "Cannot open the consolidation report",
    status: "sent",
    sent_at: "2026-09-05T10:00:00Z",
    expires_at: "2026-09-15T10:00:00Z",
    answered_at: null,
    score: null,
    ...overrides,
  };
}

export function anAnsweredSurvey(overrides: Partial<Survey> = {}): Survey {
  return aSurvey({
    id: "22222222-2222-4222-8222-222222222222",
    ticket_id: "t-2",
    ticket_key: "CS0000990",
    short_description: "Password reset for the planning tool",
    status: "answered",
    sent_at: "2026-08-28T10:00:00Z",
    expires_at: "2026-09-07T10:00:00Z",
    answered_at: "2026-08-29T08:30:00Z",
    score: 4,
    ...overrides,
  });
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

class FakeRequest {
  url: string;
  method: string;
  body: string | undefined;
  constructor(url: string, init?: RequestInit) {
    this.url = url;
    this.method = (init?.method ?? "GET").toUpperCase();
    this.body = typeof init?.body === "string" ? init.body : undefined;
  }
}

export interface RecordedCall {
  key: string;
  search: string;
  body?: unknown;
}

/** Routes are `METHOD /path`; every call is recorded with its query string and parsed body. */
export function stubFetch(routes: Record<string, (body?: string) => Response>): RecordedCall[] {
  const calls: RecordedCall[] = [];
  const impl = vi.fn(async (input: FakeRequest | string) => {
    const request = typeof input === "string" ? new FakeRequest(input) : input;
    const url = new URL(request.url);
    const key = `${request.method} ${url.pathname}`;
    calls.push({ key, search: url.search, body: request.body ? JSON.parse(request.body) : undefined });
    const handler = routes[key];
    if (!handler) return json({ code: "not_found" }, 404);
    return handler(request.body);
  });
  vi.stubGlobal("Request", FakeRequest);
  vi.stubGlobal("fetch", impl);
  return calls;
}

export function renderPortal(children: ReactNode): RenderResult {
  const store = makeStore();
  return render(
    <Provider store={store}>
      <ToastProvider ttlMs={0}>
        {children}
        <Toaster />
      </ToastProvider>
    </Provider>,
  );
}
