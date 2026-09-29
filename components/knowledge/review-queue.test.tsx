import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { formatDay } from "@/lib/format/date";
import { describe, expect, it, vi } from "vitest";
import { KnowledgeReviewQueue } from "@/components/knowledge/review-queue";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";
import type { Article } from "@/redux/knowledgeApi";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

function article(overrides: Partial<Article> = {}): Article {
  return {
    id: "k1",
    account_id: "a1",
    display_key: "KB0000012",
    kind: "solution",
    status: "in_review",
    is_global: false,
    title: "Reset the consolidation cache",
    categories: ["OneStream"],
    self_service: "none",
    effort_band: null,
    owner_user_id: "u2",
    owner_name: "Ben Okafor",
    reviewer_name: null,
    published_version_id: null,
    last_verified_at: null,
    retired_at: null,
    retired_reason: null,
    source_ticket_id: null,
    generalized_from_id: null,
    created_at: "2026-09-01T09:00:00Z",
    updated_at: "2026-09-05T09:00:00Z",
    version: 3,
    ...overrides,
  } as Article;
}

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: ["a1"], permissions } });

describe("KnowledgeReviewQueue", () => {
  it("is closed, and asks nothing, without kb:publish", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["kb:author"]),
      "GET /v1/articles": () => json([article()]),
    });
    renderDesk(<KnowledgeReviewQueue />);
    expect(await screen.findByText("Not permitted")).toBeInTheDocument();
    expect(calls.some((call) => call.key.includes("/v1/articles"))).toBe(false);
  });

  it("asks only for what is waiting, and says how long it has waited", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["kb:publish"]),
      "GET /v1/articles": () => json([article()]),
    });
    renderDesk(<KnowledgeReviewQueue />);

    const table = within(await screen.findByRole("table", { name: "Review queue" }));
    expect(table.getByText("Reset the consolidation cache")).toBeInTheDocument();
    expect(table.getByText(formatDay("2026-09-05T09:00:00Z"))).toBeInTheDocument();
    const asked = calls.find((call) => call.key.includes("/v1/articles"));
    expect(asked?.search).toContain("status=in_review");
  });

  it("publishes from the row, because the point of a queue is clearing it", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["kb:publish"]),
      "GET /v1/articles": () => json([article()]),
      "POST /v1/articles/KB0000012/publish": () => json(article({ status: "published" })),
    });
    renderDesk(<KnowledgeReviewQueue />);
    const table = within(await screen.findByRole("table", { name: "Review queue" }));

    // ConfirmButton asks first, so the decision is never one stray click away.
    fireEvent.click(table.getByRole("button", { name: "Publish" }));
    fireEvent.click(table.getByRole("button", { name: /Confirm|Publish/ }));

    await waitFor(() => expect(calls.some((call) => call.key === "POST /v1/articles/KB0000012/publish")).toBe(true));
    expect(calls.find((call) => call.key.includes("publish"))?.body).toMatchObject({ version: 3 });
  });

  it("sends anything needing a reason to the record rather than deciding blind", async () => {
    stubFetch({ "GET /v1/admin/me": me(["kb:publish"]), "GET /v1/articles": () => json([article()]) });
    renderDesk(<KnowledgeReviewQueue />);
    const table = within(await screen.findByRole("table", { name: "Review queue" }));
    // Retiring records why, so the queue offers the record, not the decision.
    expect(table.queryByRole("button", { name: "Retire" })).toBeNull();
    expect(table.getAllByRole("link", { name: "Open" })[0]).toHaveAttribute("href", "/knowledge/KB0000012");
  });

  it("says plainly when there is nothing to review", async () => {
    stubFetch({ "GET /v1/admin/me": me(["kb:publish"]), "GET /v1/articles": () => json([]) });
    renderDesk(<KnowledgeReviewQueue />);
    expect(await screen.findByText(/Submitted articles land here/)).toBeInTheDocument();
  });
});
