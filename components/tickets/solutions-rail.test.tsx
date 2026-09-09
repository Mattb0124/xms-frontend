import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SolutionsRail } from "@/components/tickets/solutions-rail";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({
  usePathname: () => "/cases/CS0001001",
  useRouter: () => ({ push: vi.fn() }),
}));

const me = {
  principal: {
    kind: "internal",
    userId: "user-cara",
    email: "cara@example.test",
    displayName: "Cara Lee",
    accountIds: ["acct-1"],
    permissions: ["tickets:view", "tickets:resolve", "kb:author"],
  },
};

const rail = {
  articles: [
    {
      id: "a-1",
      display_key: "KB100001",
      title: "Renew the report certificate",
      kind: "solution",
      status: "published",
      is_global: true,
      account_id: "g",
      categories: [],
      self_service: "follow",
      rank: 1,
    },
  ],
  similar_tickets: [
    {
      id: "t-9",
      key: "CS0000999",
      short_description: "Report error 500 last month",
      resolution_code: "fixed",
      article_key: "KB100001",
      article_title: "Renew the report certificate",
      rank: 0.5,
    },
  ],
  linked: [
    {
      id: "s-1",
      article_id: "a-2",
      article_version_id: "v-2",
      outcome: "created_from",
      actor_name: "Cara Lee",
      created_at: "2026-09-07T10:00:00Z",
      display_key: "KB100002",
      title: "Draft from this ticket",
    },
  ],
};

describe("SolutionsRail", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders the matching articles, similar tickets and resolution records, and Use this posts the article id", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": () => json(me),
      "GET /v1/tickets/CS0001001/solutions": () => json(rail),
      "POST /v1/tickets/CS0001001/solutions": () =>
        json({ id: "s-2", article: { id: "a-1", key: "KB100001", title: "Renew the report certificate" } }, 201),
    });
    renderDesk(<SolutionsRail ticketKey="CS0001001" />);
    await waitFor(() => expect(screen.getByText("Renew the report certificate")).toBeInTheDocument());
    expect(screen.getByText("Report error 500 last month")).toBeInTheDocument();
    expect(screen.getByText("Article created from this ticket")).toBeInTheDocument();
    expect(screen.getByText("Global")).toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole("button", { name: "Use KB100001" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Use KB100001" }));
    await waitFor(() => expect(calls.some((call) => call.key === "POST /v1/tickets/CS0001001/solutions")).toBe(true));
    expect(calls.find((call) => call.key === "POST /v1/tickets/CS0001001/solutions")?.body).toEqual({
      article_id: "a-1",
    });
    await waitFor(() => expect(screen.getByText("KB100001 linked as the solution")).toBeInTheDocument());
  });

  it("shows the empty state when nothing matches", async () => {
    stubFetch({
      "GET /v1/admin/me": () => json(me),
      "GET /v1/tickets/CS0001001/solutions": () => json({ articles: [], similar_tickets: [], linked: [] }),
    });
    renderDesk(<SolutionsRail ticketKey="CS0001001" />);
    await waitFor(() =>
      expect(
        screen.getByText("No documented solution yet. Resolving this ticket will create the first one."),
      ).toBeInTheDocument(),
    );
  });
});
