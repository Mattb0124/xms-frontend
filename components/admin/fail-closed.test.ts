// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Review finding 25: /admin/users fired GET /v1/admin/users and took a 403
 * before rendering its refusal, while /admin gated correctly without
 * calling. The needless denial writes a security event for a question the
 * browser had already answered.
 *
 * The rule, applied to the source rather than screen by screen: the
 * component that renders <AdminGate> may not call a query hook. The data
 * belongs in a child the gate mounts only once the permission is held, so
 * every screen fails closed without asking.
 */
function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walk(path);
    return entry.name === "page.tsx" ? [path] : [];
  });
}

const relative = (file: string) =>
  file
    .slice(process.cwd().length + 1)
    .split(sep)
    .join("/");

const FUNCTION_START = /^(?:export default )?function [A-Za-z]/;
const QUERY_HOOK = /\buse[A-Z]\w*Query\(/;

/**
 * The query hooks called inside the same function body that renders
 * <AdminGate>. A body runs from its `function` line to the next one at the
 * top level of the file.
 */
export function queriesBesideTheGate(source: string): string[] {
  const lines = source.split("\n");
  const starts = lines.flatMap((line, index) => (FUNCTION_START.test(line) ? [index] : []));
  const found: string[] = [];
  for (const [order, start] of starts.entries()) {
    const end = starts[order + 1] ?? lines.length;
    const body = lines.slice(start, end);
    if (!body.some((line) => line.includes("<AdminGate"))) continue;
    for (const line of body) {
      const match = QUERY_HOOK.exec(line);
      if (match) found.push(match[0].slice(0, -1));
    }
  }
  return found;
}

describe("every gated screen fails closed without asking", () => {
  const pages = walk(join(process.cwd(), "app"));

  it("finds the gated screens", () => {
    expect(pages.length).toBeGreaterThan(20);
    expect(pages.filter((file) => readFileSync(file, "utf8").includes("<AdminGate")).length).toBeGreaterThan(10);
  });

  it("never calls a query hook in the component that renders the gate", () => {
    const offenders = pages.flatMap((file) => {
      const hooks = queriesBesideTheGate(readFileSync(file, "utf8"));
      return hooks.length > 0 ? [`${relative(file)}: ${hooks.join(", ")}`] : [];
    });
    expect(offenders).toEqual([]);
  });

  it("recognizes the shape the review objected to", () => {
    const source = [
      "export default function AdminUsersPage() {",
      "  const { data } = useListUsersQuery();",
      "  return (",
      '    <AdminGate permission="admin:users">',
      "      <DenseTable rows={data} />",
      "    </AdminGate>",
      "  );",
      "}",
    ].join("\n");
    expect(queriesBesideTheGate(source)).toEqual(["useListUsersQuery"]);

    const fixed = [
      "function UsersList() {",
      "  const { data } = useListUsersQuery();",
      "  return <DenseTable rows={data} />;",
      "}",
      "export default function AdminUsersPage() {",
      "  return (",
      '    <AdminGate permission="admin:users">',
      "      <UsersList />",
      "    </AdminGate>",
      "  );",
      "}",
    ].join("\n");
    expect(queriesBesideTheGate(fixed)).toEqual([]);
  });
});
