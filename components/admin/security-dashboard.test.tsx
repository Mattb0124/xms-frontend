import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SecurityDashboard } from "@/components/admin/security-dashboard";
import { ContentHeaderBar } from "@/components/shell/content-header-bar";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";
import { aSecurityDashboard } from "@/test-kit/reporting";

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
    expect(within(tile("Paused integrations")).getByText("2")).toBeInTheDocument();
    expect(within(tile("Quarantined files")).getByText("1")).toBeInTheDocument();
    expect(within(tile("Open dead letters")).getByText("5")).toBeInTheDocument();

    expect(within(panel("Abuse")).getByText("abuse.webhook.bad_signature")).toBeInTheDocument();
    expect(within(panel("Rate limited clients")).getByText("client-a")).toBeInTheDocument();
    expect(within(panel("Paused integrations")).getByText("Webhook subscription")).toBeInTheDocument();
    expect(within(panel("Paused integrations")).getByText("error ratio")).toBeInTheDocument();
    expect(within(panel("Quarantined files")).getByText("email")).toBeInTheDocument();
    expect(within(panel("Open dead letters")).getByText("outbox")).toBeInTheDocument();
    // The oldest failure is named beside the count, so a queue of five is not
    // read as five failures that happened today.
    expect(within(panel("Open dead letters")).getByText("oldest 2026-09-01")).toBeInTheDocument();
  });

  it("links each row to the screen that answers it, and leaves the rest unlinked", async () => {
    stubFetch({
      "GET /v1/admin/me": () => json(me(["audit:read", "admin:api-clients", "admin:connectors"])),
      "GET /v1/dashboards/security": () => json(aSecurityDashboard()),
    });
    renderDesk(<SecurityDashboard />);

    await waitFor(() => expect(screen.getByText("client-a")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "client-a" })).toHaveAttribute("href", "/admin/api-clients");
    expect(screen.getByRole("link", { name: "outbox" })).toHaveAttribute("href", "/admin/connectors");
    expect(screen.getByRole("link", { name: "Connector instance" })).toHaveAttribute("href", "/admin/connectors");
    // This application serves no webhooks screen: the subscription is
    // registered by the client itself through the API with its key.
    expect(screen.queryByRole("link", { name: "Webhook subscription" })).not.toBeInTheDocument();
  });

  it("offers no link a reader would be refused", async () => {
    stubFetch({
      "GET /v1/admin/me": () => json(me(["audit:read"])),
      "GET /v1/dashboards/security": () => json(aSecurityDashboard()),
    });
    renderDesk(<SecurityDashboard />);

    await waitFor(() => expect(screen.getByText("client-a")).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: "client-a" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "outbox" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Connector instance" })).not.toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("radio", { name: "30 days" }));
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
