import { describe, expect, it } from "vitest";
import {
  deadLetterHref,
  pausedDetail,
  pausedHref,
  pausedLabel,
  securityLinks,
  securityTiles,
} from "@/lib/reporting/security";
import { aSecurityDashboard, PAUSED_INSTANCE_ID, SECURITY_ACCOUNT_ID } from "@/test-kit/reporting";

const EVERY_SCREEN = securityLinks(() => true);
const NO_SCREEN = securityLinks(() => false);

describe("securityTiles", () => {
  it("counts each tile out of the stream and the roll-ups sent beside the lists", () => {
    expect(securityTiles(aSecurityDashboard())).toEqual({
      signin: 4,
      denials: 12,
      probes: 2,
      admin: 2,
      exports: 3,
      abuse: 4,
      rateLimited: 3,
      paused: 2,
      quarantined: 1,
      deadLetters: 6,
    });
  });

  it("counts the abuse group out of by_type where the API sent no list of its own", () => {
    expect(securityTiles(aSecurityDashboard({ abuse_by_kind: undefined })).abuse).toBe(4);
  });
});

describe("securityLinks", () => {
  it("offers each Admin screen only with its permission in hand", () => {
    expect(securityLinks((key) => key === "admin:connectors")).toEqual({
      apiClients: undefined,
      connectors: "/admin/connectors",
      accounts: undefined,
    });
    expect(EVERY_SCREEN).toEqual({
      apiClients: "/admin/api-clients",
      connectors: "/admin/connectors",
      accounts: "/admin/accounts",
    });
  });
});

describe("a paused row", () => {
  const [subscription, instance] = aSecurityDashboard().paused_integrations ?? [];

  it("is named by its record, or by its kind where the record has no name", () => {
    expect(pausedLabel(instance)).toBe("Brookfield ServiceNow");
    expect(pausedLabel({ ...subscription, name: "" })).toBe("Webhook subscription");
    expect(pausedDetail(instance)).toBe("Connector instance, brookfield, error ratio");
  });

  it("opens the instance itself, or the account a subscription belongs to", () => {
    expect(pausedHref(instance, EVERY_SCREEN)).toBe(`/admin/connectors/${PAUSED_INSTANCE_ID}`);
    expect(pausedHref(subscription, EVERY_SCREEN)).toBe(`/admin/accounts/${SECURITY_ACCOUNT_ID}`);
  });

  it("opens nothing for a reader without the screen, or where the row names no record", () => {
    expect(pausedHref(instance, NO_SCREEN)).toBeUndefined();
    expect(pausedHref({ ...instance, id: "" }, EVERY_SCREEN)).toBeUndefined();
  });
});

describe("a dead-letter row", () => {
  const [connectorQueue, platformQueue] = aSecurityDashboard().open_dead_letters ?? [];

  it("opens the instance's Dead letters tab, and nothing for a platform queue", () => {
    expect(deadLetterHref(connectorQueue, EVERY_SCREEN)).toBe(
      `/admin/connectors/${PAUSED_INSTANCE_ID}?tab=dead-letters`,
    );
    expect(deadLetterHref(platformQueue, EVERY_SCREEN)).toBeUndefined();
    expect(deadLetterHref(connectorQueue, NO_SCREEN)).toBeUndefined();
  });
});
