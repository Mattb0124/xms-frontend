// Fails the pipeline gate if next.config.ts suppresses type or lint errors.
// The XMS build fails on either; there is no flag to skip this (ADR-09).
// Comments are stripped first so the rule can be documented in the config.
import { readFileSync } from "node:fs";

const raw = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
const source = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const forbidden = ["ignoreBuildErrors", "ignoreDuringBuilds"];
const found = forbidden.filter((flag) => source.includes(flag));

if (found.length > 0) {
  console.error(`next.config.ts must not use: ${found.join(", ")}`);
  process.exit(1);
}
console.log("next.config.ts: no suppression flags");
