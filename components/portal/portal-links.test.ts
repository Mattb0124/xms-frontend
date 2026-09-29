// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Review finding 18: /portal/me was a hard 404 ("This page could not be
 * found"), yet the chrome special-cased it and the user menu was the obvious
 * route to it. The chrome no longer offers it, and this holds the whole
 * portal to the rule rather than that one address: every link the portal
 * offers must resolve to a page that exists.
 */
function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walk(path);
    return /\.tsx$/.test(entry.name) ? [path] : [];
  });
}

const posix = (path: string) => path.split(sep).join("/");

/** Every portal route the app router serves, "/portal/requests/[key]" included. */
export function portalRoutes(root: string): string[] {
  return walk(root)
    .filter((file) => file.endsWith(`${sep}page.tsx`))
    .map((file) => posix(file.slice(root.length)).replace(/\/page\.tsx$/, ""))
    .map((route) => `/portal${route.replace(/^\/portal/, "")}`)
    .sort();
}

/** Does a literal href land on one of the routes, a dynamic segment matching anything? */
export function resolves(href: string, routes: string[]): boolean {
  const parts = href.split("/");
  return routes.some((route) => {
    const shape = route.split("/");
    if (shape.length !== parts.length) return false;
    return shape.every((segment, index) => /^\[.+\]$/.test(segment) || segment === parts[index]);
  });
}

const ROOT = join(process.cwd(), "app", "(portal)", "portal");
const ROUTES = portalRoutes(ROOT);

describe("the portal offers no dead links", () => {
  it("reads the portal's routes", () => {
    expect(ROUTES).toContain("/portal");
    expect(ROUTES).toContain("/portal/requests/[key]");
    expect(ROUTES).not.toContain("/portal/me");
  });

  it("matches a literal href against a dynamic route", () => {
    expect(resolves("/portal/requests/CS1000199", ROUTES)).toBe(true);
    expect(resolves("/portal/me", ROUTES)).toBe(false);
    expect(resolves("/portal/requests", ROUTES)).toBe(true);
  });

  it("points every portal link at a page that exists", () => {
    const sources = [...walk(ROOT), ...walk(join(process.cwd(), "components", "portal"))].filter(
      (file) => !/\.test\.tsx$/.test(file),
    );
    const dead: string[] = [];
    for (const file of sources) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/href[=:]\s*"(\/portal[^"]*)"/g)) {
        const href = match[1].split("?")[0];
        if (!resolves(href, ROUTES)) dead.push(`${posix(file.slice(process.cwd().length + 1))}: ${href}`);
      }
    }
    expect(dead).toEqual([]);
  });
});
