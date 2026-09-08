import { describe, expect, it } from "vitest";
import { serverHref, WAITING_TARGETS, waitingHref } from "@/lib/my-work/waiting-links";
import { SCREENS, matchScreen, visibleScreens } from "@/lib/routes";
import { aPlatformWaiting, aWaiting, aWaitingItem, WAITING_ACCOUNT_ID } from "@/test-kit/my-work";

/** Everything an internal person can hold, so the map is read at full reach. */
const ALL_PERMISSIONS = SCREENS.map((screen) => screen.permission).filter((key): key is string => key !== null);

const ALL_SCREENS = visibleScreens(ALL_PERMISSIONS);

const itemFor = (rail: ReturnType<typeof aWaiting>, key: string) => rail.items.find((row) => row.key === key)!;

describe("the waiting map", () => {
  it("covers every key the API answers with, and no key it does not", () => {
    const fromApi = aWaiting().items.map((item) => item.key);
    expect(fromApi).toHaveLength(7);
    expect([...Object.keys(WAITING_TARGETS)].sort()).toEqual([...fromApi].sort());
  });

  it("names only screen ids the registry actually declares", () => {
    for (const [key, target] of Object.entries(WAITING_TARGETS)) {
      if (target.screen === null) continue;
      expect(
        SCREENS.some((screen) => screen.screen === target.screen),
        `${key} names an unknown screen`,
      ).toBe(true);
    }
  });
});

/**
 * The API now writes this application's own addresses
 * (`test/waiting.int-spec.ts`), so the rail follows the link where it is one
 * this desk serves and this viewer may open. Every address below is checked
 * through `matchScreen`, the same resolver the shell uses, so a screen
 * renamed or removed in `lib/routes.ts` fails this test.
 */
const CASES: { key: string; href: string | null; screen: string | null }[] = [
  { key: "tickets_assigned", href: "/tickets?view=mine", screen: "queue" },
  { key: "scope_approvals", href: "/tickets", screen: "queue" },
  { key: "articles_in_review", href: "/knowledge?status=in_review", screen: "knowledge" },
  // The account the newest waiting run belongs to: a key alone cannot say this.
  { key: "report_reviews", href: `/admin/accounts/${WAITING_ACCOUNT_ID}?tab=reports`, screen: "admin.account" },
  { key: "pending_time", href: "/time", screen: "time" },
  { key: "unread_notifications", href: null, screen: null },
  { key: "csat_low_scores", href: `/accounts/${WAITING_ACCOUNT_ID}?tab=satisfaction`, screen: "account" },
];

describe.each(CASES)("waitingHref for $key", ({ key, href, screen }) => {
  const item = itemFor(aWaiting(), key);

  it("follows the address the API serves, checked against this application's registry", () => {
    expect(item).toBeDefined();
    expect(waitingHref(item, ALL_SCREENS)).toBe(href);
    if (href === null) return;
    const registered = matchScreen(href.split("?")[0]);
    expect(registered, `${href} is not a registered route`).toBeDefined();
    expect(registered!.screen).toBe(screen);
  });
});

/**
 * The older API wrote the platform's URL space (`/queue`, `/timesheet`,
 * `/reports/runs`), none of which this desk serves. Those links must not
 * survive: the key's own target answers instead.
 */
const LEGACY: { key: string; href: string | null }[] = [
  { key: "tickets_assigned", href: "/tickets?view=mine" },
  { key: "scope_approvals", href: "/tickets" },
  { key: "report_reviews", href: "/reports" },
  { key: "pending_time", href: "/time" },
  { key: "unread_notifications", href: null },
  { key: "csat_low_scores", href: "/accounts" },
];

describe.each(LEGACY)("waitingHref for $key on an older API", ({ key, href }) => {
  const item = itemFor(aPlatformWaiting(), key);

  it("drops an address this application does not serve and resolves the key instead", () => {
    expect(waitingHref(item, ALL_SCREENS)).toBe(href);
    if (href !== null) expect(href).not.toBe(item.link);
  });
});

describe("an older API's link that this desk does serve", () => {
  it("is followed as it came, extra parameters and all", () => {
    // `/knowledge?status=in_review&owner=me` is the Solutions screen, so the
    // rail opens it rather than rewriting the address; `owner=me` is simply a
    // parameter that screen's URL grammar does not read.
    const articles = itemFor(aPlatformWaiting(), "articles_in_review");
    expect(waitingHref(articles, ALL_SCREENS)).toBe("/knowledge?status=in_review&owner=me");
  });
});

describe("serverHref", () => {
  it("takes a same-site address the registry knows and the viewer may open", () => {
    expect(serverHref("/tickets?view=mine", ALL_SCREENS)).toBe("/tickets?view=mine");
    expect(serverHref(`/accounts/${WAITING_ACCOUNT_ID}?tab=satisfaction`, ALL_SCREENS)).toBe(
      `/accounts/${WAITING_ACCOUNT_ID}?tab=satisfaction`,
    );
  });

  it("refuses an address this application does not serve, or is not an address at all", () => {
    expect(serverHref("/queue?view=my-tickets", ALL_SCREENS)).toBeNull();
    expect(serverHref("/timesheet", ALL_SCREENS)).toBeNull();
    expect(serverHref(undefined, ALL_SCREENS)).toBeNull();
    expect(serverHref("javascript:alert(1)", ALL_SCREENS)).toBeNull();
    expect(serverHref("//evil.example/tickets", ALL_SCREENS)).toBeNull();
    // An absolute URL is another origin's business, even a registered path on it.
    expect(serverHref("https://evil.example/tickets", ALL_SCREENS)).toBeNull();
  });

  it("refuses a screen this viewer may not open", () => {
    const consultant = visibleScreens(["tickets:view", "time:log"]);
    expect(serverHref(`/admin/accounts/${WAITING_ACCOUNT_ID}?tab=reports`, consultant)).toBeNull();
    expect(serverHref("/tickets?view=mine", consultant)).toBe("/tickets?view=mine");
  });
});

describe("waitingHref", () => {
  it("falls back to the server's link only for a key the registry does not know", () => {
    const unknown = aWaitingItem({ key: "invoices_to_approve", link: "/finance/invoices?state=open" });
    expect(waitingHref(unknown, ALL_SCREENS)).toBe("/finance/invoices?state=open");
  });

  it("refuses an unknown key's link when it is not an address at all", () => {
    expect(waitingHref(aWaitingItem({ key: "not_a_key", link: "javascript:alert(1)" }), ALL_SCREENS)).toBeNull();
    expect(waitingHref(aWaitingItem({ key: "not_a_key", link: "//evil.example" }), ALL_SCREENS)).toBeNull();
  });

  it("never follows a link into a screen this viewer may not open, and falls back where it can", () => {
    const consultant = visibleScreens(["tickets:view", "time:log"]);
    const rail = aWaiting();
    // admin:accounts is not held, and neither is reports:view-portfolio, so
    // the row keeps its count and drops its address rather than sending the
    // reader into a refusal.
    expect(waitingHref(itemFor(rail, "report_reviews"), consultant)).toBeNull();
    // The account dashboard is tickets:view, which a consultant does hold, so
    // the low-score row still opens the account the server named.
    expect(waitingHref(itemFor(rail, "csat_low_scores"), consultant)).toBe(
      `/accounts/${WAITING_ACCOUNT_ID}?tab=satisfaction`,
    );
    expect(waitingHref(aWaitingItem(), consultant)).toBe("/tickets?view=mine");
  });

  it("keeps the key's own address when the API sends no link at all", () => {
    expect(waitingHref(aWaitingItem({ link: undefined }), ALL_SCREENS)).toBe("/tickets?view=mine");
    // The bell-menu row has no screen either way.
    expect(waitingHref(aWaitingItem({ key: "unread_notifications", link: undefined }), ALL_SCREENS)).toBeNull();
  });

  it("reads the whole registry when no permitted set is given", () => {
    expect(waitingHref(aWaitingItem())).toBe("/tickets?view=mine");
  });
});

/**
 * Review before send gave the desk a screen for a single held run
 * (`/reports/runs/[id]`, `reports:manage`). The rail's own row still opens
 * the account's Report packs tab, which is where the API points it and where
 * every waiting run is listed, but the registry now serves the run's own
 * address too, so an API that names it needs no change on this side.
 */
describe("the report review row", () => {
  const runLink = "/reports/runs/55555555-5555-4555-8555-555555555555";
  const reviewRow = (link: string) =>
    aWaitingItem({ key: "report_reviews", label: "Report packs to review", count: 1, link });

  it("still opens the Report packs tab the API names, one click from the review", () => {
    expect(waitingHref(itemFor(aWaiting(), "report_reviews"), ALL_SCREENS)).toBe(
      `/admin/accounts/${WAITING_ACCOUNT_ID}?tab=reports`,
    );
  });

  it("would follow the run's own address, and only for a reader who may open it", () => {
    expect(matchScreen(runLink)?.screen).toBe("report_run");
    const reviewer = visibleScreens(["reports:manage", "tickets:view"]);
    expect(serverHref(runLink, reviewer)).toBe(runLink);
    expect(waitingHref(reviewRow(runLink), reviewer)).toBe(runLink);
    // Without reports:manage the address is dropped rather than offered as a
    // refusal, and the key's own target cannot stand in either, since the
    // report packs screen needs a permission this reader has not got.
    const consultant = visibleScreens(["tickets:view"]);
    expect(serverHref(runLink, consultant)).toBeNull();
    expect(waitingHref(reviewRow(runLink), consultant)).toBeNull();
  });
});
