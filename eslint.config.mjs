import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const SOURCE = ["**/*.{ts,tsx}"];
const TESTS = ["**/*.test.{ts,tsx}", "e2e/**", "test-kit/**"];

const SAFE_URL_OPEN = {
  object: "window",
  property: "open",
  message: "Open an address with openExternal from lib/safe-url, which refuses anything but an ordinary web URL.",
};
const STORAGE_MESSAGE =
  "Per-browser state goes through lib/persisted-set; nothing else touches browser storage (security review finding 27).";
const STORAGE = ["localStorage", "sessionStorage"];
const STORAGE_PROPERTIES = STORAGE.map((property) => ({ object: "window", property, message: STORAGE_MESSAGE }));
const STORAGE_GLOBALS = STORAGE.map((name) => ({ name, message: STORAGE_MESSAGE }));

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // An exception to a rule is written in this file, where review sees it, never in a comment beside the code.
  {
    linterOptions: { noInlineConfig: true },
  },
  // The house rules in .cursor/rules/react-typescript.mdc and guardrails.mdc, held by the linter.
  {
    files: SOURCE,
    rules: {
      eqeqeq: ["error", "smart"],
      "no-nested-ternary": "error",
      "no-console": ["error", { allow: ["warn", "error"] }],
      "react/no-array-index-key": "error",
      "react/jsx-no-useless-fragment": "error",
      "react/no-danger": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
    },
  },
  {
    files: SOURCE,
    ignores: TESTS,
    rules: {
      "@typescript-eslint/no-non-null-assertion": "error",
      // The CSP's residual risk is bounded on there being no HTML-injection sink anywhere.
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[property.name=/^(innerHTML|outerHTML)$/]",
          message: "No HTML-injection sink: render text through React.",
        },
        {
          selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
          message: "No HTML-injection sink: render text through React.",
        },
      ],
      "no-restricted-properties": ["error", SAFE_URL_OPEN, ...STORAGE_PROPERTIES],
      "no-restricted-globals": ["error", ...STORAGE_GLOBALS],
    },
  },
  // A screen reads the API through redux/ and its configuration through lib/, so neither is scattered
  // through components. Route handlers and the local-only dev sign-in are server or development code.
  {
    files: ["components/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
    ignores: [...TESTS, "app/**/route.ts", "app/(internal)/dev/**"],
    rules: {
      "no-restricted-globals": [
        "error",
        ...STORAGE_GLOBALS,
        {
          name: "fetch",
          message:
            "Read the API through an RTK Query endpoint in redux/, or the helper in lib/ that owns the transfer.",
        },
      ],
      "no-restricted-properties": [
        "error",
        SAFE_URL_OPEN,
        ...STORAGE_PROPERTIES,
        {
          object: "process",
          property: "env",
          message: "Configuration is read in lib/ (auth/dev-mode, platform/config, security/csp), never in a screen.",
        },
      ],
    },
  },
  {
    files: ["lib/persisted-set.ts", "lib/auth/token.ts"],
    rules: {
      "no-restricted-properties": ["error", SAFE_URL_OPEN],
      "no-restricted-globals": "off",
    },
  },
  // The portal renders portal view models only, so a desk component cannot leak an internal field into it.
  {
    files: ["components/portal/**/*.{ts,tsx}", "app/(portal)/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/components/tickets", "@/components/tickets/*", "@/app/(internal)/*", "@/redux/ticketsApi"],
              message: "The portal renders portal view models: use components/portal and redux/portalApi.",
            },
          ],
        },
      ],
    },
  },
  // The index is the row's identity here: identical placeholder lines that never reorder, and the
  // capacity view's demand lines, which the API sends without an id and nobody edits.
  {
    files: ["components/xms/skeleton.tsx", "components/capacity/demand-overlay.tsx"],
    rules: { "react/no-array-index-key": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
