import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountSettingsTab } from "@/components/admin/account-settings-tab";
import { Toaster, ToastProvider } from "@/components/xms/toast";
import { makeStore } from "@/redux/store";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/accounts/acc-1" }));

const ACCOUNT = "acc-1";

function settings(version: number) {
  return {
    id: "set-1",
    account_id: ACCOUNT,
    portal_enabled: false,
    consumption_visible: false,
    csat_enabled: false,
    sync_mode: "off",
    ai_enabled: false,
    ai_opt_ins: {},
    ai_region_ok: true,
    email_branding: {},
    outbound_identity: null,
    inbound_aliases: [],
    retention_days: 2555,
    attachment_max_bytes: 26214400,
    usage_analytics_portal: true,
    store_search_terms: false,
    version,
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/**
 * A minimal Request so fetchBaseQuery can build one under jsdom (the real
 * undici Request rejects jsdom's AbortSignal); the stub reads it back.
 */
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

/** A fetch stub keyed on method and path; records every call for the assertions. */
function stubFetch(routes: Record<string, (body?: string) => Response>) {
  const calls: string[] = [];
  const impl = vi.fn(async (input: FakeRequest | string) => {
    const request = typeof input === "string" ? new FakeRequest(input) : input;
    const key = `${request.method} ${new URL(request.url).pathname}`;
    calls.push(key);
    const handler = routes[key];
    if (!handler) return json({ code: "not_found" }, 404);
    return handler(request.body);
  });
  vi.stubGlobal("Request", FakeRequest);
  vi.stubGlobal("fetch", impl);
  return calls;
}

function renderTab() {
  const store = makeStore();
  return render(
    <Provider store={store}>
      <ToastProvider ttlMs={0}>
        <AccountSettingsTab accountId={ACCOUNT} />
        <Toaster />
      </ToastProvider>
    </Provider>,
  );
}

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: [ACCOUNT], permissions }, accounts: [] });

beforeEach(() => {
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => undefined, removeItem: () => undefined });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AccountSettingsTab", () => {
  it("disables the AI section for a user without ai:configure and enables it with it", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["admin:accounts"]),
      "GET /v1/admin/accounts/acc-1/settings": () => json(settings(1)),
    });
    const { unmount } = renderTab();
    const aiSwitch = await screen.findByLabelText(/AI enabled for this account/);
    expect(aiSwitch).toBeDisabled();
    expect(screen.getByTestId("ai-section")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(/Needs the ai:configure permission/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Portal enabled/)).toBeEnabled();
    unmount();

    stubFetch({
      "GET /v1/admin/me": me(["admin:accounts", "ai:configure"]),
      "GET /v1/admin/accounts/acc-1/settings": () => json(settings(1)),
    });
    renderTab();
    expect(await screen.findByLabelText(/AI enabled for this account/)).toBeEnabled();
  });

  it("sends one PUT with the version and, on 409 stale_version, toasts and reloads the row", async () => {
    let version = 1;
    const calls = stubFetch({
      "GET /v1/admin/me": me(["admin:accounts"]),
      "GET /v1/admin/accounts/acc-1/settings": () => json(settings(version)),
      "PUT /v1/admin/accounts/acc-1/settings": (raw) => {
        const body = JSON.parse(String(raw)) as { version: number; portal_enabled?: boolean };
        expect(body).toEqual({ version: 1, portal_enabled: true });
        version = 2;
        return json({ code: "stale_version", entity: "account_settings" }, 409);
      },
    });
    renderTab();
    const portal = await screen.findByLabelText(/Portal enabled/);
    fireEvent.click(portal);
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    await screen.findByText(/Someone else changed this record/);
    await waitFor(() => expect(calls.filter((c) => c === "GET /v1/admin/accounts/acc-1/settings").length).toBe(2));
    await waitFor(() => expect(screen.getByText("version 2")).toBeInTheDocument());
    // The reload discards the draft, so the row shows the server value again.
    expect(screen.getByLabelText(/Portal enabled/)).not.toBeChecked();
  });
});
