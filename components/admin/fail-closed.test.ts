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

/**
 * The second rule, from the 2026-09-08 backend change that moved the
 * contracts, rate cards, budget, account time and billing period routes off
 * `tickets:view` and onto the new `contracts:view` (which Consultants and
 * Dispatchers do not hold): a surface that reads one of those routes may not
 * gate itself on a weaker permission. A screen that did would ask a question
 * the browser had already answered, take the 403 and write the security
 * event, exactly the shape finding 25 objected to.
 *
 * The table below is the map, and it is closed at both ends: every hook that
 * reads a contracts:view route is listed with the route it calls, and every
 * file outside the API slices that calls one of those hooks must appear with
 * the permission it gates on, or with the surface whose gate already covers
 * it. A new screen reading the budget cannot ship gated on tickets:view.
 */
const SOURCE_ROOTS = ["app", "components", "lib", "redux"];

/** Each contracts:view route (backend test/golden/routes.json), the hook that reads it and the slice it lives in. */
const CONTRACTS_VIEW_READS = [
  { hook: "useListAccountContractsQuery", slice: "redux/ticketsApi.ts", route: "/v1/accounts/${accountId}/contracts" },
  { hook: "useCompTimeQuery", slice: "redux/timeApi.ts", route: "/v1/accounts/${accountId}/time/comp-time" },
  { hook: "useAccountBudgetQuery", slice: "redux/timeApi.ts", route: "/v1/accounts/${accountId}/budget" },
  {
    hook: "useBudgetEntriesQuery",
    slice: "redux/timeApi.ts",
    route: "/v1/accounts/${filter.accountId}/budget/entries",
  },
  { hook: "useRateCardsQuery", slice: "redux/timeApi.ts", route: "/v1/accounts/${accountId}/rate-cards" },
  { hook: "useBillingPeriodsQuery", slice: "redux/timeApi.ts", route: "/v1/accounts/${accountId}/billing-periods" },
  { hook: "useListEngagementsQuery", slice: "redux/ticketsApi.ts", route: "/v1/accounts/${accountId}/engagements" },
];

/**
 * Every surface that calls one of those hooks. `permission` is the key its
 * own gate holds the read behind; `mountedIn` names the surface whose gate
 * runs first, for a child that is never rendered on its own.
 */
const CONTRACT_SURFACES: { file: string; permission?: string; mountedIn?: string }[] = [
  { file: "components/time/budget-view.tsx", permission: "contracts:view" },
  { file: "components/time/budget-entries.tsx", mountedIn: "components/time/budget-view.tsx" },
  { file: "components/time/comp-time-panel.tsx", permission: "contracts:view" },
  { file: "components/admin/billing/billing-periods-tab.tsx", permission: "contracts:view" },
  { file: "components/admin/contracts/account-contracts-tab.tsx", permission: "contracts:view" },
  {
    file: "components/admin/contracts/rate-cards.tsx",
    mountedIn: "components/admin/contracts/account-contracts-tab.tsx",
  },
  { file: "components/admin/contracts/engagements-panel.tsx", permission: "contracts:view" },
  // The account dashboard's header chips: they read the engagements route, so
  // they hold their own contracts:view gate and never the screen's weaker one.
  { file: "components/admin/contracts/renewal-chip.tsx", permission: "contracts:view" },
  { file: "components/admin/finance/finance-tab.tsx", permission: "contracts:view" },
  { file: "components/tickets/properties-panel.tsx", permission: "contracts:view" },
  { file: "components/tickets/time-tab.tsx", permission: "contracts:view" },
  { file: "app/(internal)/tickets/new/page.tsx", permission: "contracts:view" },
];

/**
 * The contracts:view routes no client screen reads yet: the account time
 * list and a contract's periods. Nothing may build these URLs without
 * landing in the table above.
 */
const NOT_READ_YET = [
  { name: "the account time list", pattern: /\/v1\/accounts\/\$\{[^}]+\}\/time[`"'?]/ },
  { name: "the contract periods", pattern: /\/contracts\/\$\{[^}]+\}\/periods/ },
];

/** The permission the ticket record's contract card keeps: its route stayed on tickets:view. */
const TICKETS_VIEW_SURFACE = { file: "components/tickets/contract-card.tsx", hook: "useContractPositionQuery" };

function sources(): string[] {
  const collect = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return collect(path);
      return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
    });
  return SOURCE_ROOTS.flatMap((root) => collect(join(process.cwd(), root)));
}

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("a surface reading a contracts:view route gates on contracts:view", () => {
  it("pins each hook to the route it reads", () => {
    for (const { hook, slice, route } of CONTRACTS_VIEW_READS) {
      const source = read(slice);
      expect(source, `${slice} no longer exports ${hook}`).toContain(hook);
      expect(source, `${hook} no longer reads ${route}`).toContain(route);
    }
  });

  it("lists every file that calls one of those hooks", () => {
    const hooks = CONTRACTS_VIEW_READS.map((entry) => entry.hook);
    const listed = new Set(CONTRACT_SURFACES.map((surface) => surface.file));
    const callers = sources()
      .filter((file) => hooks.some((hook) => readFileSync(file, "utf8").includes(`${hook}(`)))
      .map(relative);
    expect(callers.length).toBeGreaterThan(0);
    expect(callers.filter((file) => !listed.has(file))).toEqual([]);
    expect([...listed].filter((file) => !callers.includes(file))).toEqual([]);
  });

  it("holds each listed surface behind contracts:view and never behind a weaker key", () => {
    const gates = new Set(CONTRACT_SURFACES.filter((surface) => surface.permission).map((surface) => surface.file));
    for (const surface of CONTRACT_SURFACES) {
      const source = read(surface.file);
      if (surface.mountedIn) {
        expect(gates, `${surface.file} names a parent that gates nothing`).toContain(surface.mountedIn);
        continue;
      }
      expect(source, `${surface.file} does not gate on ${surface.permission}`).toContain(
        `hasPermission("${surface.permission}")`,
      );
      expect(source, `${surface.file} still gates a contracts:view read on tickets:view`).not.toContain(
        'hasPermission("tickets:view")',
      );
    }
  });

  it("keeps the contract position, and the card that reads it, on tickets:view", () => {
    const source = read(TICKETS_VIEW_SURFACE.file);
    expect(source).toContain(TICKETS_VIEW_SURFACE.hook);
    expect(read("redux/timeApi.ts")).toContain("/v1/accounts/${accountId}/contracts/${contractId}/position");
    expect(CONTRACT_SURFACES.map((surface) => surface.file)).not.toContain(TICKETS_VIEW_SURFACE.file);
  });

  it("reaches no contracts:view route that has no screen yet", () => {
    const offenders = sources().flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return NOT_READ_YET.filter((route) => route.pattern.test(source)).map(
        (route) => `${relative(file)} reads ${route.name}`,
      );
    });
    expect(offenders).toEqual([]);
  });
});

/**
 * The same map for the connector's outbound queue, which the API answers to
 * `admin:connectors` alone (backend test/golden/routes.json). The queue names
 * ticket keys and the errors a client instance returned, so a surface reading
 * it may not ship behind a weaker key or with no gate above it at all.
 */
const OUTBOUND_READS = [
  { hook: "useListOutboundQuery", slice: "redux/connectorsApi.ts", route: "/v1/connectors/${id}/outbound" },
  {
    hook: "useRetryOutboundMutation",
    slice: "redux/connectorsApi.ts",
    route: "/v1/connectors/${id}/outbound/${outboundId}/retry",
  },
];

const OUTBOUND_SURFACES: { file: string; permission?: string; mountedIn?: string }[] = [
  { file: "components/admin/connectors/outbound-tab.tsx", mountedIn: "app/(internal)/admin/connectors/[id]/page.tsx" },
  { file: "app/(internal)/admin/connectors/[id]/page.tsx", permission: "admin:connectors" },
];

describe("the outbound queue is read behind admin:connectors", () => {
  it("pins each hook to the route it reads", () => {
    for (const { hook, slice, route } of OUTBOUND_READS) {
      const source = read(slice);
      expect(source, `${slice} no longer exports ${hook}`).toContain(hook);
      expect(source, `${hook} no longer reads ${route}`).toContain(route);
    }
  });

  it("lists every file that calls one of those hooks", () => {
    const hooks = OUTBOUND_READS.map((entry) => entry.hook);
    const listed = new Set(OUTBOUND_SURFACES.map((surface) => surface.file));
    const callers = sources()
      .filter((file) => hooks.some((hook) => readFileSync(file, "utf8").includes(`${hook}(`)))
      .map(relative);
    expect(callers.length).toBeGreaterThan(0);
    expect(callers.filter((file) => !listed.has(file))).toEqual([]);
  });

  it("mounts the queue only inside a screen that gates on admin:connectors", () => {
    const gates = new Set(OUTBOUND_SURFACES.filter((surface) => surface.permission).map((surface) => surface.file));
    for (const surface of OUTBOUND_SURFACES) {
      const source = read(surface.file);
      if (surface.mountedIn) {
        expect(gates, `${surface.file} names a parent that gates nothing`).toContain(surface.mountedIn);
        continue;
      }
      expect(source, `${surface.file} does not gate on ${surface.permission}`).toContain(
        `<AdminGate permission="${surface.permission}">`,
      );
    }
  });
});

/**
 * The same map for the account's contacts (CP-07, Client Portal technical
 * 2.1), which the API answers to `admin:accounts` alone (backend
 * test/golden/routes.json). The list names every person the account writes
 * to with their address, and the flags decide who receives the quarterly
 * relationship survey, so a surface reading it may not ship behind a weaker
 * key or with no gate above it at all.
 */
const CONTACTS_READS = [
  { hook: "useListContactsQuery", slice: "redux/adminApi.ts", route: "/v1/admin/accounts/${accountId}/contacts" },
  {
    hook: "useSetContactFlagsMutation",
    slice: "redux/adminApi.ts",
    route: "/v1/admin/accounts/${accountId}/contacts/${id}/flags",
  },
];

const CONTACTS_SURFACES: { file: string; permission?: string; mountedIn?: string }[] = [
  { file: "components/admin/contacts-tab.tsx", mountedIn: "app/(internal)/admin/accounts/[id]/page.tsx" },
  { file: "app/(internal)/admin/accounts/[id]/page.tsx", permission: "admin:accounts" },
];

describe("the account's contacts are read behind admin:accounts", () => {
  it("pins each hook to the route it reads", () => {
    for (const { hook, slice, route } of CONTACTS_READS) {
      const source = read(slice);
      expect(source, `${slice} no longer exports ${hook}`).toContain(hook);
      expect(source, `${hook} no longer reads ${route}`).toContain(route);
    }
  });

  it("lists every file that calls one of those hooks", () => {
    const hooks = CONTACTS_READS.map((entry) => entry.hook);
    const listed = new Set(CONTACTS_SURFACES.map((surface) => surface.file));
    const callers = sources()
      .filter((file) => hooks.some((hook) => readFileSync(file, "utf8").includes(`${hook}(`)))
      .map(relative);
    expect(callers.length).toBeGreaterThan(0);
    expect(callers.filter((file) => !listed.has(file))).toEqual([]);
  });

  it("mounts the contacts tab only inside a screen that gates on admin:accounts", () => {
    const gates = new Set(CONTACTS_SURFACES.filter((surface) => surface.permission).map((surface) => surface.file));
    for (const surface of CONTACTS_SURFACES) {
      const source = read(surface.file);
      if (surface.mountedIn) {
        expect(gates, `${surface.file} names a parent that gates nothing`).toContain(surface.mountedIn);
        continue;
      }
      expect(source, `${surface.file} does not gate on ${surface.permission}`).toContain(
        `<AdminGate permission="${surface.permission}">`,
      );
    }
  });
});

/**
 * The same map for the three analytics surfaces, which the API answers to
 * `audit:read` and `analytics:read` (backend test/golden/routes.json). The
 * audit search reads every event of every request, the Security dashboard
 * names the actors the guard turned away, and the Usage dashboard reads the
 * window one account at a time, so none of the three may ship behind a
 * weaker key or with no gate above it at all. The permission differs by
 * route, so each surface carries its own here rather than one for the set.
 */
const ANALYTICS_READS = [
  { hook: "useLazyAuditSearchQuery", slice: "redux/reportingApi.ts", route: "/v1/audit/search" },
  { hook: "useSecurityDashboardQuery", slice: "redux/reportingApi.ts", route: "/v1/dashboards/security" },
  { hook: "useUsageDashboardQuery", slice: "redux/reportingApi.ts", route: "/v1/dashboards/usage" },
];

const ANALYTICS_SURFACES: { file: string; permission?: string; mountedIn?: string }[] = [
  { file: "components/admin/audit-search.tsx", mountedIn: "app/(internal)/admin/audit/page.tsx" },
  { file: "app/(internal)/admin/audit/page.tsx", permission: "audit:read" },
  { file: "components/admin/security-dashboard.tsx", mountedIn: "app/(internal)/admin/security/page.tsx" },
  { file: "app/(internal)/admin/security/page.tsx", permission: "audit:read" },
  { file: "components/admin/usage-dashboard.tsx", mountedIn: "app/(internal)/admin/usage/page.tsx" },
  { file: "app/(internal)/admin/usage/page.tsx", permission: "analytics:read" },
];

describe("the audit search and the two analytics dashboards fail closed", () => {
  it("pins each hook to the route it reads", () => {
    for (const { hook, slice, route } of ANALYTICS_READS) {
      const source = read(slice);
      expect(source, `${slice} no longer exports ${hook}`).toContain(hook);
      expect(source, `${hook} no longer reads ${route}`).toContain(route);
    }
  });

  it("lists every file that calls one of those hooks", () => {
    const hooks = ANALYTICS_READS.map((entry) => entry.hook);
    const listed = new Set(ANALYTICS_SURFACES.map((surface) => surface.file));
    const callers = sources()
      .filter((file) => hooks.some((hook) => readFileSync(file, "utf8").includes(`${hook}(`)))
      .map(relative);
    expect(callers.length).toBeGreaterThan(0);
    expect(callers.filter((file) => !listed.has(file))).toEqual([]);
  });

  it("mounts each surface only inside a screen that gates on its own permission", () => {
    const gates = new Set(ANALYTICS_SURFACES.filter((surface) => surface.permission).map((surface) => surface.file));
    for (const surface of ANALYTICS_SURFACES) {
      const source = read(surface.file);
      if (surface.mountedIn) {
        expect(gates, `${surface.file} names a parent that gates nothing`).toContain(surface.mountedIn);
        continue;
      }
      expect(source, `${surface.file} does not gate on ${surface.permission}`).toContain(
        `<AdminGate permission="${surface.permission}">`,
      );
    }
  });

  it("keeps the Usage dashboard on analytics:read and never on audit:read", () => {
    const usage = read("app/(internal)/admin/usage/page.tsx");
    expect(usage).toContain('<AdminGate permission="analytics:read">');
    expect(usage).not.toContain("audit:read");
  });
});
