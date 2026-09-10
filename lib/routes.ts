/**
 * The route registry for the internal application: every screen declares its
 * path, a stable `screen` id (the telemetry vocabulary, Audit & Analytics
 * section 4.2), its section in the All overlay, and the permission it needs.
 * The sidebar, the finders and the command palette all read this list, and
 * they fail closed: with no permission set loaded nothing is shown
 * (User Experience section 2.1).
 */

export type Section =
  "Home" | "Cases" | "Intake" | "Knowledge" | "Time" | "Accounts" | "Capacity" | "Reports" | "Admin";

export interface Screen {
  path: string;
  screen: string;
  label: string;
  section: Section;
  /** `null` means every signed-in internal user; otherwise one permission key. */
  permission: string | null;
  /**
   * This screen's rank in the pinned sidebar, 1 nearest the top. It is a rank
   * rather than a flag because the sidebar is six rows for every reader: see
   * `PINNED_ROWS` and `pinnedScreens`.
   */
  pinned?: number;
  /** One-line purpose from the wireframe tree; shown in the All overlay. */
  purpose?: string;
}

export const SCREENS: Screen[] = [
  {
    path: "/",
    screen: "my-work",
    label: "My work",
    section: "Home",
    permission: null,
    pinned: 1,
    purpose: "Your day: scorecards, needs attention, time today.",
  },
  {
    path: "/cases",
    screen: "cases",
    label: "Cases",
    section: "Cases",
    permission: "tickets:view",
    pinned: 2,
    purpose: "The working list for everything case-shaped.",
  },
  {
    path: "/contacts/[id]",
    screen: "contact",
    label: "Contact",
    section: "Cases",
    permission: "tickets:view",
    purpose: "One contact: how to reach them, the account they belong to, what they have raised.",
  },
  {
    path: "/cases/dispatch",
    screen: "dispatch",
    label: "Dispatch",
    section: "Cases",
    permission: "tickets:work",
    pinned: 3,
    purpose: "Unassigned tickets with group and assignee pickers.",
  },
  {
    path: "/cases/quarantine",
    screen: "quarantine",
    label: "Quarantine",
    section: "Intake",
    permission: "tickets:work",
    pinned: 4,
    purpose: "Unknown senders awaiting review.",
  },
  {
    path: "/cases/groups",
    screen: "ticket_groups",
    label: "Groups",
    section: "Cases",
    permission: "tickets:view",
    pinned: 9,
    purpose: "Projects and change windows, with the schedule each one carries.",
  },
  {
    path: "/cases/change-calendar",
    screen: "change_calendar",
    label: "Change calendar",
    section: "Cases",
    permission: "tickets:view",
    purpose: "Change windows and freezes over a month, and whether work may go out right now.",
  },
  {
    path: "/cases/new",
    screen: "ticket.new",
    label: "New ticket",
    section: "Cases",
    permission: "tickets:create",
    purpose: "Full-screen record form.",
  },
  {
    path: "/cases/[key]",
    screen: "ticket",
    label: "Ticket",
    section: "Cases",
    permission: "tickets:view",
    purpose: "The record: conversation, activity, time, resolution.",
  },
  {
    path: "/knowledge",
    screen: "knowledge",
    label: "Solutions",
    section: "Knowledge",
    permission: "tickets:view",
    pinned: 7,
    purpose: "The knowledge base.",
  },
  {
    path: "/knowledge/new",
    screen: "knowledge.new",
    label: "New article",
    section: "Knowledge",
    permission: "kb:author",
    purpose: "Draft an article by hand.",
  },
  {
    path: "/knowledge/[key]",
    screen: "knowledge.article",
    label: "Article",
    section: "Knowledge",
    permission: "tickets:view",
    purpose: "The article record: sections, visibility, versions, feedback.",
  },
  {
    path: "/knowledge/review",
    screen: "solutions_review",
    label: "Review queue",
    section: "Knowledge",
    permission: "kb:publish",
    purpose: "Articles awaiting publication.",
  },
  {
    path: "/time",
    screen: "time",
    label: "My timesheet",
    section: "Time",
    permission: "time:log",
    // Render 08 and the hand-off both pin six screens: My work, Queue,
    // Dispatch, Quarantine, My timesheet, Operations.
    pinned: 5,
    purpose: "Your entries for the week.",
  },
  {
    path: "/time/team",
    screen: "team_time",
    label: "Team time",
    section: "Time",
    permission: "time:adjust",
    purpose: "Entries across your group.",
  },
  {
    path: "/accounts",
    screen: "accounts",
    label: "Accounts",
    section: "Accounts",
    permission: "tickets:view",
    pinned: 8,
    purpose: "Granted accounts and their contracts.",
  },
  {
    path: "/accounts/[id]",
    screen: "account",
    label: "Account dashboard",
    section: "Accounts",
    permission: "tickets:view",
    purpose: "One account: tiles, SLA, notable tickets, View as client, report runs.",
  },
  {
    path: "/roster",
    screen: "roster",
    label: "Roster",
    section: "Capacity",
    permission: "capacity:view",
    purpose: "People, roles, FTE, time zones, skills and certifications.",
  },
  {
    path: "/roster/[id]",
    screen: "roster.person",
    label: "Person record",
    section: "Capacity",
    permission: "capacity:view",
    purpose: "One person: details, working calendar, PTO, skills, certifications.",
  },
  {
    path: "/capacity",
    screen: "capacity",
    label: "Capacity",
    section: "Capacity",
    permission: "capacity:view",
    purpose: "The month per person: available, allocated, actual, remaining, and the allocation cells per account.",
  },
  {
    path: "/capacity/variance",
    screen: "capacity.variance",
    label: "Planned vs actual",
    section: "Capacity",
    permission: "capacity:view",
    purpose: "Planned against logged hours per person and account for a month.",
  },
  {
    path: "/capacity/skills",
    screen: "capacity.skills",
    label: "Skills matrix",
    section: "Capacity",
    permission: "capacity:view",
    purpose:
      "People against skills as a heat map; per account, the required technologies with single points of failure and gaps.",
  },
  {
    path: "/capacity/demand",
    screen: "capacity.demand",
    label: "Demand",
    section: "Capacity",
    permission: "capacity:view",
    purpose: "Pipeline and project demand by month, entered by hand or imported from the template.",
  },
  {
    path: "/operations",
    screen: "operations",
    label: "Operations",
    section: "Reports",
    permission: "reports:view-portfolio",
    pinned: 6,
    purpose: "Six tiles, four panels, one synthesis line.",
  },
  {
    path: "/reports",
    screen: "report_packs",
    label: "Report packs",
    section: "Reports",
    // The list reads /v1/reporting/runs, which the API answers to
    // reports:manage; the registry said view-portfolio, which would have
    // offered the screen to a reader the API then refused.
    permission: "reports:manage",
    purpose: "WSR and QBR runs.",
  },
  {
    path: "/reports/packs/[id]",
    screen: "report_pack",
    label: "Report pack",
    section: "Reports",
    permission: "tickets:view",
    purpose: "One pack: frozen numbers, narrative, download.",
  },
  {
    path: "/reports/runs/[id]",
    screen: "report_run",
    label: "Report review",
    section: "Reports",
    permission: "reports:manage",
    purpose: "One held run: the pack as it will go, approve and send, or cancel with a reason.",
  },
  {
    path: "/admin",
    screen: "admin",
    label: "Admin",
    section: "Admin",
    permission: "admin:accounts",
    purpose: "Accounts, users, roles, configuration, audit.",
  },
  {
    path: "/admin/accounts",
    screen: "admin.accounts",
    label: "Accounts admin",
    section: "Admin",
    permission: "admin:accounts",
    purpose: "Client accounts: identity, settings, grants, portal users.",
  },
  {
    path: "/admin/accounts/[id]",
    screen: "admin.account",
    label: "Account record",
    section: "Admin",
    permission: "admin:accounts",
    purpose: "One account: overview, settings, access.",
  },
  {
    path: "/admin/users",
    screen: "admin.users",
    label: "Users",
    section: "Admin",
    permission: "admin:users",
    purpose: "Internal and portal users, roles, grants.",
  },
  {
    path: "/admin/users/[id]",
    screen: "admin.user",
    label: "User record",
    section: "Admin",
    permission: "admin:users",
    purpose: "Profile, roles, account grants, groups.",
  },
  {
    path: "/admin/roles",
    screen: "admin.roles",
    label: "Roles",
    section: "Admin",
    permission: "admin:users",
    purpose: "Operator and portal role catalogs.",
  },
  {
    path: "/admin/roles/[id]",
    screen: "admin.role",
    label: "Role record",
    section: "Admin",
    permission: "admin:users",
    purpose: "Permission checklist with implications.",
  },
  {
    path: "/admin/groups",
    screen: "admin.groups",
    label: "Groups",
    section: "Admin",
    permission: "admin:users",
    purpose: "Assignment groups and members.",
  },
  {
    path: "/admin/groups/[id]",
    screen: "admin.group",
    label: "Group record",
    section: "Admin",
    permission: "admin:users",
    purpose: "Group identity, lead and members.",
  },
  {
    path: "/admin/api-clients",
    screen: "admin.api_clients",
    label: "API clients",
    section: "Admin",
    permission: "admin:api-clients",
    purpose: "Machine identities: scopes, granted accounts, expiry, last used, revoke.",
  },
  {
    path: "/admin/config",
    screen: "admin.config",
    label: "Configuration",
    section: "Admin",
    permission: "admin:accounts",
    purpose: "State machines, priority matrix, SLA policy, catalogs.",
  },
  {
    path: "/admin/calendars/[id]",
    screen: "admin.calendar",
    label: "Calendar",
    section: "Admin",
    permission: "admin:config",
    purpose: "One business calendar: hours, holidays, default, preview.",
  },
  {
    path: "/admin/accounts/[id]/calendars/new",
    screen: "admin.calendar.new",
    label: "New calendar",
    section: "Admin",
    permission: "admin:config",
    purpose: "A new business calendar on one account.",
  },
  {
    path: "/admin/holiday-calendars",
    screen: "admin.holiday_calendars",
    label: "Holiday libraries",
    section: "Admin",
    permission: "admin:config",
    purpose: "Country holiday sets shared by account and person calendars.",
  },
  {
    path: "/admin/connectors",
    screen: "admin.connectors",
    label: "Connectors",
    section: "Admin",
    permission: "admin:connectors",
    purpose: "Every connector instance: health, mode, backlog, dead letters.",
  },
  {
    path: "/admin/connectors/[id]",
    screen: "admin.connector",
    label: "Connector record",
    section: "Admin",
    permission: "admin:connectors",
    purpose: "One instance: settings, field and state maps, runs, dead letters.",
  },
  {
    path: "/admin/migration",
    screen: "admin.migration",
    label: "Migration",
    section: "Admin",
    permission: "admin:migration",
    purpose: "Batch loads, reconciliation against the source, sign-off.",
  },
  {
    path: "/admin/migration/new",
    screen: "admin.migration.new",
    label: "New batch",
    section: "Admin",
    permission: "admin:migration",
    purpose: "One object kind for one account: source, range, dry run.",
  },
  {
    path: "/admin/migration/[id]",
    screen: "admin.migration.batch",
    label: "Batch record",
    section: "Admin",
    permission: "admin:migration",
    purpose: "One batch: counts, run, records, log, reconciliation.",
  },
  {
    path: "/admin/audit",
    screen: "admin.audit",
    label: "Audit search",
    section: "Admin",
    permission: "audit:read",
    purpose: "Every event of every request, one search.",
  },
  {
    path: "/admin/security",
    screen: "admin.security",
    label: "Security",
    section: "Admin",
    permission: "audit:read",
    purpose: "Sign-in failures, denials, isolation probes, admin changes.",
  },
  {
    path: "/admin/usage",
    screen: "admin.usage",
    label: "Usage",
    section: "Admin",
    permission: "analytics:read",
    purpose: "Active users, actions, screens, searches with no result, API errors.",
  },
];

/**
 * The client portal registry: screen ids for telemetry only. The portal has
 * no sidebar and no permission-gated links; the API decides everything.
 */
export const PORTAL_SCREENS: Screen[] = [
  { path: "/portal", screen: "portal.home", label: "Home", section: "Home", permission: null },
  { path: "/portal/sign-in", screen: "portal.sign-in", label: "Sign in", section: "Home", permission: null },
  { path: "/portal/requests", screen: "portal.requests", label: "My requests", section: "Cases", permission: null },
  { path: "/portal/requests/new", screen: "portal.new", label: "New request", section: "Cases", permission: null },
  { path: "/portal/requests/[key]", screen: "portal.request", label: "Request", section: "Cases", permission: null },
  { path: "/portal/surveys", screen: "portal.surveys", label: "Surveys", section: "Cases", permission: null },
  { path: "/portal/surveys/[id]", screen: "portal.survey", label: "Survey", section: "Cases", permission: null },
];

export const SECTIONS: Section[] = [
  "Home",
  "Cases",
  "Intake",
  "Knowledge",
  "Time",
  "Accounts",
  "Capacity",
  "Reports",
  "Admin",
];

/**
 * Screens the principal may see. `permissions` undefined means "not loaded
 * yet" and returns nothing, so a loading shell never leaks a link.
 */
export function visibleScreens(permissions: ReadonlySet<string> | string[] | undefined): Screen[] {
  if (!permissions) return [];
  const set = permissions instanceof Set ? permissions : new Set(permissions);
  return SCREENS.filter((screen) => screen.permission === null || set.has(screen.permission));
}

/** The sidebar is this many rows for every reader (render 08). */
export const PINNED_ROWS = 6;

/**
 * The sidebar's default pins for one reader: the highest-ranked screens they
 * may open, up to `PINNED_ROWS`.
 *
 * Render 08 pins six screens, and the sixth, Operations, needs
 * `reports:view-portfolio`. A consultant does not hold it, and the pins were a
 * flag filtered by permission, so the row simply vanished and the sidebar came
 * back five rows tall with a gap where the render has a screen. A pinned row
 * that cannot be opened must not be drawn either, because a row that refuses
 * to open is worse than a row that is not there, so the pinned set is defined
 * per role instead: `pinned` is a rank, the render's six take ranks 1 to 6,
 * and Solutions, Accounts and Groups stand behind them so a reader who cannot
 * reach one of the six still gets six rows of their own work. Nothing is
 * backfilled from outside that ranked list, so no reader is given a sidebar
 * by accident.
 *
 * The footer's own number is the whole tree, `visibleScreens(...).length`,
 * which is exactly what the All overlay lists for the same reader.
 */
export function pinnedScreens(permissions: ReadonlySet<string> | string[] | undefined): Screen[] {
  return visibleScreens(permissions)
    .filter((screen) => typeof screen.pinned === "number")
    .sort((a, b) => (a.pinned ?? 0) - (b.pinned ?? 0))
    .slice(0, PINNED_ROWS);
}

/** A path carrying a dynamic segment (`/accounts/[id]`) is a pattern, not an address. */
export function isDynamicPath(path: string): boolean {
  return path.includes("[");
}

/**
 * The address a registry row may be linked to, or `null` when it has none.
 *
 * A concrete path is its own address. A pattern has no address of its own,
 * so it borrows its list parent when that parent is itself a screen the
 * caller may see; otherwise the row is not navigable and the caller must
 * render it without a link. A dynamic href reaching a `next/link` throws
 * "Dynamic href found in <Link>" and takes the whole application down
 * (frontend review finding 1), so no caller builds one by hand.
 */
export function navigableHref(screen: Screen, permitted: readonly Screen[] = SCREENS): string | null {
  if (!isDynamicPath(screen.path)) return screen.path;
  const parent = screen.path.replace(/\/\[[^\]]+\]/g, "");
  if (isDynamicPath(parent)) return null;
  const target = parent === "" ? "/" : parent;
  return permitted.some((row) => row.path === target) ? target : null;
}

function toPattern(path: string): RegExp {
  const source = path.replace(/[.*+?^${}()|\\]/g, "\\$&").replace(/\[[^\]]+\]/g, "[^/]+");
  return new RegExp(`^${source}/?$`);
}

/** Finds the registry entry for a concrete pathname (`/cases/CS0001204` matches `/cases/[key]`). */
export function matchScreen(pathname: string): Screen | undefined {
  const all = [...SCREENS, ...PORTAL_SCREENS];
  const exact = all.find((screen) => screen.path === pathname);
  if (exact) return exact;
  return all.filter((screen) => screen.path.includes("[")).find((screen) => toPattern(screen.path).test(pathname));
}
