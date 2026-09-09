import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountDashboard } from "@/components/reporting/account-dashboard";
import { aCompTimeReport } from "@/test-kit/time";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";
import { aClientDashboard, anAccountDashboard, aReportRun } from "@/test-kit/reporting";

vi.mock("next/navigation", () => ({
  usePathname: () => "/accounts/acct-1",
  useRouter: () => ({ push: vi.fn() }),
}));

const me = (permissions: string[]) => ({
  principal: {
    kind: "internal",
    userId: "user-cara",
    email: "cara@example.test",
    displayName: "Cara Lee",
    accountIds: ["acct-1"],
    permissions,
  },
});

const accounts = [{ id: "acct-1", key: "BRK", name: "Brookfield", status: "active" }];

describe("AccountDashboard", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows the internal view, then View as client re-fetches the client subset and hides notable and the synthesis", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": () => json(me(["tickets:view", "contracts:view", "admin:accounts"])),
      "GET /v1/accounts": () => json(accounts),
      "GET /v1/dashboards/accounts/acct-1": (body) => {
        void body;
        const last = calls[calls.length - 1];
        return json(last.search.includes("as_client=true") ? aClientDashboard() : anAccountDashboard());
      },
      "GET /v1/accounts/acct-1/reports": () => json([aReportRun()]),
      "GET /v1/accounts/acct-1/time/comp-time": () => json(aCompTimeReport()),
    });
    renderDesk(<AccountDashboard accountId="acct-1" />);
    await waitFor(() => expect(screen.getByTestId("notable-list")).toBeInTheDocument());
    expect(screen.getByTestId("synthesis")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("comp-time-total")).toHaveTextContent("3h"));
    expect(screen.getByRole("link", { name: "Open the queue" })).toHaveAttribute("href", "/cases?account_id=acct-1");
    expect(screen.getByRole("link", { name: "Account record" })).toHaveAttribute("href", "/admin/accounts/acct-1");
    expect(screen.getByText("Ready for review")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open pack" })).toHaveAttribute("href", "/reports/packs/pack-1");

    fireEvent.click(screen.getAllByRole("switch", { name: "View as client" })[0]);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("This is what the client sees"));
    await waitFor(() => expect(screen.queryByTestId("notable-list")).not.toBeInTheDocument());
    expect(screen.queryByTestId("synthesis")).not.toBeInTheDocument();
    expect(screen.queryByText("Reports")).not.toBeInTheDocument();
    expect(screen.queryByTestId("comp-time-total")).not.toBeInTheDocument();
    expect(
      calls.some(
        (call) => call.key === "GET /v1/dashboards/accounts/acct-1" && call.search === "?days=7&as_client=true",
      ),
    ).toBe(true);
    // The client subset has no breached, at risk or unassigned tiles.
    const tiles = screen.getByTestId("tile-strip");
    expect(tiles.textContent).toContain("Open");
    expect(tiles.textContent).not.toContain("Breached");
    expect(screen.queryByText("Outcomes")).toBeInTheDocument();
    expect(screen.queryByText("Reopen rate")).not.toBeInTheDocument();
  });

  it("generates a weekly report for practice leads and opens the presigned download", async () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    const calls = stubFetch({
      "GET /v1/admin/me": () => json(me(["tickets:view", "reports:view-portfolio"])),
      "GET /v1/accounts": () => json(accounts),
      "GET /v1/dashboards/accounts/acct-1": () => json(anAccountDashboard()),
      "GET /v1/accounts/acct-1/reports": () => json([]),
      "POST /v1/accounts/acct-1/reports/wsr": () =>
        json({ run_id: "run-2", pack_id: "pack-2", download: "https://files.test/pack-2.pptx" }, 201),
    });
    renderDesk(<AccountDashboard accountId="acct-1" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Generate weekly report" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Generate weekly report" }));
    await waitFor(() => expect(screen.getByText("Weekly report generated")).toBeInTheDocument());
    // The presigned URL is server-supplied, so it is validated and opened
    // with no opener and no referrer (security review findings 26 and 38).
    expect(open).toHaveBeenCalledWith("https://files.test/pack-2.pptx", "_blank", "noopener,noreferrer");
    expect(calls.filter((call) => call.key === "GET /v1/accounts/acct-1/reports").length).toBeGreaterThanOrEqual(2);
  });

  it("hides the generate button without reports:view-portfolio", async () => {
    stubFetch({
      "GET /v1/admin/me": () => json(me(["tickets:view"])),
      "GET /v1/accounts": () => json(accounts),
      "GET /v1/dashboards/accounts/acct-1": () => json(anAccountDashboard()),
      "GET /v1/accounts/acct-1/reports": () => json([]),
    });
    renderDesk(<AccountDashboard accountId="acct-1" />);
    await waitFor(() => expect(screen.getByText("No report runs yet.")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Generate weekly report" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Account record" })).not.toBeInTheDocument();
  });
});
