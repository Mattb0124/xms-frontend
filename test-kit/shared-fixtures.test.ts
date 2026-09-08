// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A test file may not import another test file.
 *
 * Vitest registers every suite in a module the moment it is imported, so a
 * fixture imported out of `redux/timeApi.test.ts` re-ran that file's own
 * `describe` blocks inside the importer. Fifty-seven files did it, and the
 * reported total (1744) counted the same assertions over and over.
 *
 * The fixtures therefore live in `test-kit/*`, which holds no suite at all,
 * and this scan keeps them there: no `*.test.*` file imports another, and no
 * module inside `test-kit` that is meant to be imported declares a suite.
 */
const IGNORED = new Set(["node_modules", ".next", ".git", "test-results", "playwright-report", "coverage"]);

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (IGNORED.has(entry.name)) return [];
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walk(path);
    return /\.(ts|tsx|mts|js|mjs)$/.test(entry.name) ? [path] : [];
  });
}

const relative = (file: string) =>
  file
    .slice(process.cwd().length + 1)
    .split(sep)
    .join("/");

const isTestFile = (path: string) => /\.test\.[a-z]+$/.test(path);

/** Every module specifier the file imports or re-exports from. */
export function specifiersOf(source: string): string[] {
  return [...source.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((match) => match[1]);
}

/** The specifiers that name another test file (a bare or aliased path ending in `.test`). */
export function testImports(source: string): string[] {
  return specifiersOf(source).filter((specifier) => /\.test$/.test(specifier) || /\.test\.[a-z]+$/.test(specifier));
}

// This scan carries a sample of the shape it refuses, so it leaves itself out.
const SELF = "test-kit/shared-fixtures.test.ts";
const files = walk(process.cwd()).filter((file) => relative(file) !== SELF);

describe("fixtures are shared through test-kit, never through another test file", () => {
  it("finds the test files and the test-kit modules", () => {
    expect(files.filter(isTestFile).length).toBeGreaterThan(100);
    expect(files.filter((file) => relative(file).startsWith("test-kit/")).length).toBeGreaterThan(5);
  });

  it("no test file imports another test file", () => {
    const offenders = files
      .filter(isTestFile)
      .flatMap((file) =>
        testImports(readFileSync(file, "utf8")).map((specifier) => `${relative(file)} -> ${specifier}`),
      );
    expect(offenders).toEqual([]);
  });

  it("no source file imports a test file either", () => {
    const offenders = files
      .filter((file) => !isTestFile(file))
      .flatMap((file) =>
        testImports(readFileSync(file, "utf8")).map((specifier) => `${relative(file)} -> ${specifier}`),
      );
    expect(offenders).toEqual([]);
  });

  it("declares no suite in a test-kit module that is meant to be imported", () => {
    const offenders = files
      .filter((file) => relative(file).startsWith("test-kit/") && !isTestFile(file))
      .filter((file) => /^\s*(describe|it|test)\(/m.test(readFileSync(file, "utf8")))
      .map(relative);
    expect(offenders).toEqual([]);
  });

  it("reads a cross-test import out of a source sample", () => {
    expect(testImports(`import { aBucket } from "@/redux/timeApi.test";`)).toEqual(["@/redux/timeApi.test"]);
    expect(testImports(`import { aBucket } from "@/test-kit/time";`)).toEqual([]);
  });
});
