import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminAccountRecordPage, { initialTab } from "@/app/(internal)/admin/accounts/[id]/page";
import { aBudget } from "@/redux/timeApi.test";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

const ACCOUNT_ID = "77777777-7777-4777-8777-777777777777";
let search = "tab=budget";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: ACCOUNT_ID }),
  useSearchParams: () => new URLSearchParams(search),
  usePathname: () => `/admin/accounts/${ACCOUNT_ID}`,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: [ACCOUNT_ID], permissions } });

const account = () =>
  json({
    id: ACCOUNT_ID,
    key: "BRK",
    name: "Brookfield",
    status: "active",
    legal_name: null,
    isolation_tier: "shared",
    residency_region: "eu-west-1",
    default_time_zone: "Europe/London",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    version: 1,
  });

describe("initialTab", () => {
  it("opens the tab a link names and falls back to the overview", () => {
    expect(initialTab(new URLSearchParams("tab=budget"))).toBe("budget");
    expect(initialTab(new URLSearchParams("tab=contracts"))).toBe("contracts");
    expect(initialTab(new URLSearchParams("tab=nonsense"))).toBe("overview");
    expect(initialTab(new URLSearchParams(""))).toBe("overview");
    expect(initialTab(null)).toBe("overview");
  });
});

describe("AdminAccountRecordPage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("resolves ?tab=budget (the threshold notification link) to the Budget view", async () => {
    search = "tab=budget";
    const calls = stubFetch({
      "GET /v1/admin/me": me(["admin:accounts", "tickets:view"]),
      [`GET /v1/admin/accounts/${ACCOUNT_ID}`]: account,
      [`GET /v1/accounts/${ACCOUNT_ID}/budget`]: () => json(aBudget({ account_id: ACCOUNT_ID })),
    });
    renderDesk(<AdminAccountRecordPage />);
    await screen.findByLabelText("CT10001 Support retainer");
    expect(screen.getByRole("tab", { name: "Budget" })).toHaveAttribute("aria-selected", "true");
    expect(calls.some((call) => call.key === `GET /v1/accounts/${ACCOUNT_ID}/budget`)).toBe(true);
  });

  it("fails closed on the Budget tab without tickets:view", async () => {
    search = "tab=budget";
    const calls = stubFetch({
      "GET /v1/admin/me": me(["admin:accounts"]),
      [`GET /v1/admin/accounts/${ACCOUNT_ID}`]: account,
    });
    renderDesk(<AdminAccountRecordPage />);
    await screen.findByText(/Needs the tickets:view permission/);
    expect(calls.some((call) => call.key.endsWith("/budget"))).toBe(false);
  });
});
