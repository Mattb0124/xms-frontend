import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountOwnerPanel } from "@/components/admin/owner-panel";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";
import type { AccountRow } from "@/redux/adminApi";

const ACCOUNT_ID = "77777777-7777-4777-8777-777777777777";
const CARA = "11111111-1111-4111-8111-111111111111";
const ADMIN = "22222222-2222-4222-8222-222222222222";

const account = (over: Partial<AccountRow> = {}): AccountRow =>
  ({
    id: ACCOUNT_ID,
    key: "BRK",
    name: "Brookfield",
    legal_name: null,
    status: "active",
    isolation_tier: "shared",
    residency_region: "eu-west-1",
    default_time_zone: "Europe/London",
    default_calendar_id: null,
    branding: {},
    owner_user_id: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    version: 3,
    ...over,
  }) as AccountRow;

const grants = () => json([{ user_id: CARA, email: "cara@example.test", first_name: "Cara", last_name: "Lee" }]);
const internal = () =>
  json([
    { id: CARA, email: "cara@example.test", first_name: "Cara", last_name: "Lee", kind: "internal", status: "active" },
    {
      id: ADMIN,
      email: "admin@example.test",
      first_name: "Ada",
      last_name: "Byron",
      kind: "internal",
      status: "active",
    },
  ]);

describe("AccountOwnerPanel", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("names the current owner and offers only the people granted the account", async () => {
    stubFetch({
      [`GET /v1/admin/accounts/${ACCOUNT_ID}/grants`]: grants,
      "GET /v1/admin/users": internal,
    });
    renderDesk(<AccountOwnerPanel account={account({ owner_user_id: ADMIN })} />);
    await screen.findByText("Ada Byron");
    const options = await screen.findAllByRole("option");
    // Cara is granted; Ada is not, so she is not offered even though she
    // holds the account today through the administrator binding.
    expect(options.map((option) => option.textContent)).toEqual([
      "Choose a person granted this account",
      "Cara Lee · cara@example.test",
    ]);
  });

  it("reads an unowned account as unowned rather than leaving it blank", async () => {
    stubFetch({
      [`GET /v1/admin/accounts/${ACCOUNT_ID}/grants`]: grants,
      "GET /v1/admin/users": internal,
    });
    renderDesk(<AccountOwnerPanel account={account()} />);
    expect(await screen.findByText("Nobody yet")).toBeInTheDocument();
  });

  it("sends the handover with the version it read and the reason typed", async () => {
    const calls = stubFetch({
      [`GET /v1/admin/accounts/${ACCOUNT_ID}/grants`]: grants,
      "GET /v1/admin/users": internal,
      [`PUT /v1/admin/accounts/${ACCOUNT_ID}/owner`]: () => json(account({ owner_user_id: CARA, version: 4 })),
    });
    renderDesk(<AccountOwnerPanel account={account({ owner_user_id: ADMIN })} />);
    const select = await screen.findByLabelText("Hand to");
    fireEvent.change(select, { target: { value: CARA } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Cara picks up Brookfield" } });
    fireEvent.click(screen.getByRole("button", { name: "Change owner" }));

    await waitFor(() => {
      expect(calls.some((call) => call.key === `PUT /v1/admin/accounts/${ACCOUNT_ID}/owner`)).toBe(true);
    });
    const sent = calls.find((call) => call.key === `PUT /v1/admin/accounts/${ACCOUNT_ID}/owner`);
    expect(sent?.body).toEqual({
      version: 3,
      owner_user_id: CARA,
      reason: "Cara picks up Brookfield",
    });
  });

  it("mirrors the server's refusal instead of deciding for itself", async () => {
    stubFetch({
      [`GET /v1/admin/accounts/${ACCOUNT_ID}/grants`]: grants,
      "GET /v1/admin/users": internal,
      [`PUT /v1/admin/accounts/${ACCOUNT_ID}/owner`]: () =>
        new Response(JSON.stringify({ code: "owner_not_granted" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        }),
    });
    renderDesk(<AccountOwnerPanel account={account({ owner_user_id: ADMIN })} />);
    const select = await screen.findByLabelText("Hand to");
    fireEvent.change(select, { target: { value: CARA } });
    fireEvent.click(screen.getByRole("button", { name: "Change owner" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("will not submit until a person is chosen", async () => {
    stubFetch({
      [`GET /v1/admin/accounts/${ACCOUNT_ID}/grants`]: grants,
      "GET /v1/admin/users": internal,
    });
    renderDesk(<AccountOwnerPanel account={account({ owner_user_id: ADMIN })} />);
    await screen.findByLabelText("Hand to");
    expect(screen.getByRole("button", { name: "Change owner" })).toBeDisabled();
  });
});
