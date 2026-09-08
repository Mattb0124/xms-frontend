import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SecurityDashboard } from "@/components/admin/security-dashboard";
import { ContentHeaderBar } from "@/components/shell/content-header-bar";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";
import { aSecurityDashboard, PAUSED_INSTANCE_ID, SECURITY_ACCOUNT_ID } from "@/test-kit/reporting";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/security",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const me = (permissions: string[]) => ({
  principal: { kind: "internal", userId: "user-ada", accountIds: [], permissions },
});

const panel = (title: string) => screen.getByRole("region", { name: title });
/** The tile strip; a tile label and a panel title read alike, so tiles are read here. */
const tiles = () => screen.getByTestId("security-tiles");

describe("SecurityDashboard", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("draws a tile and a panel for every figure the API answered", async () => {
    stubFetch({
      "GET /v1/admin/me": () => json(me(["audit:read", "admin:api-clients", "admin:connectors"])),
      "GET /v1/dashboards/security": () => json(aSecurityDashboard()),
    });
    renderDesk(<SecurityDashboard />);

    await waitFor(() => expect(screen.getByTestId("security-tiles")).toBeInTheDocument());
    const tile = (label: string) => within(tiles()).getByText(label).parentElement!;
    expect(within(tile("Abuse events")).getByText("4")).toBeInTheDocument();
    expect(within(tile("Rate limited clients")).getByText("3")).toBeInTheDocument();
    // The tiles read the roll-ups beside the lists, not the rows: the paused
    // count is by reason, and the dead-letter depth is the operator-wide
    // six, which is wider than the five rows this reader is shown.
    expect(within(tile("Paused integrations")).getByText("2")).toBeInTheDocument();
    expect(within(tile("Quarantined files")).getByText("1")).toBeInTheDocument();
    expect(within(tile("Open dead letters")).getByText("6")).toBeInTheDocument();

    expect(within(panel("Abuse")).getByText("abuse.webhook.bad_signature")).toBeInTheDocument();
    expect(within(panel("Rate limited clients")).getByText("client-a")).toBeInTheDocument();
    // Each paused row names the record, its kind, its account and the reason.
    expect(within(panel("Paused integrations")).getByText("Brookfield ServiceNow")).toBeInTheDocument();
    expect(
      within(panel("Paused integrations")).getByText("Connector instance, brookfield, error ratio"),
    ).toBeInTheDocument();
    expect(within(panel("Paused integrations")).getByText("https://hooks.brookfield.example/xms")).toBeInTheDocument();
    expect(
      within(panel("Paused integrations")).getByText("Webhook subscription, brookfield, continuous_failure"),
    ).toBeInTheDocument();
    expect(within(panel("Quarantined files")).getByText("email")).toBeInTheDocument();
    expect(within(panel("Open dead letters")).getByText("outbound")).toBeInTheDocument();
    // The instance and the oldest failure are named beside the count, so a
    // queue of four is neither anonymous nor read as four failures today.
    expect(
      within(panel("Open dead letters")).getByText("Brookfield ServiceNow, oldest 2026-09-01"),
    ).toBeInTheDocument();
    expect(within(panel("Open dead letters")).getByText("oldest 2026-09-03")).toBeInTheDocument();
  });

  it("opens the record behind each row, by kind and by id", async () => {
    stubFetch({
      "GET /v1/admin/me": () => json(me(["audit:read", "admin:api-clients", "admin:connectors", "admin:accounts"])),
      "GET /v1/dashboards/security": () => json(aSecurityDashboard()),
    });
    renderDesk(<SecurityDashboard />);

    await waitFor(() => expect(screen.getByText("client-a")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "client-a" })).toHaveAttribute("href", "/admin/api-clients");
    // The tripped instance's own page, not the list it sits in.
    expect(screen.getByRole("link", { name: "Brookfield ServiceNow" })).toHaveAttribute(
      "href",
      `/admin/connectors/${PAUSED_INSTANCE_ID}`,
    );
    // A subscription is registered by the client itself through the API, so
    // this desk serves no screen for it: the account it belongs to is the
    // nearest record a reader can act on.
    expect(screen.getByRole("link", { name: "https://hooks.brookfield.example/xms" })).toHaveAttribute(
      "href",
      `/admin/accounts/${SECURITY_ACCOUNT_ID}`,
    );
    // The connector queue opens that instance's Dead letters tab.
    expect(screen.getByRole("link", { name: "outbound" })).toHaveAttribute(
      "href",
      `/admin/connectors/${PAUSED_INSTANCE_ID}?tab=dead-letters`,
    );
    // A platform queue names no instance, and no screen replays it.
    expect(screen.queryByRole("link", { name: "mail" })).not.toBeInTheDocument();
  });

  it("offers no link a reader would be refused", async () => {
    stubFetch({
      "GET /v1/admin/me": () => json(me(["audit:read"])),
      "GET /v1/dashboards/security": () => json(aSecurityDashboard()),
    });
    renderDesk(<SecurityDashboard />);

    await waitFor(() => expect(screen.getByText("client-a")).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: "client-a" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "outbound" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Brookfield ServiceNow" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "https://hooks.brookfield.example/xms" })).not.toBeInTheDocument();
  });

  /**
   * The old shape counted paused integrations by kind and reason and dead
   * letters by queue, with no id anywhere, so nothing could be opened. A
   * response in that shape must not quietly render as a list of blanks.
   */
  it("draws no paused or dead-letter row from the shape the API used to answer", async () => {
    stubFetch({
      "GET /v1/admin/me": () => json(me(["audit:read", "admin:connectors", "admin:accounts"])),
      "GET /v1/dashboards/security": () =>
        json({
          ...aSecurityDashboard(),
          paused_integrations: [{ kind: "webhook", reason: "continuous_failure", n: 1 }],
          open_dead_letters: [{ queue: "outbox", n: 5, oldest: "2026-09-01T04:00:00Z" }],
        }),
    });
    renderDesk(<SecurityDashboard />);

    await waitFor(() => expect(screen.getByTestId("security-tiles")).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: "outbox" })).not.toBeInTheDocument();
    expect(within(panel("Paused integrations")).queryByRole("link")).not.toBeInTheDocument();
    expect(within(panel("Open dead letters")).queryByRole("link")).not.toBeInTheDocument();
    // The tiles read the roll-ups, which are answered whatever the rows carry.
    expect(within(tiles()).getByText("Paused integrations").parentElement).toHaveTextContent("2");
  });

  it("leaves a figure out entirely rather than printing a zero the API never sent", async () => {
    stubFetch({
      "GET /v1/admin/me": () => json(me(["audit:read"])),
      "GET /v1/dashboards/security": () =>
        json({
          by_type: aSecurityDashboard().by_type,
          signin_failures: [],
          isolation_probes: [],
        }),
    });
    renderDesk(<SecurityDashboard />);

    await waitFor(() => expect(screen.getByTestId("security-tiles")).toBeInTheDocument());
    expect(screen.queryByText("Rate limited clients")).not.toBeInTheDocument();
    expect(screen.queryByText("Paused integrations")).not.toBeInTheDocument();
    expect(screen.queryByText("Quarantined files")).not.toBeInTheDocument();
    expect(screen.queryByText("Open dead letters")).not.toBeInTheDocument();
    // The abuse tile still counts, because it can be read out of by_type.
    expect(within(tiles()).getByText("Abuse events").parentElement).toHaveTextContent("4");
    expect(screen.queryByRole("region", { name: "Abuse" })).not.toBeInTheDocument();
  });

  it("carries the window selector and refetches the whole dashboard on it", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": () => json(me(["audit:read"])),
      "GET /v1/dashboards/security": () => json(aSecurityDashboard()),
    });
    // The selector portals into the content header bar, so the screen is
    // mounted inside one: this is the switcher a person actually clicks.
    renderDesk(
      <ContentHeaderBar current={undefined} screens={[]} onToggleSidebar={() => {}}>
        <SecurityDashboard />
      </ContentHeaderBar>,
    );

    await waitFor(() => expect(screen.getByTestId("security-tiles")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Period"), { target: { value: "30" } });
    await waitFor(() =>
      expect(calls.filter((call) => call.key === "GET /v1/dashboards/security").length).toBeGreaterThan(1),
    );
    expect(calls.filter((call) => call.key === "GET /v1/dashboards/security").at(-1)?.search).toContain("days=30");
  });

  it("says so when the dashboard could not be loaded", async () => {
    stubFetch({
      "GET /v1/admin/me": () => json(me(["audit:read"])),
      "GET /v1/dashboards/security": () => json({ code: "server_error" }, 500),
    });
    renderDesk(<SecurityDashboard />);
    await waitFor(() => expect(screen.getByText("The security dashboard could not be loaded")).toBeInTheDocument());
  });
});
