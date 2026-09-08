import { describe, expect, it } from "vitest";
import { WAITING_TARGETS, waitingHref } from "@/lib/my-work/waiting-links";
import { SCREENS, matchScreen, visibleScreens } from "@/lib/routes";
import { aWaiting, aWaitingItem } from "@/test-kit/my-work";

/** Everything an internal person can hold, so the map is read at full reach. */
const ALL_PERMISSIONS = SCREENS.map((screen) => screen.permission).filter((key): key is string => key !== null);

const ALL_SCREENS = visibleScreens(ALL_PERMISSIONS);

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
 * One case per key: the address the rail renders must be a route this
 * application registers, not the platform address the API sent. The path is
 * checked through `matchScreen`, the same resolver the shell uses, so a
 * screen renamed or removed in `lib/routes.ts` fails this test.
 */
const CASES: { key: string; href: string | null; screen: string | null }[] = [
  { key: "tickets_assigned", href: "/tickets?view=mine", screen: "queue" },
  { key: "scope_approvals", href: "/tickets", screen: "queue" },
  { key: "articles_in_review", href: "/knowledge?status=in_review", screen: "knowledge" },
  { key: "report_reviews", href: "/reports", screen: "report_packs" },
  { key: "pending_time", href: "/time", screen: "time" },
  { key: "unread_notifications", href: null, screen: null },
  { key: "csat_low_scores", href: null, screen: null },
];

describe.each(CASES)("waitingHref for $key", ({ key, href, screen }) => {
  const item = aWaiting().items.find((row) => row.key === key)!;

  it("resolves to this application's own route, never the server's link", () => {
    expect(item).toBeDefined();
    expect(waitingHref(item, ALL_SCREENS)).toBe(href);
    if (href === null) return;
    // The server's address is a different URL space, so it must not survive.
    expect(href).not.toBe(item.link);
    const registered = matchScreen(href.split("?")[0]);
    expect(registered, `${href} is not a registered route`).toBeDefined();
    expect(registered!.screen).toBe(screen);
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

  it("offers no address for a screen this viewer may not open", () => {
    const consultant = visibleScreens(["tickets:view", "time:log"]);
    const reports = aWaiting().items.find((row) => row.key === "report_reviews")!;
    // reports:view-portfolio is not held, so the row keeps its count and drops
    // its link rather than sending the reader into a refusal.
    expect(waitingHref(reports, consultant)).toBeNull();
    expect(waitingHref(aWaitingItem(), consultant)).toBe("/tickets?view=mine");
  });

  it("reads the whole registry when no permitted set is given", () => {
    expect(waitingHref(aWaitingItem())).toBe("/tickets?view=mine");
  });
});
