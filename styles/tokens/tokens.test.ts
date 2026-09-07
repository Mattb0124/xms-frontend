// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Pins the token contract from 01-architecture/DESIGN-SYSTEM.md section 8 and
// Wireframes sections 4 and 8. A renamed or removed token fails here before
// it silently breaks a component.
const tokensDir = join(process.cwd(), "styles", "tokens");
const scope = readFileSync(join(tokensDir, "xms-scope.css"), "utf8");
const house = readFileSync(join(tokensDir, "house.css"), "utf8");

const REQUIRED_SCOPE_TOKENS = [
  "--xms-ink",
  "--xms-body",
  "--xms-label",
  "--xms-muted",
  "--xms-accent",
  "--xms-navy",
  "--xms-bar",
  "--xms-bg",
  "--xms-card",
  "--xms-tint",
  "--xms-line",
  "--xms-row-hover",
  "--xms-ai-bg",
  "--xms-ai-border",
  "--xms-ai-accent",
  "--xms-mono",
  "--xms-state-new-fg",
  "--xms-state-in-progress-fg",
  "--xms-state-awaiting-client-fg",
  "--xms-state-awaiting-approval-fg",
  "--xms-state-resolved-fg",
  "--xms-state-closed-fg",
  "--xms-type-incident",
  "--xms-type-request",
  "--xms-type-change",
  "--xms-type-problem",
  "--xms-account-1",
  "--xms-account-6",
];

describe("xms token contract", () => {
  it("defines every identity, ramp, type and account token", () => {
    for (const token of REQUIRED_SCOPE_TOKENS) {
      expect(scope, token).toContain(`${token}:`);
    }
  });

  it("has no zebra token (dense lists have no row striping)", () => {
    expect(scope).not.toContain("--xms-zebra");
  });

  it("keeps the signal trios in the house layer, never re-themed by the scope", () => {
    expect(house).toContain("--state-overdue-text: #dc2626");
    expect(scope).not.toContain("--state-overdue-text");
  });

  it("uses the wireframe values for the core identity", () => {
    expect(scope).toContain("--xms-navy: #10193a");
    expect(scope).toContain("--xms-accent: #2563eb");
    expect(scope).toContain("--xms-bg: #f4f5f7");
  });

  it("provides a dark inversion for every light token", () => {
    const light = scope.split(".dark .xms-scope")[0];
    const dark = scope.split(".dark .xms-scope")[1] ?? "";
    const lightTokens = [...light.matchAll(/(--xms-(?:ink|body|label|muted|accent|navy|bar|bg|card|tint|line|ai-bg|ai-border|ai-accent|row-hover|cell-hover)):/g)].map(
      (m) => m[1],
    );
    for (const token of new Set(lightTokens)) {
      expect(dark, `${token} has no dark value`).toContain(`${token}:`);
    }
  });
});
