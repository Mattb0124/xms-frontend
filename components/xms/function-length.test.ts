// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * A component or hook stays under 200 lines (`.cursor/rules/react-typescript.mdc`).
 * The names below were already over that line when the gate landed. A name
 * leaves the list once the function is shorter. A function that is not listed
 * may not reach the limit, and a listed one may not grow.
 */
const LIMIT = 200;

const ALLOWED = new Map<string, number>([
  ["app/(internal)/cases/[key]/page.tsx:TicketRecord", 202],
  ["components/admin/account-settings-tab.tsx:AccountSettingsTab", 323],
  ["components/admin/api-clients/api-clients-view.tsx:ApiClientsView", 253],
  ["components/admin/billing/billing-periods-tab.tsx:BillingPeriodsTab", 237],
  ["components/admin/calendars/calendar-editor.tsx:CalendarEditor", 242],
  ["components/admin/contracts/account-contracts-tab.tsx:ContractRulesEditor", 241],
  ["components/admin/forms/ticket-forms-panel.tsx:FieldEditor", 229],
  ["components/admin/mcp/library-panel.tsx:McpLibraryPanel", 231],
  ["components/admin/saved-queries.tsx:SavedQueriesPanel", 226],
  ["components/admin/security-dashboard.tsx:SecurityDashboard", 234],
  ["components/admin/webhooks/webhooks-tab.tsx:AccountWebhooksTab", 253],
  ["components/tickets/case-form.tsx:CaseForm", 305],
  ["components/tickets/saved-views.tsx:SavedViewsBar", 320],
  ["components/tickets/ticket-groups.tsx:TicketGroupsCatalog", 200],
  ["components/tickets/transition-menu.tsx:TransitionMenu", 259],
]);

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walk(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const relative = (file: string) =>
  file
    .slice(process.cwd().length + 1)
    .split(sep)
    .join("/");

function counted(name: string): boolean {
  return /^[A-Z]/.test(name) || /^use[A-Z]/.test(name);
}

function lineCount(sourceFile: ts.SourceFile, node: ts.Node): number {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile, false)).line;
  const end = sourceFile.getLineAndCharacterOfPosition(node.end).line;
  return end - start + 1;
}

function functionsIn(file: string): { key: string; lines: number }[] {
  const source = readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found: { key: string; lines: number }[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name && node.body && counted(node.name.text)) {
      found.push({ key: `${relative(file)}:${node.name.text}`, lines: lineCount(sourceFile, node) });
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      counted(node.name.text) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) {
      found.push({ key: `${relative(file)}:${node.name.text}`, lines: lineCount(sourceFile, node) });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function overLimit(): string[] {
  const roots = ["app", "components", "lib", "redux"].map((dir) => join(process.cwd(), dir));
  return roots
    .flatMap((root) => walk(root))
    .flatMap((file) => functionsIn(file))
    .filter((entry) => entry.lines >= LIMIT)
    .map((entry) => `${entry.key} ${entry.lines}`)
    .sort();
}

describe("component functions stay under 200 lines", () => {
  it("matches the allowlist exactly", () => {
    const live = overLimit();
    const allowed = [...ALLOWED.entries()].map(([key, lines]) => `${key} ${lines}`).sort();
    expect(live).toEqual(allowed);
  });
});
