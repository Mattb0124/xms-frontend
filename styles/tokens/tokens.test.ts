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
const globals = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");

/** Every top-level rule in a stylesheet, paired with the `@layer` it sits in ("" when unlayered). */
function topLevelRules(css: string): Array<{ selector: string; layer: string }> {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: Array<{ selector: string; layer: string }> = [];
  const walk = (source: string, layer: string) => {
    let depth = 0;
    let start = 0;
    let head = "";
    for (let i = 0; i < source.length; i += 1) {
      const character = source[i];
      if (character === "{") {
        if (depth === 0) {
          head = source.slice(start, i).trim();
          start = i + 1;
        }
        depth += 1;
      } else if (character === "}") {
        depth -= 1;
        if (depth === 0) {
          const body = source.slice(start, i);
          const at = /^@layer\s+([\w-]+)$/.exec(head);
          if (at) walk(body, at[1]);
          else for (const selector of head.split(",")) rules.push({ selector: selector.trim(), layer });
          start = i + 1;
        }
      } else if (depth === 0 && character === ";") {
        start = i + 1;
      }
    }
  };
  walk(stripped, "");
  return rules;
}

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

  // The identity moved onto the ServiceNow Next Experience palette on
  // 2026-09-10 (AIBL-316), a deliberate departure from the wireframe values
  // that ADR-17 and ADR-18 make the UI source of truth. The navy finder bar is
  // the one value that did not move, and it is still the only blue surface at
  // the top of the app.
  it("uses the ServiceNow palette for the core identity", () => {
    expect(scope).toContain("--xms-navy: #10193a");
    expect(scope).toContain("--xms-accent: #006fba");
    expect(scope).toContain("--xms-ink: #000e1d");
    expect(scope).toContain("--xms-bg: #fafbfc");
  });

  // Nothing renders below the body size. Sub-14 sizes were swept out of the
  // components and out of both token layers on 2026-09-10; the bottom of the
  // scale collapses onto 14 rather than the names being removed.
  it("holds the 14px floor across the scale and the scope", () => {
    for (const step of ["--xms-text-xs", "--xms-text-sm", "--xms-text-md"]) {
      expect(scope).toContain(`${step}: 14px`);
    }
    expect(scope).not.toMatch(/font(-size)?: *(?:[0-9]+ )?(9|10|11|12|13)px/);
    expect(house).not.toMatch(/font(-size)?: *(?:[0-9]+ )?(9|10|11|12|13)px/);
  });

  // Tailwind v4 emits every utility inside the `utilities` cascade layer, and an
  // unlayered rule beats a layered one whatever its specificity. An unlayered
  // `a { color: var(--xms-accent) }` therefore beat `text-white` on every
  // link-styled primary action and painted it accent on accent, a 1:1 contrast
  // ratio with no visible label (frontend review finding 4).
  it("keeps the element link rule inside @layer base so a colour utility wins", () => {
    const anchors = topLevelRules(globals).filter((rule) => /^a(:|$)/.test(rule.selector));
    expect(anchors.length).toBeGreaterThan(0);
    for (const rule of anchors) {
      expect(rule.layer, `${rule.selector} must be layered, not unlayered`).toBe("base");
    }
  });

  it("leaves no unlayered element rule in the global stylesheet that could beat a utility", () => {
    const unlayered = topLevelRules(globals)
      .filter((rule) => rule.layer === "")
      .map((rule) => rule.selector);
    // html, body and the scrollbar pseudo-elements carry no utility equivalent.
    const allowed = new Set(["html", "body", "::-webkit-scrollbar", "::-webkit-scrollbar-thumb"]);
    for (const selector of unlayered) {
      expect(allowed.has(selector), `${selector} is unlayered and would beat a Tailwind utility`).toBe(true);
    }
  });

  it("provides a dark inversion for every light token", () => {
    const light = scope.split(".dark .xms-scope")[0];
    const dark = scope.split(".dark .xms-scope")[1] ?? "";
    const lightTokens = [
      ...light.matchAll(
        /(--xms-(?:ink|body|label|muted|accent|navy|bar|bg|card|tint|line|ai-bg|ai-border|ai-accent|row-hover|cell-hover)):/g,
      ),
    ].map((m) => m[1]);
    for (const token of new Set(lightTokens)) {
      expect(dark, `${token} has no dark value`).toContain(`${token}:`);
    }
  });
});

describe("the display key face", () => {
  it("declares .xms-key after .xms-link so the link shorthand cannot reclaim the family", () => {
    // .xms-link sets `font: 400 13px/1.3 var(--xms-font)`, and the shorthand
    // carries the family. Both are single-class selectors in the same layer, so
    // source order alone decides which family a key ends up in. Declared the
    // other way round, every KeyLink silently returns to the sans face.
    const link = scope.indexOf(".xms-link {");
    const key = scope.indexOf(".xms-key {");
    expect(link).toBeGreaterThan(-1);
    expect(key).toBeGreaterThan(-1);
    expect(key).toBeGreaterThan(link);
  });

  it("puts the key in the UI family with tabular figures", () => {
    // Matt, 2026-09-09: a display key is text a person reads and follows, so it
    // wears the UI face like every other link. Tabular figures keep a column
    // of keys lined up without the mono face setting them apart.
    const rule = scope.slice(scope.indexOf(".xms-key {"));
    const body = rule.slice(0, rule.indexOf("}"));
    expect(body).toContain("var(--xms-font)");
    expect(body).toContain("tabular-nums");
    expect(body).toContain("var(--xms-accent)");
  });
});

/** The declaration block a selector opens, so a rule can be read literally. */
function fieldRule(selector: string): string {
  const at = scope.indexOf(selector);
  if (at < 0) return "";
  return scope.slice(at, scope.indexOf("}", at));
}

/** The block that puts the fill back, keyed on the disabled selector list. */
function disabledRule(): string {
  const at = scope.indexOf('.xms-scope select:not([class*="opacity-0"]):not(.bg-transparent):disabled');
  if (at < 0) return "";
  return scope.slice(at, scope.indexOf("}", at));
}

describe("the field treatment", () => {
  it("draws a field recessed and fills it on hover, in both grounds", () => {
    expect(scope).toMatch(/--xms-field-inset: inset 0 1px 3px/);
    expect(scope).toMatch(/--xms-control-hover: #d3dcec/);
    // The dark ground reverses it: a light top edge, since a shadow on a
    // dark field is invisible.
    expect(scope).toMatch(/--xms-field-inset: inset 0 1px 0 rgb\(255 255 255/);
    expect(scope).toMatch(/--xms-control-hover: #24344f/);
  });

  it("makes a field you can type in white, and the fill mean you cannot", () => {
    // A field at rest is the card colour, whatever kind of field it is.
    expect(fieldRule(".xms-scope .xms-field {")).toContain("background-color: var(--xms-card)");
    // The fill is what a field you cannot type in wears, and nothing else.
    expect(disabledRule()).toContain("background-color: var(--xms-field-bg)");
  });

  it("makes hover a fill and never a change of edge", () => {
    expect(scope).toMatch(/\.xms-field:hover[\s\S]{0,140}background-color: var\(--xms-control-hover\)/);
    // A control that already reads blue fills with the blue wash instead.
    expect(scope).toMatch(/\.xms-field\[data-active="true"\][\s\S]{0,140}background-color: var\(--xms-tint\)/);
  });
});

describe("text in a table", () => {
  it("reads in ink unless it is a link, and leaves the signals their colour", () => {
    const rule = scope.slice(scope.indexOf(".xms-scope table :is(th, td)"));
    const block = rule.slice(0, rule.indexOf("}"));
    expect(block).toContain("[data-tone]");
    expect(block).toContain(".xms-state-mark");
    expect(block).toContain(".xms-priority-mark");
    expect(rule.slice(0, rule.indexOf("}") + 200)).toContain("var(--xms-ink)");
    // A link in a cell stays the link colour.
    expect(scope).toContain(".xms-scope table :is(th, td) :is(a, a *)");
  });
});
