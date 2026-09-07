import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArticleActions, describeArticleError, FindingsSheet } from "@/components/knowledge/article-actions";
import { anArticle } from "@/redux/knowledgeApi.test";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({
  usePathname: () => "/knowledge/KB100001",
  useRouter: () => ({ push: vi.fn() }),
}));

const curator = {
  principal: {
    kind: "internal",
    userId: "user-admin",
    email: "admin@example.test",
    displayName: "Admin",
    accountIds: ["acct-1"],
    permissions: ["tickets:view", "kb:author", "kb:publish"],
  },
};

describe("article actions", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("describes the publish refusals in words", () => {
    expect(describeArticleError({ status: 409, code: "reviewer_must_differ" })).toBe(
      "The reviewer must be someone other than the author of this draft.",
    );
    expect(describeArticleError({ status: 409, code: "missing_requirements", items: ["problem_statement", "steps"] })).toBe(
      "Fill in Problem statement and Steps before publishing.",
    );
  });

  it("renders the reviewer refusal inline after a 409 on publish", async () => {
    stubFetch({
      "GET /v1/admin/me": () => json(curator),
      "POST /v1/articles/KB100001/publish": () => json({ code: "reviewer_must_differ" }, 409),
    });
    renderDesk(<ArticleActions article={anArticle()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("The reviewer must be someone other than the author of this draft."),
    );
  });

  it("opens the findings sheet when generalize returns identifiers", async () => {
    stubFetch({
      "GET /v1/admin/me": () => json(curator),
      "POST /v1/articles/KB100001/generalize": () =>
        json({ findings: [{ section: "steps", kind: "account_name", value: "Brookfield" }] }, 201),
    });
    renderDesk(<ArticleActions article={anArticle()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Generalize" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Generalize" }));
    const sheet = await screen.findByRole("dialog", { name: "Generalization findings" });
    expect(sheet).toHaveTextContent("Steps");
    expect(sheet).toHaveTextContent("Account name");
    expect(sheet).toHaveTextContent("Brookfield");
  });

  it("the findings sheet lists every finding with its section and kind", () => {
    render(
      <FindingsSheet
        findings={[
          { section: "problem_statement", kind: "hostname", value: "brk-prd-01" },
          { section: "steps", kind: "email", value: "pat@client.test" },
        ]}
        onClose={() => undefined}
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Hostname")).toBeInTheDocument();
    expect(screen.getByText("pat@client.test")).toBeInTheDocument();
  });
});
