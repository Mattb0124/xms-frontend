/**
 * The route registry for the internal application: every screen declares its
 * path, a stable `screen` id (the telemetry vocabulary, Audit & Analytics
 * section 4.2), its section in the All overlay, and the permission it needs.
 * The sidebar, the finders and the command palette all read this list, and
 * they fail closed: with no permission set loaded nothing is shown
 * (User Experience section 2.1).
 */

export type Section =
  "Home" | "Tickets" | "Intake" | "Knowledge" | "Time" | "Accounts" | "Capacity" | "Reports" | "Admin";

export interface Screen {
  path: string;
  screen: string;
  label: string;
  section: Section;
  /** `null` means every signed-in internal user; otherwise one permission key. */
  permission: string | null;
  /** Shown in the pinned sidebar by default (the prototype's six pins). */
  pinned?: boolean;
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
    pinned: true,
    purpose: "Your day: scorecards, needs attention, time today.",
  },
  {
    path: "/tickets",
    screen: "queue",
    label: "Queue",
    section: "Tickets",
    permission: "tickets:view",
    pinned: true,
    purpose: "The working list for everything ticket-shaped.",
  },
  {
    path: "/tickets/dispatch",
    screen: "dispatch",
    label: "Dispatch",
    section: "Tickets",
    permission: "tickets:work",
    pinned: true,
    purpose: "Unassigned tickets with group and assignee pickers.",
  },
  {
    path: "/tickets/quarantine",
    screen: "quarantine",
    label: "Quarantine",
    section: "Intake",
    permission: "tickets:work",
    pinned: true,
    purpose: "Unknown senders awaiting review.",
  },
  {
    path: "/tickets/new",
    screen: "ticket.new",
    label: "New ticket",
    section: "Tickets",
    permission: "tickets:create",
    purpose: "Full-screen record form.",
  },
  {
    path: "/tickets/[key]",
    screen: "ticket",
    label: "Ticket",
    section: "Tickets",
    permission: "tickets:view",
    purpose: "The record: conversation, activity, time, resolution.",
  },
  {
    path: "/knowledge",
    screen: "knowledge",
    label: "Solutions",
    section: "Knowledge",
    permission: "tickets:view",
    pinned: true,
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
    purpose: "One person: details, working calendar, skills, certifications.",
  },
  {
    path: "/operations",
    screen: "operations",
    label: "Operations",
    section: "Reports",
    permission: "reports:view-portfolio",
    pinned: true,
    purpose: "Six tiles, four panels, one synthesis line.",
  },
  {
    path: "/reports",
    screen: "report_packs",
    label: "Report packs",
    section: "Reports",
    permission: "reports:view-portfolio",
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
  { path: "/portal/requests", screen: "portal.requests", label: "My requests", section: "Tickets", permission: null },
  { path: "/portal/requests/new", screen: "portal.new", label: "New request", section: "Tickets", permission: null },
  { path: "/portal/requests/[key]", screen: "portal.request", label: "Request", section: "Tickets", permission: null },
];

export const SECTIONS: Section[] = [
  "Home",
  "Tickets",
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

export function pinnedScreens(permissions: ReadonlySet<string> | string[] | undefined): Screen[] {
  return visibleScreens(permissions).filter((screen) => screen.pinned);
}

function toPattern(path: string): RegExp {
  const source = path.replace(/[.*+?^${}()|\\]/g, "\\$&").replace(/\[[^\]]+\]/g, "[^/]+");
  return new RegExp(`^${source}/?$`);
}

/** Finds the registry entry for a concrete pathname (`/tickets/CS0001204` matches `/tickets/[key]`). */
export function matchScreen(pathname: string): Screen | undefined {
  const all = [...SCREENS, ...PORTAL_SCREENS];
  const exact = all.find((screen) => screen.path === pathname);
  if (exact) return exact;
  return all.filter((screen) => screen.path.includes("[")).find((screen) => toPattern(screen.path).test(pathname));
}
