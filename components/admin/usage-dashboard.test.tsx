import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UsageDashboard } from "@/components/admin/usage-dashboard";
import { ContentHeaderBar } from "@/components/shell/content-header-bar";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";
import { aUsageDashboard, aUsageStrip } from "@/test-kit/reporting";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/usage",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const me = () => ({
  principal: { kind: "internal", userId: "user-ada", accountIds: [], permissions: ["analytics:read"] },
});

const strip = () => screen.getByRole("region", { name: "Accounts" });

describe("UsageDashboard per-account strip", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists the accounts busiest first, with every figure the server counted", async () => {
    stubFetch({
      "GET /v1/admin/me": () => json(me()),
      "GET /v1/dashboards/usage": () => json(aUsageDashboard()),
    });
    renderDesk(<UsageDashboard />);

    await waitFor(() => expect(screen.getByRole("region", { name: "Accounts" })).toBeInTheDocument());
    const names = within(strip())
      .getAllByRole("link")
      .map((link) => link.textContent);
    // The fixture sends Northwind first; the table opens on tickets created.
    expect(names).toEqual(["Brookfield", "Northwind Health"]);

    const busiest = within(strip())
      .getAllByRole("row")
      .find((row) => row.textContent?.includes("Brookfield"))!;
    expect(busiest).toHaveTextContent("BRK");
    expect(busiest).toHaveTextContent("31");
    expect(busiest).toHaveTextContent("27");
    // 1,320 minutes read as hours, the way time is read everywhere else.
    expect(busiest).toHaveTextContent("22h");
    expect(busiest).toHaveTextContent("12");
    expect(busiest).toHaveTextContent("480");
    expect(busiest).toHaveTextContent("9");
  });

  it("opens each account's dashboard from its row", async () => {
    stubFetch({
      "GET /v1/admin/me": () => json(me()),
      "GET /v1/dashboards/usage": () => json(aUsageDashboard()),
    });
    renderDesk(<UsageDashboard />);

    // Scoped to the strip: the core-loop table names the same accounts.
    await waitFor(() => expect(within(strip()).getByText("Brookfield")).toBeInTheDocument());
    expect(within(strip()).getByRole("link", { name: "Brookfield" })).toHaveAttribute("href", "/accounts/acct-1");
    expect(within(strip()).getByRole("link", { name: "Northwind Health" })).toHaveAttribute("href", "/accounts/acct-2");
  });

  it("says so when the window holds no granted account", async () => {
    stubFetch({
      "GET /v1/admin/me": () => json(me()),
      "GET /v1/dashboards/usage": () => json(aUsageDashboard({ per_account: [] })),
    });
    renderDesk(<UsageDashboard />);

    await waitFor(() => expect(screen.getByRole("region", { name: "Accounts" })).toBeInTheDocument());
    expect(within(strip()).getByText(/No granted accounts/)).toBeInTheDocument();
  });

  it("leaves the strip out entirely when the API does not answer it", async () => {
    stubFetch({
      "GET /v1/admin/me": () => json(me()),
      "GET /v1/dashboards/usage": () => json({ active_users: [{ key: "internal", n: 3 }] }),
    });
    renderDesk(<UsageDashboard />);

    await waitFor(() => expect(screen.getByText("Top actions")).toBeInTheDocument());
    expect(screen.queryByRole("region", { name: "Accounts" })).not.toBeInTheDocument();
  });

  it("shows the skeleton before the first answer and the strip after it", async () => {
    stubFetch({
      "GET /v1/admin/me": () => json(me()),
      "GET /v1/dashboards/usage": () => json(aUsageDashboard()),
    });
    const view = renderDesk(<UsageDashboard />);
    expect(view.container.querySelector("[data-skeleton]")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Accounts" })).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole("region", { name: "Accounts" })).toBeInTheDocument());
    expect(view.container.querySelector("[data-skeleton]")).not.toBeInTheDocument();
  });

  it("follows the window selector the screen already has", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": () => json(me()),
      "GET /v1/dashboards/usage": () => json(aUsageDashboard({ per_account: aUsageStrip([{ tickets_created: 99 }]) })),
    });
    renderDesk(
      <ContentHeaderBar current={undefined} screens={[]} onToggleSidebar={() => {}}>
        <UsageDashboard />
      </ContentHeaderBar>,
    );

    await waitFor(() => expect(screen.getByRole("region", { name: "Accounts" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("radio", { name: "90 days" }));
    await waitFor(() =>
      expect(calls.filter((call) => call.key === "GET /v1/dashboards/usage").at(-1)?.search).toContain("days=90"),
    );
  });
});
