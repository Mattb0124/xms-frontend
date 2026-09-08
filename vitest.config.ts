import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Unit and component tests. Every *.test.ts(x) under the app is discovered;
// there is no hand-maintained allowlist (the AIX web-ui one silently skipped files).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Many jsdom files run in parallel; a component test that takes 2 s on its
    // own can exceed the 5 s default under that load. The gate must fail on
    // real breakage, never on scheduling.
    testTimeout: 20_000,
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**", "e2e/**"],
    coverage: { provider: "v8", reporter: ["text", "lcov"] },
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
});
