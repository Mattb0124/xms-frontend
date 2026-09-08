import { describe, expect, it } from "vitest";
import {
  EMPTY_KNOWLEDGE_FILTERS,
  knowledgeFiltersApplied,
  knowledgeFiltersFromSearch,
  knowledgeFiltersToSearch,
} from "@/lib/knowledge/list-filters";

describe("the Solutions list's dimensions in the URL", () => {
  it("reads every dimension, and a saved multi-status link on its first status", () => {
    expect(knowledgeFiltersFromSearch(new URLSearchParams("status=draft&kind=procedure&global=yes&q=vpn"))).toEqual({
      status: "draft",
      kind: "procedure",
      global: "yes",
      q: "vpn",
    });
    expect(knowledgeFiltersFromSearch(new URLSearchParams("status=draft,in_review")).status).toBe("draft");
    expect(knowledgeFiltersFromSearch(new URLSearchParams(""))).toEqual(EMPTY_KNOWLEDGE_FILTERS);
  });

  it("leaves a dimension set back to all out of the URL", () => {
    expect(knowledgeFiltersToSearch({ status: "", kind: "solution", global: "", q: "" }).toString()).toBe(
      "kind=solution",
    );
    expect(knowledgeFiltersToSearch(EMPTY_KNOWLEDGE_FILTERS).toString()).toBe("");
  });

  it("round-trips what it wrote", () => {
    const filters = { status: "published", kind: "known_error", global: "no", q: "close" };
    expect(knowledgeFiltersFromSearch(knowledgeFiltersToSearch(filters))).toEqual(filters);
  });

  it("knows whether anything narrows the list", () => {
    expect(knowledgeFiltersApplied(EMPTY_KNOWLEDGE_FILTERS)).toBe(false);
    expect(knowledgeFiltersApplied({ ...EMPTY_KNOWLEDGE_FILTERS, q: "vpn" })).toBe(true);
    expect(knowledgeFiltersApplied({ ...EMPTY_KNOWLEDGE_FILTERS, global: "no" })).toBe(true);
  });
});
