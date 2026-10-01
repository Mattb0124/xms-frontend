import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    linterOptions: { reportUnusedDisableDirectives: "error" },
  },
  // The house rules in .cursor/rules/react-typescript.mdc, held by the linter.
  // They warn until the existing code is brought to them, then they become errors.
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-nested-ternary": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "react/no-array-index-key": "warn",
      "react/jsx-no-useless-fragment": "warn",
      "@typescript-eslint/consistent-type-imports": ["warn", { fixStyle: "inline-type-imports" }],
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}", "e2e/**", "test-kit/**"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "warn",
    },
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
