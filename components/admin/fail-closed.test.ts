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

/**
 * Every source file under the four roots, walked and read once for the whole
 * file. Four permission maps scan the same tree, and re-walking and re-reading
 * it per map is what pushed this spec past its timeout on a loaded machine.
 */
let walked: string[] | undefined;
const contents = new Map<string, string>();

function sources(): string[] {
  if (walked) return walked;
  const collect = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return collect(path);
      return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
    });
  walked = SOURCE_ROOTS.flatMap((root) => collect(join(process.cwd(), root)));
  return walked;
}

function sourceOf(path: string): string {
  const cached = contents.get(path);
  if (cached !== undefined) return cached;
  const text = readFileSync(path, "utf8");
  contents.set(path, text);
  return text;
}

/** The files calling any of the named hooks, as repository-relative paths. */
function callersOf(hooks: readonly string[]): string[] {
  return sources()
    .filter((file) => hooks.some((hook) => sourceOf(file).includes(`${hook}(`)))
    .map(relative);
}

const read = (path: string) => sourceOf(join(process.cwd(), path));

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
    const callers = callersOf(hooks);
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
      const source = sourceOf(file);
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
    const callers = callersOf(hooks);
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
 * The same map for the Queue's saved views (Ticket Management technical 2.5),
 * which the API answers to `tickets:view` (backend test/golden/routes.json).
 * That is the Queue's own gate, so the map exists to keep it that way: a view
 * carries a condition set over one account's tickets, and a surface that
 * started reading or writing one from outside the Queue would have to hold
 * the same key rather than none at all.
 */
const SAVED_VIEW_READS = [
  { hook: "useListSavedViewsQuery", slice: "redux/ticketsApi.ts", route: '"/v1/views"' },
  { hook: "useCreateSavedViewMutation", slice: "redux/ticketsApi.ts", route: 'url: "/v1/views", method: "POST"' },
  { hook: "usePatchSavedViewMutation", slice: "redux/ticketsApi.ts", route: "/v1/views/${id}" },
  { hook: "useDeleteSavedViewMutation", slice: "redux/ticketsApi.ts", route: "/v1/views/${id}" },
];

const SAVED_VIEW_SURFACES: { file: string; permission?: string; mountedIn?: string }[] = [
  { file: "components/tickets/saved-views.tsx", mountedIn: "app/(internal)/tickets/page.tsx" },
  { file: "app/(internal)/tickets/page.tsx", permission: "tickets:view" },
];

describe("saved views are read and written behind tickets:view", () => {
  it("pins each hook to the route it reads", () => {
    for (const { hook, slice, route } of SAVED_VIEW_READS) {
      const source = read(slice);
      expect(source, `${slice} no longer exports ${hook}`).toContain(hook);
      expect(source, `${hook} no longer reads ${route}`).toContain(route);
    }
  });

  it("lists every file that calls one of those hooks", () => {
    const hooks = SAVED_VIEW_READS.map((entry) => entry.hook);
    const listed = new Set(SAVED_VIEW_SURFACES.map((surface) => surface.file));
    const callers = callersOf(hooks);
    expect(callers.length).toBeGreaterThan(0);
    expect(callers.filter((file) => !listed.has(file))).toEqual([]);
  });

  it("mounts the saved views only inside a screen that gates on tickets:view", () => {
    const gates = new Set(SAVED_VIEW_SURFACES.filter((surface) => surface.permission).map((surface) => surface.file));
    for (const surface of SAVED_VIEW_SURFACES) {
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
    const callers = callersOf(hooks);
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
  // The saved queries of the audit search (backend 1b7bc74). Every one of the
  // five routes stands on audit:read, the same key the search itself takes,
  // and a saved query names the conditions of a search over every event of
  // every request, so none of them may ship behind a weaker key.
  { hook: "useAuditSavedQueriesQuery", slice: "redux/reportingApi.ts", route: '"/v1/audit/saved-queries"' },
  {
    hook: "useCreateAuditSavedQueryMutation",
    slice: "redux/reportingApi.ts",
    route: 'url: "/v1/audit/saved-queries", method: "POST"',
  },
  {
    hook: "usePatchAuditSavedQueryMutation",
    slice: "redux/reportingApi.ts",
    route: "/v1/audit/saved-queries/${id}",
  },
  {
    hook: "useDeleteAuditSavedQueryMutation",
    slice: "redux/reportingApi.ts",
    route: "/v1/audit/saved-queries/${id}",
  },
  { hook: "useRunAuditSavedQueryMutation", slice: "redux/reportingApi.ts", route: "/v1/audit/saved-queries/${id}/run" },
  { hook: "useSecurityDashboardQuery", slice: "redux/reportingApi.ts", route: "/v1/dashboards/security" },
  // The integrity panel's own route (backend cecce62), answered to audit:read
  // like the dashboard beside it: it names the digest chain, what is in cold
  // storage and how far back this reader's events go.
  { hook: "useSecurityIntegrityQuery", slice: "redux/reportingApi.ts", route: "/v1/dashboards/security/integrity" },
  { hook: "useUsageDashboardQuery", slice: "redux/reportingApi.ts", route: "/v1/dashboards/usage" },
];

const ANALYTICS_SURFACES: { file: string; permission?: string; mountedIn?: string }[] = [
  { file: "components/admin/audit-search.tsx", mountedIn: "app/(internal)/admin/audit/page.tsx" },
  { file: "components/admin/saved-queries.tsx", mountedIn: "app/(internal)/admin/audit/page.tsx" },
  { file: "app/(internal)/admin/audit/page.tsx", permission: "audit:read" },
  { file: "components/admin/security-dashboard.tsx", mountedIn: "app/(internal)/admin/security/page.tsx" },
  { file: "components/admin/integrity-panel.tsx", mountedIn: "app/(internal)/admin/security/page.tsx" },
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
    const callers = callersOf(hooks);
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

/**
 * The same map for review before send (Dashboards functional 5.8, DR-05),
 * which the API answers to `reports:manage` alone (backend
 * test/golden/routes.json). The five routes read, rewrite and decide an
 * unsent report pack: the run detail carries the frozen pack and a presigned
 * link to each rendition, the narrative edit rewrites the words a client will
 * read, regenerate rebuilds both files, approve mails the pack to a client,
 * and cancel stops it. None of that may ship behind a weaker key or with no
 * gate above it at all, and the account's Report packs tab, which links held
 * runs here, holds the same key on its own body.
 */
const REVIEW_READS = [
  { hook: "useReviewRunQuery", slice: "redux/reportingApi.ts", route: "/v1/reporting/runs/${id}" },
  { hook: "useEditRunNarrativeMutation", slice: "redux/reportingApi.ts", route: "/v1/reporting/runs/${id}/narrative" },
  {
    hook: "useRegenerateReportRunMutation",
    slice: "redux/reportingApi.ts",
    route: "/v1/reporting/runs/${id}/regenerate",
  },
  { hook: "useApproveReportRunMutation", slice: "redux/reportingApi.ts", route: "/v1/reporting/runs/${id}/approve" },
  { hook: "useCancelReportRunMutation", slice: "redux/reportingApi.ts", route: "/v1/reporting/runs/${id}/cancel" },
];

const REVIEW_SURFACES: { file: string; permission?: string; mountedIn?: string }[] = [
  { file: "components/reporting/run-review.tsx", mountedIn: "app/(internal)/reports/runs/[id]/page.tsx" },
  { file: "app/(internal)/reports/runs/[id]/page.tsx", permission: "reports:manage" },
];

describe("a held report run is read and decided behind reports:manage", () => {
  it("pins each hook to the route it reads", () => {
    for (const { hook, slice, route } of REVIEW_READS) {
      const source = read(slice);
      expect(source, `${slice} no longer exports ${hook}`).toContain(hook);
      expect(source, `${hook} no longer reads ${route}`).toContain(route);
    }
  });

  it("lists every file that calls one of those hooks", () => {
    const hooks = REVIEW_READS.map((entry) => entry.hook);
    const listed = new Set(REVIEW_SURFACES.map((surface) => surface.file));
    const callers = callersOf(hooks);
    expect(callers.length).toBeGreaterThan(0);
    expect(callers.filter((file) => !listed.has(file))).toEqual([]);
  });

  it("mounts the review screen only inside a gate on reports:manage", () => {
    const gates = new Set(REVIEW_SURFACES.filter((surface) => surface.permission).map((surface) => surface.file));
    for (const surface of REVIEW_SURFACES) {
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

  it("registers the review screen on reports:manage, so no weaker reader is offered the link", () => {
    const routes = read("lib/routes.ts");
    expect(routes).toContain('path: "/reports/runs/[id]"');
    expect(routes).toMatch(/screen: "report_run",[\s\S]*?permission: "reports:manage"/);
    // The account's Report packs tab links held runs here and refuses to read
    // anything without the same key.
    expect(read("components/admin/reports/report-schedules-tab.tsx")).toContain('hasPermission("reports:manage")');
  });
});
